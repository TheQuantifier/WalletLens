create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  apply_mode text not null check (apply_mode in ('first', 'all')) default 'first',
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rules_user_priority
  on rules (user_id, enabled, priority desc, created_at asc);
