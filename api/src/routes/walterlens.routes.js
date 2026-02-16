// src/routes/walterlens.routes.js
import express from "express";
import auth from "../middleware/auth.js";
import * as controller from "../controllers/walterlens.controller.js";

const router = express.Router();

router.post("/chat", auth, controller.chat);

export default router;
