-- api/src/db/migrations/017_make_user_password_nullable.sql
-- Allows Google-only accounts to be created without a password.

alter table users
  alter column password_hash drop not null;
