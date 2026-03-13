-- Creates recurring schedules used across the recurring page and dashboard widgets.

create table if not exists recurring_schedules (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references users(id) on delete cascade,

  name text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount >= 0),
  category text not null,
  note text not null default '',

  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  day_of_month integer null check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date null,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_date is null or end_date >= start_date)
);

create index if not exists idx_recurring_schedules_user_id
  on recurring_schedules (user_id);

create index if not exists idx_recurring_schedules_user_active
  on recurring_schedules (user_id, active);

create index if not exists idx_recurring_schedules_user_start_date
  on recurring_schedules (user_id, start_date);
