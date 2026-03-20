import asyncHandler from "../middleware/async.js";
import { listActivePlaidAccountsByUser } from "../models/plaid_item.model.js";
import { logActivity } from "../services/activity.service.js";
import {
  createPlaidLinkToken,
  disconnectPlaidAccount,
  exchangePublicTokenAndImport,
  isPlaidConfigured,
  syncAllPlaidTransactions,
} from "../services/plaid.service.js";

function normalizeAccount(account) {
  return {
    id: account.id,
    plaidAccountId: account.plaid_account_id,
    plaidItemId: account.plaid_item_external_id,
    institutionId: account.institution_id || "",
    institutionName: account.institution_name || "",
    name: account.name,
    officialName: account.official_name || "",
    mask: account.mask || "",
    type: account.type || "",
    subtype: account.subtype || "",
    currentBalance: account.current_balance === null ? null : Number(account.current_balance),
    availableBalance: account.available_balance === null ? null : Number(account.available_balance),
    currency: account.currency || "USD",
    isActive: Boolean(account.is_active),
  };
}

export const getAccounts = asyncHandler(async (req, res) => {
  const accounts = await listActivePlaidAccountsByUser(req.user.id);
  res.json({
    configured: isPlaidConfigured(),
    accounts: accounts.map(normalizeAccount),
  });
});

export const createLinkToken = asyncHandler(async (req, res) => {
  const token = await createPlaidLinkToken(req.user);
  res.json({
    configured: true,
    ...token,
  });
});

export const exchangePublicToken = asyncHandler(async (req, res) => {
  const publicToken = String(req.body?.publicToken || "").trim();
  if (!publicToken) {
    return res.status(400).json({ message: "publicToken is required." });
  }

  const result = await exchangePublicTokenAndImport({
    user: req.user,
    publicToken,
    institution: req.body?.institution || null,
  });

  await logActivity({
    userId: req.user.id,
    action: "plaid_link",
    entityType: "plaid_item",
    entityId: result?.item?.id || null,
    metadata: {
      accountsLinked: Array.isArray(result.accounts) ? result.accounts.length : 0,
      importedTransactions: result?.sync?.imported || 0,
    },
    req,
  });

  res.status(201).json({
    itemId: result?.item?.id || null,
    accounts: (result.accounts || []).map(normalizeAccount),
    sync: result.sync,
  });
});

export const syncTransactions = asyncHandler(async (req, res) => {
  const result = await syncAllPlaidTransactions(req.user.id);
  const accounts = await listActivePlaidAccountsByUser(req.user.id);

  await logActivity({
    userId: req.user.id,
    action: "plaid_sync",
    entityType: "plaid_item",
    metadata: result,
    req,
  });

  res.json({
    sync: result,
    accounts: accounts.map(normalizeAccount),
  });
});

export const removeAccount = asyncHandler(async (req, res) => {
  const result = await disconnectPlaidAccount(req.user.id, req.params.id);

  await logActivity({
    userId: req.user.id,
    action: "plaid_unlink",
    entityType: "plaid_account",
    entityId: req.params.id,
    metadata: result,
    req,
  });

  res.json({
    message: "Linked account removed.",
    ...result,
  });
});
