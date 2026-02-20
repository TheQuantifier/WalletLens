-- src/db/migrations/011_create_net_worth_items.sql
-- Creates net_worth_items table for assets/liabilities

create table if not exists net_worth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('asset', 'liability')),
  name text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_net_worth_items_user_id
  on net_worth_items (user_id);

create index if not exists idx_net_worth_items_user_type
  on net_worth_items (user_id, type);
