-- Adds extended admin-configurable application settings.
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS max_concurrent_sessions_per_user integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS require_2fa_for_admin_roles boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS weekly_digest_day_of_week integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS weekly_digest_time text NOT NULL DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS weekly_digest_timezone text NOT NULL DEFAULT 'America/Chicago',
ADD COLUMN IF NOT EXISTS pause_non_security_emails boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS pause_all_notifications boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS max_upload_size_mb integer NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS ocr_timeout_seconds integer NOT NULL DEFAULT 25,
ADD COLUMN IF NOT EXISTS ocr_retry_limit integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_data_export_format text NOT NULL DEFAULT 'csv',
ADD COLUMN IF NOT EXISTS maintenance_mode_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS maintenance_mode_banner_text text NOT NULL DEFAULT '';

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_max_concurrent_sessions_per_user_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_max_concurrent_sessions_per_user_check
CHECK (
  max_concurrent_sessions_per_user >= 0
);

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_weekly_digest_day_of_week_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_weekly_digest_day_of_week_check
CHECK (weekly_digest_day_of_week >= 0 AND weekly_digest_day_of_week <= 6);

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_weekly_digest_time_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_weekly_digest_time_check
CHECK (weekly_digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_max_upload_size_mb_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_max_upload_size_mb_check
CHECK (max_upload_size_mb >= 1 AND max_upload_size_mb <= 250);

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_ocr_timeout_seconds_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_ocr_timeout_seconds_check
CHECK (ocr_timeout_seconds >= 5 AND ocr_timeout_seconds <= 300);

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_ocr_retry_limit_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_ocr_retry_limit_check
CHECK (ocr_retry_limit >= 0 AND ocr_retry_limit <= 5);

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_default_data_export_format_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_default_data_export_format_check
CHECK (default_data_export_format IN ('csv', 'json'));

UPDATE app_settings
SET weekly_digest_day_of_week = 1
WHERE weekly_digest_day_of_week IS NULL
   OR weekly_digest_day_of_week < 0
   OR weekly_digest_day_of_week > 6;

UPDATE app_settings
SET weekly_digest_time = '09:00'
WHERE weekly_digest_time IS NULL
   OR weekly_digest_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

UPDATE app_settings
SET weekly_digest_timezone = 'America/Chicago'
WHERE weekly_digest_timezone IS NULL
   OR trim(weekly_digest_timezone) = '';

UPDATE app_settings
SET max_upload_size_mb = 50
WHERE max_upload_size_mb IS NULL
   OR max_upload_size_mb < 1
   OR max_upload_size_mb > 250;

UPDATE app_settings
SET ocr_timeout_seconds = 25
WHERE ocr_timeout_seconds IS NULL
   OR ocr_timeout_seconds < 5
   OR ocr_timeout_seconds > 300;

UPDATE app_settings
SET ocr_retry_limit = 1
WHERE ocr_retry_limit IS NULL
   OR ocr_retry_limit < 0
   OR ocr_retry_limit > 5;

UPDATE app_settings
SET default_data_export_format = 'csv'
WHERE default_data_export_format IS NULL
   OR default_data_export_format NOT IN ('csv', 'json');
UPDATE app_settings
SET max_concurrent_sessions_per_user = 0
WHERE max_concurrent_sessions_per_user IS NULL
   OR max_concurrent_sessions_per_user < 0;
