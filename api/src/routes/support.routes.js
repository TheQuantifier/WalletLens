// src/routes/support.routes.js
import express from "express";

import * as controller from "../controllers/support.controller.js";
import auth from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate_limit.js";

const router = express.Router();
const publicSupportLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 6 });
const privateSupportLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

router.post("/public", publicSupportLimiter, controller.contactSupportPublic);

// Support contact endpoint (requires auth to capture user email)
router.post("/contact", privateSupportLimiter, auth, controller.contactSupport);

export default router;
