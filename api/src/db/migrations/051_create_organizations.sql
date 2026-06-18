create table if not exists organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  business_type text not null default '',
  industry text not null default '',
  email text not null default '',
  phone_number text not null default '',
  website text not null default '',
  address text not null default '',
  city text not null default '',
  region text not null default '',
  postal_code text not null default '',
  country text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into organizations (id, name)
select distinct organization_id, 'Existing organization'
from users
where organization_id is not null and btrim(organization_id) <> ''
on conflict (id) do nothing;

alter table users
  drop constraint if exists users_organization_id_fkey;

alter table users
  add constraint users_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete restrict;

create index if not exists idx_organizations_name on organizations (lower(name));
create index if not exists idx_organizations_email on organizations (lower(email));
