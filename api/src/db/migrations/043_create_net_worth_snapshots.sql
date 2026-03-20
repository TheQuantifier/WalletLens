create table if not exists net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  snapshot_date date not null,
  assets_total numeric(14,2) not null default 0,
  liabilities_total numeric(14,2) not null default 0,
  net_worth numeric(14,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists idx_net_worth_snapshots_user_date
  on net_worth_snapshots (user_id, snapshot_date desc);
