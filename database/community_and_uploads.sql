-- ProjectVault add-on schema for student attachments and moderated questions.
-- Run only after verifying that public.profiles and public.projects use the
-- app's expected UUID IDs and role/status columns.

BEGIN;

DO $$
DECLARE
  college_id_type TEXT;
BEGIN
  IF to_regclass('public.colleges') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.projects') IS NULL THEN
    RAISE EXCEPTION 'ProjectVault base tables are missing. Reconcile and apply the app-compatible base schema first.';
  END IF;

  SELECT data_type
    INTO college_id_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'colleges'
     AND column_name = 'id';

  IF college_id_type NOT IN ('integer', 'bigint')
     OR NOT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'colleges'
          AND column_name = 'college_name'
     ) THEN
    RAISE EXCEPTION 'Incompatible colleges schema: ProjectVault expects a numeric colleges.id and a college_name column. Inspect the live database before migrating.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'email'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'role'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'college_id'
      AND data_type IN ('integer', 'bigint')
  ) THEN
    RAISE EXCEPTION 'Incompatible profiles schema: expected UUID id, email, full_name, role, and numeric college_id columns.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'projects'
       AND column_name = 'student_id'
       AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'projects'
       AND column_name = 'faculty_guide_id'
       AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'projects'
       AND column_name = 'id'
       AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'projects'
       AND column_name = 'status'
       AND data_type IN ('text', 'character varying')
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'projects'
       AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'Incompatible projects schema: expected UUID id/student_id/faculty_guide_id, text status, and updated_at columns.';
  END IF;
END;
$$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS demo_url TEXT,
  ADD COLUMN IF NOT EXISTS report_path TEXT,
  ADD COLUMN IF NOT EXISTS demo_video_path TEXT,
  ADD COLUMN IF NOT EXISTS team_name TEXT;

CREATE OR REPLACE FUNCTION public.submit_project_final(
  p_project_id UUID,
  p_demo_url TEXT,
  p_report_path TEXT,
  p_demo_video_path TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before submitting final project files.';
  END IF;

  IF p_demo_url IS NULL OR p_demo_url !~* '^https?://' THEN
    RAISE EXCEPTION 'A valid HTTP or HTTPS demo link is required.';
  END IF;

  IF p_report_path IS NULL
     OR p_demo_video_path IS NULL
     OR p_report_path NOT LIKE (auth.uid()::TEXT || '/' || p_project_id::TEXT || '/%')
     OR p_demo_video_path NOT LIKE (auth.uid()::TEXT || '/' || p_project_id::TEXT || '/%') THEN
    RAISE EXCEPTION 'Final files must belong to the signed-in student and project.';
  END IF;

  IF lower(storage.extension(p_report_path)) NOT IN ('pdf', 'doc', 'docx')
     OR lower(storage.extension(p_demo_video_path)) NOT IN ('mp4', 'mov', 'webm', 'm4v') THEN
    RAISE EXCEPTION 'Use a supported report and video file format.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM storage.objects
     WHERE bucket_id = 'project-submissions'
       AND name IN (p_report_path, p_demo_video_path)
     GROUP BY bucket_id
    HAVING COUNT(DISTINCT name) = 2
  ) THEN
    RAISE EXCEPTION 'Upload both the final report and demo video before submitting.';
  END IF;

  UPDATE public.projects
     SET demo_url = p_demo_url,
         report_path = p_report_path,
         demo_video_path = p_demo_video_path,
         status = 'submitted',
         updated_at = NOW()
   WHERE id = p_project_id
     AND student_id = auth.uid()
     AND lower(status) IN ('approved', 'changes_requested');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or not ready for final submission.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_project_final(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_project_final(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_projectvault_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_projectvault_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_projectvault_admin() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can read their own profile; admins can read all profiles" ON public.profiles;
CREATE POLICY "Users can read their own profile; admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.is_projectvault_admin()
  );

CREATE OR REPLACE FUNCTION public.create_projectvault_student_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_college_id BIGINT;
  student_name TEXT;
BEGIN
  IF NEW.raw_user_meta_data ->> 'projectvault_signup' IS DISTINCT FROM 'student' THEN
    RETURN NEW;
  END IF;

  selected_college_id := NULLIF(NEW.raw_user_meta_data ->> 'college_id', '')::BIGINT;
  student_name := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), '');

  IF selected_college_id IS NULL OR student_name IS NULL THEN
    RAISE EXCEPTION 'Student signup requires a name and a valid college.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.colleges WHERE id = selected_college_id
  ) THEN
    RAISE EXCEPTION 'The selected college does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'department'
  ) THEN
    EXECUTE
      'INSERT INTO public.profiles (id, email, full_name, role, college_id, department)
       VALUES ($1, $2, $3, ''student'', $4, ''Unassigned'')
       ON CONFLICT (id) DO NOTHING'
      USING NEW.id, NEW.email, student_name, selected_college_id;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role, college_id)
    VALUES (NEW.id, NEW.email, student_name, 'student', selected_college_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_projectvault_student_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_projectvault_student_signup ON auth.users;
CREATE TRIGGER on_projectvault_student_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_projectvault_student_profile();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.projects TO anon, authenticated;

DROP POLICY IF EXISTS "Approved projects are visible across colleges" ON public.projects;
CREATE POLICY "Approved projects are visible across colleges"
  ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (
    lower(status) IN ('approved', 'verified')
    OR student_id = (SELECT auth.uid())
    OR faculty_guide_id = (SELECT auth.uid())
    OR public.is_projectvault_admin()
  );

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.colleges TO anon, authenticated;
GRANT INSERT ON public.colleges TO authenticated;

DROP POLICY IF EXISTS "College names are visible to everyone" ON public.colleges;
CREATE POLICY "College names are visible to everyone"
  ON public.colleges
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Admins can add colleges" ON public.colleges;
CREATE POLICY "Admins can add colleges"
  ON public.colleges
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_projectvault_admin());

CREATE TABLE IF NOT EXISTS public.faq_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(btrim(question)) BETWEEN 8 AND 1500),
  answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  answered_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.faq_questions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.faq_questions TO anon, authenticated;
GRANT INSERT ON public.faq_questions TO authenticated;
GRANT UPDATE ON public.faq_questions TO authenticated;

DROP POLICY IF EXISTS "Published FAQs are public; admins can moderate" ON public.faq_questions;
CREATE POLICY "Published FAQs are public; admins can moderate"
  ON public.faq_questions
  FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND answer IS NOT NULL)
    OR public.is_projectvault_admin()
  );

DROP POLICY IF EXISTS "Signed-in users can submit questions" ON public.faq_questions;
CREATE POLICY "Signed-in users can submit questions"
  ON public.faq_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND answer IS NULL
    AND answered_by IS NULL
    AND answered_at IS NULL
  );

DROP POLICY IF EXISTS "Only admins can answer FAQs" ON public.faq_questions;
CREATE POLICY "Only admins can answer FAQs"
  ON public.faq_questions
  FOR UPDATE
  TO authenticated
  USING (public.is_projectvault_admin())
  WITH CHECK (
    public.is_projectvault_admin()
    AND (
      (status = 'published' AND answer IS NOT NULL AND answered_by = (SELECT auth.uid()))
      OR status = 'rejected'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-submissions',
  'project-submissions',
  FALSE,
  524288000,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Project owners can upload submission files" ON storage.objects;
CREATE POLICY "Project owners can upload submission files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-submissions'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
    AND cardinality(storage.foldername(name)) >= 2
    AND lower(storage.extension(name)) IN ('pdf', 'doc', 'docx', 'mp4', 'mov', 'webm', 'm4v')
  );

DROP POLICY IF EXISTS "Project participants can read submission files" ON storage.objects;
CREATE POLICY "Project participants can read submission files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-submissions'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_projectvault_admin()
      OR EXISTS (
        SELECT 1
        FROM public.projects AS project
        WHERE project.id::TEXT = (storage.foldername(name))[2]
          AND (
            project.student_id = (SELECT auth.uid())
            OR project.faculty_guide_id = (SELECT auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS "Project owners and admins can update submission files" ON storage.objects;
CREATE POLICY "Project owners and admins can update submission files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-submissions'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_projectvault_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'project-submissions'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_projectvault_admin()
    )
  );

DROP POLICY IF EXISTS "Project owners and admins can delete submission files" ON storage.objects;
CREATE POLICY "Project owners and admins can delete submission files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-submissions'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::TEXT
      OR public.is_projectvault_admin()
    )
  );

COMMIT;
