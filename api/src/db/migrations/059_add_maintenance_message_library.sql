-- Store reusable maintenance banner messages and the selected default message.
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS maintenance_mode_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS maintenance_mode_default_message_id text NOT NULL DEFAULT '';

UPDATE app_settings
SET maintenance_mode_messages = '[]'::jsonb
WHERE maintenance_mode_messages IS NULL
   OR jsonb_typeof(maintenance_mode_messages) <> 'array';

UPDATE app_settings
SET maintenance_mode_default_message_id = ''
WHERE maintenance_mode_default_message_id IS NULL;

