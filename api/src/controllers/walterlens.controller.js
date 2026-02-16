// src/controllers/walterlens.controller.js
import asyncHandler from "../middleware/async.js";
import { runWalterLensChat } from "../services/walterlens_chat.service.js";

export const chat = asyncHandler(async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const context = req.body?.context || {};

  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }

  const result = await runWalterLensChat({ message, context });
  res.json(result);
});
