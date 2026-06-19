create table if not exists organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references organizations(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  invited_by uuid null references users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organization_invitations_org
  on organization_invitations (organization_id, created_at desc);

create unique index if not exists idx_organization_invitations_pending_email
  on organization_invitations (organization_id, lower(email))
  where accepted_at is null and revoked_at is null;
