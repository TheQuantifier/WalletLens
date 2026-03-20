// src/middleware/require_admin.js
export default function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "").trim();
  if (!["admin", "org_admin", "support_admin", "analyst"].includes(role)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}
