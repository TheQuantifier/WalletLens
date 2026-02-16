// src/routes/admin.routes.js
import express from "express";

import auth from "../middleware/auth.js";
import requireAdmin from "../middleware/require_admin.js";
import {
  listUsersAdmin,
  listUserOptionsAdmin,
  getUserAdmin,
  updateUserAdmin,
  getAdminStatsController,
  listRecordsAdminController,
  listReceiptsAdminController,
  listBudgetSheetsAdminController,
  getRecordAdmin,
  updateRecordAdminController,
  deleteRecordAdminController,
} from "../controllers/admin.controller.js";
import {
  getAdmin as getAppSettingsAdmin,
  updateAdmin as updateAppSettingsAdmin,
} from "../controllers/app_settings.controller.js";

const router = express.Router();

router.use(auth, requireAdmin);

// Users
router.get("/users", listUsersAdmin);
router.get("/users/options", listUserOptionsAdmin);
router.get("/users/:id", getUserAdmin);
router.put("/users/:id", updateUserAdmin);

// Stats
router.get("/stats", getAdminStatsController);

// Records
router.get("/records", listRecordsAdminController);
router.get("/records/:id", getRecordAdmin);
router.put("/records/:id", updateRecordAdminController);
router.delete("/records/:id", deleteRecordAdminController);

// Receipts
router.get("/receipts", listReceiptsAdminController);

// Budget sheets
router.get("/budget-sheets", listBudgetSheetsAdminController);

// App settings
router.get("/settings", getAppSettingsAdmin);
router.put("/settings", updateAppSettingsAdmin);

export default router;
