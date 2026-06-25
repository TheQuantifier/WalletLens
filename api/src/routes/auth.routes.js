// src/routes/auth.routes.js
import express from "express";

import * as controller from "../controllers/auth.controller.js";
import auth from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate_limit.js";

const router = express.Router();
const registerLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12 });
const twoFaLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const oauthLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 40 });

// --------------------------------------------------
// PUBLIC ROUTES
// --------------------------------------------------
router.get("/google/config", controller.googleConfig);
router.get("/google/start", oauthLimiter, controller.googleStart);
router.get("/google/callback", oauthLimiter, controller.googleCallback);

router.post("/register", registerLimiter, controller.register);
router.post("/register-business", registerLimiter, controller.registerBusiness);
router.get("/invitations/:token", controller.getOrganizationInvitation);
router.post("/invitations/:token/accept", registerLimiter, controller.acceptOrganizationMemberInvitation);

// Login expects: { identifier, password }
// Controller supports username OR email
router.post("/login", loginLimiter, controller.login);
router.post("/forgot-password", loginLimiter, controller.requestPasswordResetLogin);
router.post("/forgot-password/verify", twoFaLimiter, controller.verifyPasswordResetLogin);

// 2FA login verify
router.post("/2fa/verify-login", twoFaLimiter, controller.verifyTwoFaLogin);

// --------------------------------------------------
// PROTECTED LOGOUT (requires auth)
// --------------------------------------------------
router.post("/logout", auth, controller.logout);

// --------------------------------------------------
// AUTHENTICATED USER ROUTES
// --------------------------------------------------
router.get("/me", auth, controller.me);
router.get("/organizations", auth, controller.listMyOrganizations);
router.post("/organizations", auth, registerLimiter, controller.createAdditionalBusiness);
router.post("/organizations/active", auth, controller.switchActiveOrganization);
router.post("/invitations/:token/accept-existing", auth, controller.acceptExistingOrganizationInvitation);
router.put("/me", auth, controller.updateMe);

// Change password for current user
// Body: { currentPassword, newPassword }
router.post("/change-password", auth, controller.changePassword);
router.post("/2fa/request-password-change", auth, controller.requestTwoFaPasswordChange);
router.post("/security-code/request", auth, twoFaLimiter, controller.requestSecurityCode);

// 2FA (optional) management
router.post("/2fa/request-enable", auth, controller.requestTwoFaEnable);
router.post("/2fa/confirm-enable", auth, controller.confirmTwoFaEnable);
router.post("/2fa/disable", auth, controller.disableTwoFa);

// Active sessions
router.get("/sessions", auth, controller.listSessions);
router.post("/sessions/logout-all", auth, controller.logoutAll);

// Delete current user account and all related data
router.delete("/me", auth, controller.deleteMe);

export default router;
