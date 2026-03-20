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
import settingsRoutes from "./settings.routes.js";
import walterlensRoutes from "./walterlens.routes.js";
import netWorthRoutes from "./net_worth.routes.js";
import achievementsRoutes from "./achievements.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import rulesRoutes from "./rules.routes.js";
import recurringRoutes from "./recurring.routes.js";
import plaidRoutes from "./plaid.routes.js";

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
router.use("/settings", settingsRoutes);
router.use("/walterlens", walterlensRoutes);
router.use("/net-worth", netWorthRoutes);
router.use("/achievements", achievementsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/rules", rulesRoutes);
router.use("/recurring", recurringRoutes);
router.use("/plaid", plaidRoutes);

export default router;
