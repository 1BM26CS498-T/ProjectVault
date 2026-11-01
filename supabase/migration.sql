-- ProjectVault Supabase Database Schema & RLS Migration

CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    city TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
    department TEXT NOT NULL,
    student_faculty_id TEXT,
    batch TEXT,
    college_id UUID REFERENCES public.colleges(id),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    college_id UUID REFERENCES public.colleges(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    features TEXT,
    technologies TEXT,
    department TEXT NOT NULL,
    year_batch TEXT,
    domain TEXT,
    faculty_guide_id UUID REFERENCES public.profiles(id),
    faculty_guide_name TEXT NOT NULL,
    student_id UUID REFERENCES public.profiles(id),
    student_name TEXT,
    team_members TEXT[],
    status TEXT DEFAULT 'Verified'
        CHECK (status IN ('Verified', 'Legacy Record', 'Archived')),
    github_url TEXT,
    demo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    college_id UUID REFERENCES public.colleges(id) NOT NULL,
    student_id UUID REFERENCES public.profiles(id) NOT NULL,
    faculty_guide_id UUID REFERENCES public.profiles(id) NOT NULL,
    title TEXT NOT NULL,
    problem_statement TEXT NOT NULL,
    solution_statement TEXT NOT NULL,
    features TEXT NOT NULL,
    technologies TEXT NOT NULL,
    domain TEXT NOT NULL,
    github_url TEXT,
    team_members TEXT[],
    status TEXT DEFAULT 'Pending Faculty Review'
        CHECK (status IN (
            'Pending Faculty Review',
            'Changes Requested',
            'Approved',
            'Rejected'
        )),
    reviewer_comment TEXT,
    final_submission JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Note: Review existing policies before adding policies.
-- The policies in the original draft are not included here because
-- they require security review and may conflict with existing policies.
