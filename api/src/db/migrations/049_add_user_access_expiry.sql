alter table users
  add column if not exists trial_started_at timestamptz not null default now(),
  add column if not exists access_expires_at timestamptz not null default (now() + interval '14 days');

create index if not exists idx_users_access_expires_at on users (access_expires_at);
