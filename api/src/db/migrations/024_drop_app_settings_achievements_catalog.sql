-- src/db/migrations/024_drop_app_settings_achievements_catalog.sql
-- Legacy cleanup: achievements catalog now lives in achievements_catalog table.

alter table app_settings
  drop column if exists achievements_catalog;
