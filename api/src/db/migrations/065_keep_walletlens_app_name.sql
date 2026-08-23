ALTER TABLE app_settings
  ALTER COLUMN app_name SET DEFAULT 'WalletLens';

UPDATE app_settings
SET app_name = 'WalletLens',
    updated_at = now()
WHERE btrim(COALESCE(app_name, '')) IN ('', '<AppName>');
