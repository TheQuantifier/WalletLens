-- src/db/migrations/015_add_receipt_keep_files.sql
-- Add receipt_keep_files flag to app_settings

alter table app_settings
  add column if not exists receipt_keep_files boolean not null default true;
