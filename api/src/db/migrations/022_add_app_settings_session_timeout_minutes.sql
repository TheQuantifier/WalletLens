-- src/db/migrations/022_add_app_settings_session_timeout_minutes.sql
-- Adds global inactivity timeout setting in minutes (1 to 60)

alter table app_settings
  add column if not exists session_timeout_minutes integer not null default 15;

alter table app_settings
  drop constraint if exists app_settings_session_timeout_minutes_range;

alter table app_settings
  add constraint app_settings_session_timeout_minutes_range
  check (session_timeout_minutes >= 1 and session_timeout_minutes <= 60);
