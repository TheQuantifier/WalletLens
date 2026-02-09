// src/controllers/app_settings.controller.js
import asyncHandler from "../middleware/async.js";
import { getAppSettings, updateAppSettings } from "../models/app_settings.model.js";
import { logActivity } from "../services/activity.service.js";

export const getPublic = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  res.json({ appName: settings?.app_name || "<AppName>" });
});

export const getAdmin = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  res.json({ settings });
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const { appName, receiptKeepFiles } = req.body;
  const hasAppName = appName !== undefined;
  const hasReceiptKeepFiles = receiptKeepFiles !== undefined;

  if (!hasAppName && !hasReceiptKeepFiles) {
    return res.status(400).json({ message: "At least one setting is required" });
  }

  if (hasAppName && !String(appName).trim()) {
    return res.status(400).json({ message: "appName must be a non-empty string" });
  }

  if (hasReceiptKeepFiles && typeof receiptKeepFiles !== "boolean") {
    return res.status(400).json({ message: "receiptKeepFiles must be a boolean" });
  }

  const updated = await updateAppSettings({
    appName: hasAppName ? String(appName).trim() : null,
    receiptKeepFiles: hasReceiptKeepFiles ? receiptKeepFiles : null,
    updatedBy: req.user.id,
  });

  await logActivity({
    userId: req.user.id,
    action: "app_settings_update",
    entityType: "app_settings",
    entityId: updated?.id || null,
    metadata: {
      appName: updated?.app_name,
      receiptKeepFiles: updated?.receipt_keep_files,
    },
    req,
  });

  res.json({ settings: updated });
});
