-- Adds per-service emergency toggle controls for System Health actions.
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS system_health_controls jsonb NOT NULL DEFAULT '{}'::jsonb;
