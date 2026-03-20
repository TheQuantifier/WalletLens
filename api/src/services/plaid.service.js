import env from "../config/env.js";
import {
  countActivePlaidAccountsForItem,
  deletePlaidItemById,
  getPlaidAccountById,
  getPlaidItemById,
  listActivePlaidAccountsByUser,
  listActivePlaidItemsByUser,
  setPlaidAccountActive,
  updatePlaidItemById,
  upsertPlaidAccount,
  upsertPlaidItem,
} from "../models/plaid_item.model.js";
import {
  createOrUpdatePlaidRecord,
  deletePlaidRecordsByAccountId,
  deletePlaidRecordsByTransactionIds,
} from "../models/record.model.js";
import { captureNetWorthSnapshot, resetNetWorthSnapshots } from "./net_worth_snapshot.service.js";
import { applyStoredRulesToRecordInput } from "./rules.service.js";

const PLAID_ENV_HOSTS = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

const EXPENSE_CATEGORY_MAP = new Map([
  ["BANK_FEES", "Miscellaneous"],
  ["ENTERTAINMENT", "Entertainment"],
  ["FOOD_AND_DRINK", "Dining"],
  ["GENERAL_MERCHANDISE", "Shopping"],
  ["GENERAL_SERVICES", "Miscellaneous"],
  ["GOVERNMENT_AND_NON_PROFIT", "Miscellaneous"],
  ["HOME_IMPROVEMENT", "Housing"],
  ["INCOME", "Other"],
  ["LOAN_PAYMENTS", "Miscellaneous"],
  ["MEDICAL", "Health"],
  ["PERSONAL_CARE", "Health"],
  ["RENT_AND_UTILITIES", "Utilities"],
  ["TRANSPORTATION", "Transportation"],
  ["TRAVEL", "Entertainment"],
]);

const INCOME_CATEGORY_MAP = new Map([
  ["INCOME", "Salary / Wages"],
  ["TRANSFER_IN", "Refunds / Reimbursements"],
]);

function getPlaidBaseUrl() {
  const key = String(env.plaidEnv || "sandbox").toLowerCase();
  return PLAID_ENV_HOSTS[key] || PLAID_ENV_HOSTS.sandbox;
}

export function isPlaidConfigured() {
  return Boolean(env.plaidClientId && env.plaidSecret);
}

async function plaidRequest(path, body = {}) {
  if (!isPlaidConfigured()) {
    const err = new Error("Plaid sandbox is not configured on the server.");
    err.status = 503;
    throw err;
  }

  const response = await fetch(`${getPlaidBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PLAID-CLIENT-ID": env.plaidClientId,
      "PLAID-SECRET": env.plaidSecret,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload?.error_message || payload?.message || "Plaid request failed.");
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function pickCurrency(primary, fallback = "USD") {
  return (
    String(primary?.iso_currency_code || primary?.unofficial_currency_code || fallback || "USD").trim() ||
    "USD"
  );
}

function mapPlaidCategory(transaction, type) {
  const directPrimary = String(transaction?.personal_finance_category?.primary || "").trim();
  const detailed = String(transaction?.personal_finance_category?.detailed || "").trim();
  const knownKeys = type === "income" ? Array.from(INCOME_CATEGORY_MAP.keys()) : Array.from(EXPENSE_CATEGORY_MAP.keys());
  const primary =
    directPrimary ||
    knownKeys.find((key) => detailed.startsWith(key)) ||
    "";

  if (type === "income") {
    return INCOME_CATEGORY_MAP.get(primary) || "Other";
  }

  return EXPENSE_CATEGORY_MAP.get(primary) || "Miscellaneous";
}

function buildTransactionNote(transaction, account) {
  const parts = [];
  const merchant =
    transaction?.merchant_name ||
    transaction?.name ||
    transaction?.original_description ||
    "";
  const mask = account?.mask ? `****${account.mask}` : "";
  const pending = transaction?.pending ? "Pending" : "";

  if (merchant) parts.push(String(merchant).trim());
  if (mask) parts.push(mask);
  if (pending) parts.push(pending);

  return parts.join(" | ");
}

function normalizeTransactionDate(transaction) {
  return String(transaction?.authorized_date || transaction?.date || "").slice(0, 10);
}

function normalizeImportedTransaction(transaction, account) {
  const signedAmount = Number(transaction?.amount || 0);
  const type = signedAmount < 0 ? "income" : "expense";
  const currency = pickCurrency(transaction, account?.currency || "USD");

  return {
    type,
    amount: Math.abs(signedAmount),
    category: mapPlaidCategory(transaction, type),
    date: normalizeTransactionDate(transaction),
    note: buildTransactionNote(transaction, account),
    origin: "plaid",
    linkedPlaidAccountId: account.id,
    plaidTransactionId: transaction.transaction_id,
    currency,
  };
}

export async function createPlaidLinkToken(user) {
  const data = await plaidRequest("/link/token/create", {
    user: {
      client_user_id: String(user.id),
    },
    client_name: "WalletLens Sandbox",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
    transactions: {
      days_requested: 730,
    },
  });

  return {
    linkToken: data.link_token,
    expiration: data.expiration,
  };
}

async function syncAccountsForItem(userId, item, accounts = []) {
  const upserted = [];
  for (const account of accounts) {
    const row = await upsertPlaidAccount({
      userId,
      plaidItemRef: item.id,
      plaidAccountId: account.account_id,
      name: account.name || account.official_name || "Linked account",
      officialName: account.official_name || "",
      mask: account.mask || "",
      type: account.type || "",
      subtype: account.subtype || "",
      currentBalance: account?.balances?.current ?? null,
      availableBalance: account?.balances?.available ?? null,
      currency: pickCurrency(account?.balances, "USD"),
      institutionName: item.institution_name || "",
      isActive: true,
    });
    upserted.push(row);
  }
  return upserted;
}

export async function exchangePublicTokenAndImport({
  user,
  publicToken,
  institution = null,
}) {
  const exchange = await plaidRequest("/item/public_token/exchange", {
    public_token: String(publicToken || "").trim(),
  });

  const item = await upsertPlaidItem({
    userId: user.id,
    plaidItemId: exchange.item_id,
    accessToken: exchange.access_token,
    institutionId: institution?.institution_id || institution?.id || "",
    institutionName: institution?.name || "",
    status: "active",
  });

  const accountResponse = await plaidRequest("/accounts/get", {
    access_token: exchange.access_token,
  });
  await syncAccountsForItem(user.id, item, accountResponse.accounts || []);

  const syncResult = await syncPlaidItemTransactions(user.id, item.id);
  const accounts = await listActivePlaidAccountsByUser(user.id);
  await captureNetWorthSnapshot(user.id);

  return {
    item,
    accounts,
    sync: syncResult,
  };
}

export async function syncPlaidItemTransactions(userId, plaidItemRowId) {
  const item = await getPlaidItemById(userId, plaidItemRowId);
  if (!item || item.status !== "active") {
    return { imported: 0, removed: 0, accountsUpdated: 0 };
  }

  const accountResponse = await plaidRequest("/accounts/get", {
    access_token: item.access_token,
  });
  const accounts = await syncAccountsForItem(userId, item, accountResponse.accounts || []);
  const activeAccountMap = new Map(
    accounts.filter((row) => row?.is_active).map((row) => [row.plaid_account_id, row])
  );

  let cursor = item.cursor || null;
  let imported = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    const payload = await plaidRequest("/transactions/sync", {
      access_token: item.access_token,
      ...(cursor ? { cursor } : {}),
      count: 200,
      options: {
        include_original_description: true,
      },
    });

    const processTransactions = async (transactions = []) => {
      for (const transaction of transactions) {
        if (!transaction || transaction.pending) continue;
        const account = activeAccountMap.get(transaction.account_id);
        if (!account) continue;

        let recordInput = normalizeImportedTransaction(transaction, account);
        if (!recordInput.date) continue;

        const applied = await applyStoredRulesToRecordInput(userId, recordInput, {
          origin: "plaid",
        });
        recordInput = {
          ...recordInput,
          type: applied.record.type,
          category: applied.record.category,
          note: applied.record.note,
        };

        await createOrUpdatePlaidRecord(userId, recordInput);
        imported += 1;
      }
    };

    await processTransactions(payload.added || []);
    await processTransactions(payload.modified || []);

    const removedIds = (payload.removed || [])
      .map((entry) => String(entry?.transaction_id || "").trim())
      .filter(Boolean);
    if (removedIds.length) {
      removed += await deletePlaidRecordsByTransactionIds(userId, removedIds);
    }

    cursor = payload.next_cursor || cursor;
    hasMore = Boolean(payload.has_more);
  }

  await updatePlaidItemById(userId, item.id, {
    cursor,
    lastSyncedAt: new Date().toISOString(),
  });
  await captureNetWorthSnapshot(userId);

  return {
    imported,
    removed,
    accountsUpdated: accounts.length,
  };
}

export async function syncAllPlaidTransactions(userId) {
  const items = await listActivePlaidItemsByUser(userId);
  let imported = 0;
  let removed = 0;
  let itemsSynced = 0;

  for (const item of items) {
    const result = await syncPlaidItemTransactions(userId, item.id);
    imported += result.imported;
    removed += result.removed;
    itemsSynced += 1;
  }

  return { imported, removed, itemsSynced };
}

export async function disconnectPlaidAccount(userId, plaidAccountRowId) {
  const account = await getPlaidAccountById(userId, plaidAccountRowId);
  if (!account) {
    const err = new Error("Linked account not found.");
    err.status = 404;
    throw err;
  }

  await setPlaidAccountActive(userId, account.id, false);
  const deletedRecords = await deletePlaidRecordsByAccountId(userId, account.id);

  const activeCount = await countActivePlaidAccountsForItem(userId, account.plaid_item_ref);
  if (activeCount <= 0) {
    const item = await getPlaidItemById(userId, account.plaid_item_ref);
    if (item?.access_token) {
      try {
        await plaidRequest("/item/remove", { access_token: item.access_token });
      } catch {
        // Keep local cleanup even if remote unlink fails.
      }
    }
    await deletePlaidItemById(userId, account.plaid_item_ref);
  }

  await resetNetWorthSnapshots(userId);

  return {
    accountId: account.id,
    deletedRecords,
  };
}
