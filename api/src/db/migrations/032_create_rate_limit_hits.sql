-- src/db/migrations/032_create_rate_limit_hits.sql
-- Shared, DB-backed rate limiter state for multi-instance deployments.

create table if not exists rate_limit_hits (
  key text primary key,
  count integer not null default 1,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_hits_reset_at
  on rate_limit_hits (reset_at);
