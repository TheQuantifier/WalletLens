alter table users
  alter column access_expires_at drop not null;

update users
set access_expires_at = null,
    updated_at = now()
where lower(role) in ('admin', 'org_admin', 'support_admin', 'analyst');
