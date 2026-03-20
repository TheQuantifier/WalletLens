alter table users
  add column if not exists organization_id text null;

update users
set organization_id = 'legacy-org'
where role in ('student', 'student_admin')
  and (organization_id is null or trim(organization_id) = '');

update users
set role = 'org_user'
where role = 'student';

update users
set role = 'org_admin'
where role = 'student_admin';

alter table users
  drop constraint if exists users_role_check;

alter table users
  add constraint users_role_check
  check (role in ('user', 'org_user', 'admin', 'org_admin', 'support_admin', 'analyst'));

create index if not exists idx_users_organization_id on users (organization_id);
create index if not exists idx_users_role_organization_id on users (role, organization_id);
