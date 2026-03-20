create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plaid_item_id text not null unique,
  access_token text not null,
  institution_id text,
  institution_name text,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plaid_items_user_id on plaid_items (user_id);
create index if not exists idx_plaid_items_user_status on plaid_items (user_id, status);

create table if not exists plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plaid_item_ref uuid not null references plaid_items(id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null,
  official_name text,
  mask text,
  type text,
  subtype text,
  current_balance numeric(12,2),
  available_balance numeric(12,2),
  currency text not null default 'USD',
  institution_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plaid_accounts_user_id on plaid_accounts (user_id);
create index if not exists idx_plaid_accounts_item_ref on plaid_accounts (plaid_item_ref);
create index if not exists idx_plaid_accounts_user_active on plaid_accounts (user_id, is_active);

alter table records
  add column if not exists linked_plaid_account_id uuid null references plaid_accounts(id) on delete set null;

alter table records
  add column if not exists plaid_transaction_id text null;

alter table records
  add column if not exists currency text not null default 'USD';

create unique index if not exists idx_records_plaid_transaction_id
  on records (plaid_transaction_id)
  where plaid_transaction_id is not null;

create index if not exists idx_records_linked_plaid_account
  on records (linked_plaid_account_id)
  where linked_plaid_account_id is not null;

alter table records
  drop constraint if exists records_origin_check;

alter table records
  add constraint records_origin_check
  check (origin in ('manual', 'receipt', 'recurring', 'plaid'));
