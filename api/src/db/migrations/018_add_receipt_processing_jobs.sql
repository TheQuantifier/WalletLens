-- src/db/migrations/018_add_receipt_processing_jobs.sql
-- Adds resilient async receipt processing state + DB-backed job queue.

alter table if exists receipts
  add column if not exists processing_status text not null default 'pending_upload'
    check (processing_status in ('pending_upload', 'queued', 'processing', 'processed', 'failed')),
  add column if not exists processing_stage text not null default 'uploaded',
  add column if not exists processing_error text not null default '',
  add column if not exists raw_ocr_text text not null default '',
  add column if not exists ai_model_version text not null default '',
  add column if not exists parse_confidence numeric(5,4),
  add column if not exists parse_warnings jsonb not null default '[]'::jsonb;

create index if not exists idx_receipts_user_processing_status
  on receipts (user_id, processing_status, created_at desc);

create table if not exists receipt_jobs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  job_type text not null default 'process_receipt',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_receipt_jobs_receipt_type
  on receipt_jobs (receipt_id, job_type);

create index if not exists idx_receipt_jobs_status_run_after
  on receipt_jobs (status, run_after, created_at);
