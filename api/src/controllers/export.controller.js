import asyncHandler from "../middleware/async.js";
import { query } from "../config/db.js";
import { findUserById, getUserNotificationSettings } from "../models/user.model.js";
import { listAllRecordsForUser } from "../models/record.model.js";
import { listReceipts } from "../models/receipt.model.js";
import { listBudgetSheets } from "../models/budget_sheet.model.js";
import { listRecurringSchedules } from "../models/recurring.model.js";
import { listRulesByUser } from "../models/rule.model.js";
import { listNetWorthItems, listNetWorthSnapshots } from "../models/net_worth.model.js";
import { listUnlockedAchievementsForUser } from "../models/achievement.model.js";
import { listActivePlaidAccountsByUser, listActivePlaidItemsByUser } from "../models/plaid_item.model.js";

export const exportAllData = asyncHandler(async (req, res) => {
  const [profile, notificationSettings, records, receipts, budgetSheets, recurring, rules, netWorth, netWorthSnapshots, plaidItems, plaidAccounts, achievements, activity] =
    await Promise.all([
      findUserById(req.user.id),
      getUserNotificationSettings(req.user.id),
      listAllRecordsForUser(req.user.id),
      listReceipts(req.user.id, { limit: 5000, offset: 0 }),
      listBudgetSheets(req.user.id, { limit: 1000 }),
      listRecurringSchedules(req.user.id, {}),
      listRulesByUser(req.user.id, {}),
      listNetWorthItems(req.user.id),
      listNetWorthSnapshots(req.user.id, { days: 3650 }),
      listActivePlaidItemsByUser(req.user.id),
      listActivePlaidAccountsByUser(req.user.id),
      listUnlockedAchievementsForUser(req.user.id),
      query(
        `
        SELECT created_at, action, entity_type, entity_id, metadata
        FROM activity_log
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5000
        `,
        [req.user.id]
      ).then((result) => result.rows || []),
    ]);

  res.json({
    exportedAt: new Date().toISOString(),
    profile: {
      ...profile,
      notification_email_enabled: Boolean(notificationSettings?.notification_email_enabled),
      notification_sms_enabled: Boolean(notificationSettings?.notification_sms_enabled),
    },
    records,
    receipts,
    budgetSheets,
    recurring,
    rules,
    netWorth,
    netWorthSnapshots,
    plaidItems,
    plaidAccounts,
    achievements,
    activity,
  });
});
