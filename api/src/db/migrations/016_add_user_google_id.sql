-- api/src/db/migrations/016_add_user_google_id.sql
-- Adds Google identity linkage for OAuth login/register

alter table users
  add column if not exists google_id text;

create unique index if not exists users_google_id_unique
  on users (google_id)
  where google_id is not null;
