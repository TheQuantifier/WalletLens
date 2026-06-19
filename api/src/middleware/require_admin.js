// src/middleware/require_admin.js
export default function requireAdmin(req, res, next) {
  const platformRole = String(req.user?.platform_role || "").trim();
  const role = platformRole && platformRole !== "user" ? platformRole : String(req.user?.role || "").trim();
  if (!["admin", "org_admin", "support_admin", "analyst"].includes(role)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}
