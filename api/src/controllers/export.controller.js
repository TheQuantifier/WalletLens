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
import { getPlanningSheet } from "../models/planning_sheet.model.js";

export const exportAllData = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization_id || null;
  const organizationExport = organizationId
    ? query(`SELECT * FROM organizations WHERE id = $1`, [organizationId]).then((result) => result.rows[0] || null)
    : Promise.resolve(null);
  const memberExport = organizationId
    ? query(
      `SELECT u.id, u.username, u.email, u.full_name, m.membership_role, m.joined_at
       FROM organization_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1 AND m.status = 'active' ORDER BY lower(u.full_name), lower(u.email)`,
      [organizationId]
    ).then((result) => result.rows || [])
    : Promise.resolve([]);
  const [profile, notificationSettings, records, receipts, budgetSheets, planningSheet, recurring, rules, netWorth, netWorthSnapshots, plaidItems, plaidAccounts, achievements, activity] =
    await Promise.all([
      findUserById(req.user.id),
      getUserNotificationSettings(req.user.id),
      listAllRecordsForUser(req.user.id),
      listReceipts(req.user.id, { limit: 5000, offset: 0 }),
      listBudgetSheets(req.user.id, { limit: 1000 }),
      getPlanningSheet(req.user.id),
      listRecurringSchedules(req.user.id, {}),
      listRulesByUser(req.user.id, {}),
      listNetWorthItems(req.user.id),
      listNetWorthSnapshots(req.user.id, { days: 3650 }),
      listActivePlaidItemsByUser(req.user.id),
      listActivePlaidAccountsByUser(req.user.id),
      organizationId ? Promise.resolve([]) : listUnlockedAchievementsForUser(req.user.id),
      query(
        `
        SELECT created_at, action, entity_type, entity_id, metadata
        FROM activity_log
        WHERE user_id = $1
          AND ($2::text IS NULL OR metadata->>'organizationId' = $2)
        ORDER BY created_at DESC
        LIMIT 5000
        `,
        [req.user.id, organizationId]
      ).then((result) => result.rows || []),
    ]);

  const [organization, members] = await Promise.all([organizationExport, memberExport]);
  res.json({
    exportedAt: new Date().toISOString(),
    accountContext: organizationId ? "business" : "personal",
    organization,
    members,
    profile: organizationId ? {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
    } : {
      ...profile,
      notification_email_enabled: Boolean(notificationSettings?.notification_email_enabled),
      notification_sms_enabled: Boolean(notificationSettings?.notification_sms_enabled),
    },
    records,
    receipts,
    budgetSheets,
    planningSheet,
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
