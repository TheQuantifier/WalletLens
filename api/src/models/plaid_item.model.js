import { query } from "../config/db.js";

export async function upsertPlaidItem({
  userId,
  plaidItemId,
  accessToken,
  institutionId = "",
  institutionName = "",
  status = "active",
  cursor = null,
  lastSyncedAt = null,
}) {
  const { rows } = await query(
    `
    insert into plaid_items
      (user_id, plaid_item_id, access_token, institution_id, institution_name, status, cursor, last_synced_at)
    values
      ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (plaid_item_id)
    do update set
      user_id = excluded.user_id,
      access_token = excluded.access_token,
      institution_id = excluded.institution_id,
      institution_name = excluded.institution_name,
      status = excluded.status,
      cursor = coalesce(excluded.cursor, plaid_items.cursor),
      last_synced_at = coalesce(excluded.last_synced_at, plaid_items.last_synced_at),
      updated_at = now()
    returning *
    `,
    [userId, plaidItemId, accessToken, institutionId || null, institutionName || null, status, cursor, lastSyncedAt]
  );

  return rows[0] || null;
}

export async function getPlaidItemById(userId, id) {
  const { rows } = await query(
    `
    select *
    from plaid_items
    where id = $1 and user_id = $2
    limit 1
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function getPlaidItemByPlaidItemId(userId, plaidItemId) {
  const { rows } = await query(
    `
    select *
    from plaid_items
    where plaid_item_id = $1 and user_id = $2
    limit 1
    `,
    [plaidItemId, userId]
  );
  return rows[0] || null;
}

export async function listActivePlaidItemsByUser(userId) {
  const { rows } = await query(
    `
    select *
    from plaid_items
    where user_id = $1 and status = 'active'
    order by created_at asc
    `,
    [userId]
  );
  return rows;
}

export async function listPlaidItemsByUser(userId) {
  const { rows } = await query(
    `
    select *
    from plaid_items
    where user_id = $1
    order by created_at asc
    `,
    [userId]
  );
  return rows;
}

export async function updatePlaidItemById(userId, id, changes = {}) {
  const allowed = {
    accessToken: "access_token",
    institutionId: "institution_id",
    institutionName: "institution_name",
    status: "status",
    cursor: "cursor",
    lastSyncedAt: "last_synced_at",
  };

  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, col] of Object.entries(allowed)) {
    if (changes[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      values.push(changes[key]);
    }
  }

  if (!sets.length) {
    return getPlaidItemById(userId, id);
  }

  values.push(id, userId);
  const { rows } = await query(
    `
    update plaid_items
    set ${sets.join(", ")},
        updated_at = now()
    where id = $${i++} and user_id = $${i++}
    returning *
    `,
    values
  );

  return rows[0] || null;
}

export async function deletePlaidItemById(userId, id) {
  const { rows } = await query(
    `
    delete from plaid_items
    where id = $1 and user_id = $2
    returning id
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function upsertPlaidAccount({
  userId,
  plaidItemRef,
  plaidAccountId,
  name,
  officialName = "",
  mask = "",
  type = "",
  subtype = "",
  currentBalance = null,
  availableBalance = null,
  currency = "USD",
  institutionName = "",
  isActive = true,
}) {
  const { rows } = await query(
    `
    insert into plaid_accounts
      (user_id, plaid_item_ref, plaid_account_id, name, official_name, mask, type, subtype,
       current_balance, available_balance, currency, institution_name, is_active)
    values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    on conflict (plaid_account_id)
    do update set
      user_id = excluded.user_id,
      plaid_item_ref = excluded.plaid_item_ref,
      name = excluded.name,
      official_name = excluded.official_name,
      mask = excluded.mask,
      type = excluded.type,
      subtype = excluded.subtype,
      current_balance = excluded.current_balance,
      available_balance = excluded.available_balance,
      currency = excluded.currency,
      institution_name = excluded.institution_name,
      is_active = excluded.is_active,
      updated_at = now()
    returning *
    `,
    [
      userId,
      plaidItemRef,
      plaidAccountId,
      name,
      officialName || null,
      mask || null,
      type || null,
      subtype || null,
      currentBalance,
      availableBalance,
      currency || "USD",
      institutionName || null,
      Boolean(isActive),
    ]
  );

  return rows[0] || null;
}

export async function listActivePlaidAccountsByUser(userId) {
  const { rows } = await query(
    `
    select
      plaid_accounts.*,
      plaid_items.plaid_item_id as plaid_item_external_id,
      plaid_items.institution_id
    from plaid_accounts
    join plaid_items on plaid_items.id = plaid_accounts.plaid_item_ref
    where plaid_accounts.user_id = $1
      and plaid_accounts.is_active = true
      and plaid_items.status = 'active'
    order by coalesce(plaid_accounts.institution_name, plaid_items.institution_name, ''), plaid_accounts.name
    `,
    [userId]
  );
  return rows;
}

export async function listPlaidAccountsByUser(userId) {
  const { rows } = await query(
    `
    select
      plaid_accounts.*,
      plaid_items.plaid_item_id as plaid_item_external_id,
      plaid_items.institution_id,
      plaid_items.status as plaid_item_status
    from plaid_accounts
    join plaid_items on plaid_items.id = plaid_accounts.plaid_item_ref
    where plaid_accounts.user_id = $1
    order by coalesce(plaid_accounts.institution_name, plaid_items.institution_name, ''), plaid_accounts.name
    `,
    [userId]
  );
  return rows;
}

export async function getPlaidAccountById(userId, id) {
  const { rows } = await query(
    `
    select *
    from plaid_accounts
    where id = $1 and user_id = $2
    limit 1
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function getPlaidAccountByExternalId(userId, plaidAccountId) {
  const { rows } = await query(
    `
    select *
    from plaid_accounts
    where plaid_account_id = $1 and user_id = $2
    limit 1
    `,
    [plaidAccountId, userId]
  );
  return rows[0] || null;
}

export async function countActivePlaidAccountsForItem(userId, plaidItemRef) {
  const { rows } = await query(
    `
    select count(*)::int as total
    from plaid_accounts
    where user_id = $1 and plaid_item_ref = $2 and is_active = true
    `,
    [userId, plaidItemRef]
  );
  return rows[0]?.total ?? 0;
}

export async function setPlaidAccountActive(userId, id, isActive) {
  const { rows } = await query(
    `
    update plaid_accounts
    set is_active = $1,
        updated_at = now()
    where id = $2 and user_id = $3
    returning *
    `,
    [Boolean(isActive), id, userId]
  );
  return rows[0] || null;
}
