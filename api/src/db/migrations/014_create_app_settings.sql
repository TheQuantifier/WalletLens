-- src/db/migrations/014_create_app_settings.sql
-- Stores global app settings (single-row table)

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  app_name text not null default '<AppName>',
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure a single row exists
insert into app_settings (app_name)
select '<AppName>'
where not exists (select 1 from app_settings);
