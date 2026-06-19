alter table users
  add column if not exists platform_role text not null default 'user',
  add column if not exists active_organization_id text null references organizations(id) on delete set null;

update users set platform_role = case
  when role in ('org_user', 'org_admin') then 'user'
  else role
end;

update users set active_organization_id = organization_id
where organization_id is not null and role in ('org_user', 'org_admin');

alter table users drop constraint if exists users_platform_role_check;
alter table users add constraint users_platform_role_check
  check (platform_role in ('user', 'admin', 'support_admin', 'analyst'));

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  membership_role text not null default 'member',
  status text not null default 'active',
  invited_by uuid null references users(id) on delete set null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  constraint organization_memberships_role_check check (membership_role in ('member', 'admin')),
  constraint organization_memberships_status_check check (status in ('active', 'removed', 'archived'))
);

insert into organization_memberships (organization_id, user_id, membership_role)
select organization_id, id, case when role = 'org_admin' then 'admin' else 'member' end
from users
where organization_id is not null and role in ('org_user', 'org_admin')
on conflict (organization_id, user_id) do nothing;

create index if not exists idx_organization_memberships_user
  on organization_memberships (user_id, status);
create index if not exists idx_organization_memberships_org
  on organization_memberships (organization_id, status, membership_role);

create or replace function can_access_organization_resource(
  resource_user_id uuid,
  resource_organization_id text,
  actor_user_id uuid
) returns boolean language sql stable as $$
  select case
    when resource_organization_id is null then resource_user_id = actor_user_id
    else exists (
      select 1 from organization_memberships membership
      where membership.user_id = actor_user_id
        and membership.organization_id = resource_organization_id
        and membership.status = 'active'
    )
  end;
$$;
