-- api/src/db/migrations/015_add_user_identity_fields.sql
-- Adds identity fields to users table

alter table users
  add column if not exists address text not null default '',
  add column if not exists employer text not null default '',
  add column if not exists income_range text not null default '';
