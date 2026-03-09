-- Adds customizable admin-role permissions matrix storage.
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS admin_role_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
