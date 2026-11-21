BEGIN;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS password_hash;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('Pending', 'Active', 'Suspended'));

ALTER TABLE pending_student_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.pending_student_profiles'::regclass
       AND conname = 'pending_student_profiles_role_check'
  ) THEN
    ALTER TABLE pending_student_profiles
      ADD CONSTRAINT pending_student_profiles_role_check
      CHECK (role IN ('student', 'faculty'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique_idx
  ON profiles (LOWER(email));

COMMIT;
