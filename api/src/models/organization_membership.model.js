import { query } from "../config/db.js";

export async function upsertOrganizationMembership({ organizationId, userId, membershipRole = "member", invitedBy = null, executor = query }) {
  const { rows } = await executor(
    `INSERT INTO organization_memberships (organization_id, user_id, membership_role, status, invited_by)
     VALUES ($1, $2, $3, 'active', $4)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET membership_role = excluded.membership_role,
       status = 'active', invited_by = COALESCE(excluded.invited_by, organization_memberships.invited_by),
       removed_at = NULL, updated_at = now()
     RETURNING *`,
    [organizationId, userId, membershipRole, invitedBy]
  );
  return rows[0];
}

export async function listUserOrganizations(userId) {
  const { rows } = await query(
    `SELECT m.id AS membership_id, m.organization_id, m.membership_role, m.status,
       o.name, o.logo_url, o.subscription_status, o.access_expires_at
     FROM organization_memberships m JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id = $1 AND m.status = 'active' ORDER BY lower(o.name)`,
    [userId]
  );
  return rows;
}

export async function setActiveOrganization(userId, organizationId, executor = query) {
  const { rows } = await executor(
    `SELECT membership_role FROM organization_memberships
     WHERE user_id = $1 AND organization_id = $2 AND status = 'active' LIMIT 1`,
    [userId, organizationId]
  );
  if (!rows[0]) return null;
  const effectiveRole = rows[0].membership_role === "admin" ? "org_admin" : "org_user";
  const { rows: userRows } = await executor(
    `UPDATE users SET active_organization_id = $1, organization_id = $1, role = $2, updated_at = now()
     WHERE id = $3 RETURNING id`,
    [organizationId, effectiveRole, userId]
  );
  return userRows[0] ? { organizationId, membershipRole: rows[0].membership_role, effectiveRole } : null;
}

export async function clearActiveOrganization(userId, executor = query) {
  await executor(
    `UPDATE users SET active_organization_id = NULL, organization_id = NULL, role = platform_role, updated_at = now()
     WHERE id = $1`,
    [userId]
  );
}
