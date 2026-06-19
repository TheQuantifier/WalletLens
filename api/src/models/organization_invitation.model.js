import { query } from "../config/db.js";

const INVITATION_COLUMNS = `
  i.id, i.organization_id, i.email, i.invited_by, i.expires_at,
  i.accepted_at, i.revoked_at, i.custom_message, i.delivery_status,
  i.delivery_error, i.sent_at, i.created_at, i.updated_at
`;

export async function createOrganizationInvitation({
  organizationId,
  email,
  tokenHash,
  invitedBy,
  expiresAt,
  customMessage = "",
  executor = query,
}) {
  const { rows } = await executor(
    `INSERT INTO organization_invitations
      (organization_id, email, token_hash, invited_by, expires_at, custom_message)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, email, invited_by, expires_at,
       accepted_at, revoked_at, custom_message, delivery_status, delivery_error, sent_at, created_at, updated_at`,
    [organizationId, String(email).toLowerCase().trim(), tokenHash, invitedBy, expiresAt, customMessage]
  );
  return rows[0];
}

export async function findOrganizationInvitationById(id, organizationId) {
  const { rows } = await query(
    `SELECT ${INVITATION_COLUMNS} FROM organization_invitations i
     WHERE i.id = $1 AND i.organization_id = $2 LIMIT 1`,
    [id, organizationId]
  );
  return rows[0] || null;
}

export async function rotateOrganizationInvitation(id, organizationId, tokenHash, expiresAt) {
  const { rows } = await query(
    `UPDATE organization_invitations SET token_hash = $1, expires_at = $2,
       revoked_at = NULL, delivery_status = 'pending', delivery_error = '', updated_at = now()
     WHERE id = $3 AND organization_id = $4 AND accepted_at IS NULL
     RETURNING id, organization_id, email, invited_by, expires_at, accepted_at, revoked_at,
       custom_message, delivery_status, delivery_error, sent_at, created_at, updated_at`,
    [tokenHash, expiresAt, id, organizationId]
  );
  return rows[0] || null;
}

export async function updateInvitationDelivery(id, status, errorMessage = "") {
  const { rows } = await query(
    `UPDATE organization_invitations SET delivery_status = $1, delivery_error = $2,
       sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END, updated_at = now()
     WHERE id = $3 RETURNING id`,
    [status, errorMessage, id]
  );
  return rows[0] || null;
}

export async function listOrganizationInvitations(organizationId) {
  const { rows } = await query(
    `SELECT ${INVITATION_COLUMNS}
     FROM organization_invitations i
     WHERE i.organization_id = $1
     ORDER BY i.created_at DESC`,
    [organizationId]
  );
  return rows;
}

export async function revokePendingInvitationByEmail(organizationId, email, executor = query) {
  await executor(
    `UPDATE organization_invitations
     SET revoked_at = now(), updated_at = now()
     WHERE organization_id = $1 AND lower(email) = $2
       AND accepted_at IS NULL AND revoked_at IS NULL`,
    [organizationId, String(email).toLowerCase().trim()]
  );
}

export async function revokeOrganizationInvitation(id, organizationId) {
  const { rows } = await query(
    `UPDATE organization_invitations
     SET revoked_at = now(), updated_at = now()
     WHERE id = $1 AND organization_id = $2
       AND accepted_at IS NULL AND revoked_at IS NULL
     RETURNING id`,
    [id, organizationId]
  );
  return rows[0] || null;
}

export async function findInvitationByTokenHash(tokenHash, executor = query, { forUpdate = false } = {}) {
  const { rows } = await executor(
    `SELECT ${INVITATION_COLUMNS}, o.name AS organization_name
     FROM organization_invitations i
     JOIN organizations o ON o.id = i.organization_id
     WHERE i.token_hash = $1
     LIMIT 1${forUpdate ? " FOR UPDATE OF i" : ""}`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function acceptOrganizationInvitation(id, executor = query) {
  const { rows } = await executor(
    `UPDATE organization_invitations
     SET accepted_at = now(), updated_at = now()
     WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
     RETURNING id`,
    [id]
  );
  return rows[0] || null;
}
