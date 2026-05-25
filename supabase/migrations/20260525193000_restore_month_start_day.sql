-- Ensure existing Supabase projects keep the custom month start setting.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS month_start_day INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_month_start_day_check'
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_month_start_day_check
      CHECK (month_start_day >= 1 AND month_start_day <= 31);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id_unique
  ON user_settings(user_id);

-- Ask PostgREST/Supabase API to refresh its schema cache after the ALTER TABLE.
NOTIFY pgrst, 'reload schema';
