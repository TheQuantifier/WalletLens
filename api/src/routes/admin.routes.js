// src/routes/admin.routes.js
import express from "express";

import auth from "../middleware/auth.js";
import requireAdmin from "../middleware/require_admin.js";
import requireAdminPermission from "../middleware/require_admin_permission.js";
import {
  listUsersAdmin,
  listUserOptionsAdmin,
  getUserAdmin,
  updateUserAdmin,
  forceLogoutAllUsersAdmin,
  getAdminStatsController,
  getAdminPermissionsController,
  listRecordsAdminController,
  listReceiptsAdminController,
  listBudgetSheetsAdminController,
  getRecordAdmin,
  updateRecordAdminController,
  deleteRecordAdminController,
  listAuditLogAdmin,
  listSupportTicketsAdmin,
  updateSupportTicketAdmin,
  getSystemHealthAdmin,
  testSystemHealthServiceAdmin,
  deactivateSystemHealthServiceAdmin,
  activateSystemHealthServiceAdmin,
  emergencyActivateDatabaseConnectionAdmin,
} from "../controllers/admin.controller.js";
import {
  getAdmin as getAppSettingsAdmin,
  updateAdmin as updateAppSettingsAdmin,
} from "../controllers/app_settings.controller.js";
import {
  createAdmin as createNotificationAdmin,
  listAdmin as listNotificationsAdmin,
  updateAdmin as updateNotificationAdmin,
  resendAdmin as resendNotificationAdmin,
} from "../controllers/notifications.controller.js";

const router = express.Router();

router.post(
  "/system-health/database_connection/emergency-activate",
  emergencyActivateDatabaseConnectionAdmin
);

router.use(auth, requireAdmin);

router.get("/permissions", getAdminPermissionsController);

// Users
router.get("/users", requireAdminPermission("users.read"), listUsersAdmin);
router.get("/users/options", requireAdminPermission("users.read"), listUserOptionsAdmin);
router.get("/users/:id", requireAdminPermission("users.read"), getUserAdmin);
router.put("/users/:id", requireAdminPermission("users.write"), updateUserAdmin);
router.post(
  "/sessions/force-logout-all",
  requireAdminPermission("settings.write"),
  forceLogoutAllUsersAdmin
);

// Stats
router.get("/stats", requireAdminPermission("health.read"), getAdminStatsController);

// Records
router.get("/records", requireAdminPermission("records.read"), listRecordsAdminController);
router.get("/records/:id", requireAdminPermission("records.read"), getRecordAdmin);
router.put("/records/:id", requireAdminPermission("records.write"), updateRecordAdminController);
router.delete("/records/:id", requireAdminPermission("records.write"), deleteRecordAdminController);

// Receipts
router.get("/receipts", requireAdminPermission("records.read"), listReceiptsAdminController);

// Budget sheets
router.get("/budget-sheets", requireAdminPermission("records.read"), listBudgetSheetsAdminController);

// App settings
router.get("/settings", requireAdminPermission("settings.read"), getAppSettingsAdmin);
router.put("/settings", requireAdminPermission("settings.write"), updateAppSettingsAdmin);

// Notifications
router.get("/notifications", requireAdminPermission("notifications.read"), listNotificationsAdmin);
router.post("/notifications", requireAdminPermission("notifications.write"), createNotificationAdmin);
router.patch("/notifications/:id", requireAdminPermission("notifications.write"), updateNotificationAdmin);
router.post("/notifications/:id/resend", requireAdminPermission("notifications.write"), resendNotificationAdmin);

// Audit log
router.get("/audit-log", requireAdminPermission("audit.read"), listAuditLogAdmin);

// Support inbox
router.get("/support-tickets", requireAdminPermission("support.read"), listSupportTicketsAdmin);
router.put("/support-tickets/:id", requireAdminPermission("support.write"), updateSupportTicketAdmin);

// System health
router.get("/system-health", requireAdminPermission("health.read"), getSystemHealthAdmin);
router.post("/system-health/:serviceId/test", requireAdminPermission("health.read"), testSystemHealthServiceAdmin);
router.post("/system-health/:serviceId/deactivate", requireAdminPermission("health.write"), deactivateSystemHealthServiceAdmin);
router.post("/system-health/:serviceId/activate", requireAdminPermission("health.write"), activateSystemHealthServiceAdmin);

export default router;
