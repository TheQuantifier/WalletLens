import {
  listActivePlaidAccountsByUser,
} from "../models/plaid_item.model.js";
import {
  deleteNetWorthSnapshotsByUser,
  listNetWorthItems,
  listNetWorthSnapshots,
  upsertNetWorthSnapshot,
} from "../models/net_worth.model.js";

const ASSET_TYPES = new Set(["depository", "investment", "brokerage", "other"]);
const LIABILITY_TYPES = new Set(["credit", "loan"]);

function getAccountBalance(account) {
  if (!account || typeof account !== "object") return 0;
  const direct =
    account.current_balance ??
    account.available_balance ??
    account.currentBalance ??
    account.availableBalance;
  if (Number.isFinite(Number(direct))) return Number(direct);
  const nested = account.balances || account.balanceInfo || {};
  const nestedValue = nested.current ?? nested.available ?? nested.balance;
  return Number.isFinite(Number(nestedValue)) ? Number(nestedValue) : 0;
}

function classifyPlaidAccount(account) {
  const amount = getAccountBalance(account);
  const type = String(account?.type || "").toLowerCase();

  if (LIABILITY_TYPES.has(type)) {
    return { asset: 0, liability: Math.abs(amount) };
  }
  if (ASSET_TYPES.has(type)) {
    return { asset: Math.abs(amount), liability: 0 };
  }
  if (amount < 0) {
    return { asset: 0, liability: Math.abs(amount) };
  }
  return { asset: Math.abs(amount), liability: 0 };
}

export async function computeNetWorthTotalsForUser(userId) {
  const [manualItems, plaidAccounts] = await Promise.all([
    listNetWorthItems(userId),
    listActivePlaidAccountsByUser(userId),
  ]);

  let assetsTotal = 0;
  let liabilitiesTotal = 0;

  (manualItems || []).forEach((item) => {
    const amount = Number(item?.amount || 0);
    if (!Number.isFinite(amount)) return;
    if (item?.type === "liability") {
      liabilitiesTotal += amount;
      return;
    }
    assetsTotal += amount;
  });

  (plaidAccounts || []).forEach((account) => {
    const classified = classifyPlaidAccount(account);
    assetsTotal += classified.asset;
    liabilitiesTotal += classified.liability;
  });

  return {
    assetsTotal,
    liabilitiesTotal,
    netWorth: assetsTotal - liabilitiesTotal,
    currency: "USD",
  };
}

export async function captureNetWorthSnapshot(userId, snapshotDate = new Date()) {
  const totals = await computeNetWorthTotalsForUser(userId);
  const dateOnly = new Date(snapshotDate).toISOString().slice(0, 10);
  return upsertNetWorthSnapshot(userId, {
    snapshotDate: dateOnly,
    assetsTotal: totals.assetsTotal,
    liabilitiesTotal: totals.liabilitiesTotal,
    netWorth: totals.netWorth,
    currency: totals.currency || "USD",
  });
}

export async function resetNetWorthSnapshots(userId, snapshotDate = new Date()) {
  await deleteNetWorthSnapshotsByUser(userId);
  return captureNetWorthSnapshot(userId, snapshotDate);
}

export async function getNetWorthOverview(userId, { days = 365 } = {}) {
  const [totals, snapshots] = await Promise.all([
    computeNetWorthTotalsForUser(userId),
    listNetWorthSnapshots(userId, { days }),
  ]);

  const byMonth = new Map();
  (snapshots || []).forEach((snapshot) => {
    const dateValue = String(snapshot?.snapshot_date || "").slice(0, 10);
    if (!dateValue) return;
    const monthKey = dateValue.slice(0, 7);
    const prev = byMonth.get(monthKey);
    if (!prev || dateValue > prev.snapshotDate) {
      byMonth.set(monthKey, {
        snapshotDate: dateValue,
        label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" }),
        value: Number(snapshot?.net_worth || 0),
      });
    }
  });

  const trend = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([, value]) => value);

  return {
    ...totals,
    trend,
    asOf: new Date().toISOString(),
  };
}
