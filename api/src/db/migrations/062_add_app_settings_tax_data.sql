ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS tax_data jsonb NOT NULL DEFAULT '{}'::jsonb;
