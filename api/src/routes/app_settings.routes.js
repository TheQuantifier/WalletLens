// src/routes/app_settings.routes.js
import express from "express";
import { getPublic } from "../controllers/app_settings.controller.js";

const router = express.Router();

router.get("/public", getPublic);

export default router;
