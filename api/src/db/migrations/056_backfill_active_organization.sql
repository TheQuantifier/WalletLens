update users
set active_organization_id = organization_id,
    updated_at = now()
where active_organization_id is null
  and organization_id is not null
  and role in ('org_user', 'org_admin');
