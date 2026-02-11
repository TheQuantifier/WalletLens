// src/routes/index.js
import express from "express";

import authRoutes from "./auth.routes.js";
import recordsRoutes from "./records.routes.js";
import receiptsRoutes from "./receipts.routes.js";
import budgetSheetsRoutes from "./budget_sheets.routes.js";
import fxRatesRoutes from "./fx_rates.routes.js";
import activityRoutes from "./activity.routes.js";
import supportRoutes from "./support.routes.js";
import adminRoutes from "./admin.routes.js";
import appSettingsRoutes from "./app_settings.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/records", recordsRoutes);
router.use("/receipts", receiptsRoutes);
router.use("/budget-sheets", budgetSheetsRoutes);
router.use("/fx-rates", fxRatesRoutes);
router.use("/activity", activityRoutes);
router.use("/support", supportRoutes);
router.use("/admin", adminRoutes);
router.use("/app-settings", appSettingsRoutes);

export default router;
