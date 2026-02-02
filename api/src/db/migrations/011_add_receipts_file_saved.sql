-- src/db/migrations/011_add_receipts_file_saved.sql
-- Add file_saved flag to receipts

alter table if exists receipts
  add column if not exists file_saved boolean not null default true;
