-- Removes unused data safety settings from app_settings.
ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_data_retention_days_check;

ALTER TABLE app_settings
DROP COLUMN IF EXISTS data_retention_days,
DROP COLUMN IF EXISTS backup_status,
DROP COLUMN IF EXISTS last_backup_at;
