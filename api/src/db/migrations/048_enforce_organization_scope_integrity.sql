update users
set organization_id = concat('unassigned-org-', id::text)
where role in ('org_user', 'org_admin')
  and (organization_id is null or btrim(organization_id) = '');

alter table users
  drop constraint if exists users_organization_scope_check;

alter table users
  add constraint users_organization_scope_check
  check (
    (
      role in ('org_user', 'org_admin')
      and organization_id is not null
      and btrim(organization_id) <> ''
    )
    or (
      role not in ('org_user', 'org_admin')
    )
  );

update users
set organization_id = null
where role not in ('org_user', 'org_admin')
  and organization_id is not null
  and btrim(organization_id) = '';

update notifications
set organization_id = null
where audience <> 'organization'
  and organization_id is not null
  and btrim(organization_id) = '';

update notifications
set organization_id = concat('unassigned-notification-', id::text)
where audience = 'organization'
  and (organization_id is null or btrim(organization_id) = '');

alter table notifications
  drop constraint if exists notifications_organization_scope_check;

alter table notifications
  add constraint notifications_organization_scope_check
  check (
    (
      audience = 'organization'
      and organization_id is not null
      and btrim(organization_id) <> ''
    )
    or (
      audience <> 'organization'
    )
  );
