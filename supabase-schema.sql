-- ============================================
-- ENARSI Simulator — Supabase Schema
-- Run this in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================

-- 1. Profiles table (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(), -- Used for tracking online status / last connection
  access_code_verified BOOLEAN DEFAULT false -- Marks user has entered correct access code (2FA-style verification)
);

-- Idempotent column addition for existing databases
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code_verified BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.access_code_verified IS 'Marks user has entered correct access code (2FA-style verification)';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Study sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  label TEXT DEFAULT 'Study Session',
  range_start INT NOT NULL DEFAULT 1,
  range_end INT NOT NULL DEFAULT 483,
  last_question_id INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON study_sessions FOR ALL USING (auth.uid() = user_id);

-- 3. Answers (full history)
CREATE TABLE IF NOT EXISTS answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  question_id INT NOT NULL,
  result TEXT CHECK (result IN ('correct', 'incorrect')) NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own answers"
  ON answers FOR ALL USING (auth.uid() = user_id);

-- 4. Auto-create profile on signup and promote initial admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  -- Automatically assign admin role to leonardodonado@hotmail.com
  IF NEW.email = 'leonardodonado@hotmail.com' THEN
    INSERT INTO public.admin_users (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Access Control tables & schema

-- Whitelist of authorized emails
CREATE TABLE IF NOT EXISTS whitelist_emails (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Access audit log
CREATE TABLE IF NOT EXISTS access_logs (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  action VARCHAR(50), -- 'signup_attempt', 'login_attempt', 'code_verified', 'code_failed', 'email_unconfirmed'
  success BOOLEAN,
  reason TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin users management
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE whitelist_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Whitelist: Admins manage, public can select to check their own status during signup
CREATE POLICY "Admins manage whitelist"
  ON whitelist_emails
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow public select whitelist"
  ON whitelist_emails FOR SELECT
  USING (true);

-- Access Logs: Admins read logs, system can insert
CREATE POLICY "Admins view logs"
  ON access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "System logs attempts"
  ON access_logs
  FOR INSERT
  WITH CHECK (true);

-- Admin Users: Allow users to view their own admin status
CREATE POLICY "Allow select admin status for self"
  ON admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_answers_user_question ON answers(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON study_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_whitelist_email ON whitelist_emails(email);
CREATE INDEX IF NOT EXISTS idx_logs_email_created ON access_logs(email, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_user_id ON admin_users(user_id);

-- Initial seed data for whitelist
INSERT INTO whitelist_emails (email) VALUES
  ('greyvargas@gmail.com'),
  ('leonardodonado@hotmail.com')
ON CONFLICT (email) DO NOTHING;

-- Initial seed data for existing admin user
INSERT INTO admin_users (user_id, role)
SELECT id, 'admin' FROM auth.users 
WHERE email = 'leonardodonado@hotmail.com'
ON CONFLICT (user_id) DO NOTHING;
