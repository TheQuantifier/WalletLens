-- Align extended app settings constraints/defaults after initial rollout.
ALTER TABLE app_settings
ALTER COLUMN max_concurrent_sessions_per_user SET DEFAULT 0;

UPDATE app_settings
SET max_concurrent_sessions_per_user = 0
WHERE max_concurrent_sessions_per_user IS NULL
   OR max_concurrent_sessions_per_user < 0;

ALTER TABLE app_settings
ALTER COLUMN max_concurrent_sessions_per_user SET NOT NULL;

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_max_concurrent_sessions_per_user_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_max_concurrent_sessions_per_user_check
CHECK (max_concurrent_sessions_per_user >= 0);

ALTER TABLE app_settings
DROP CONSTRAINT IF EXISTS app_settings_weekly_digest_time_check;
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_weekly_digest_time_check
CHECK (weekly_digest_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

UPDATE app_settings
SET weekly_digest_time = '09:00'
WHERE weekly_digest_time IS NULL
   OR weekly_digest_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
