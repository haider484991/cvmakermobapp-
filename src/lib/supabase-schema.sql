-- FreeResume AI Database Schema
-- This file contains the SQL schema for the Supabase database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CUSTOM TYPES / ENUMS
-- =============================================================================

-- Subscription tiers for users
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');

-- Template categories
CREATE TYPE template_category AS ENUM ('ats-optimized', 'professional', 'modern', 'creative', 'minimal');

-- AI action types for tracking usage
CREATE TYPE ai_action_type AS ENUM (
  'generate_summary',
  'improve_bullet',
  'analyze_resume',
  'job_match',
  'keyword_optimize'
);

-- =============================================================================
-- PROFILES TABLE
-- Extends Supabase auth.users with additional profile data
-- =============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  job_title TEXT,

  -- Subscription info
  subscription_tier subscription_tier DEFAULT 'free' NOT NULL,
  subscription_expires_at TIMESTAMPTZ,

  -- AI credits for free tier users (resets monthly)
  ai_credits_remaining INTEGER DEFAULT 10 NOT NULL,
  ai_credits_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for faster email lookups
CREATE INDEX idx_profiles_email ON profiles(email);

-- =============================================================================
-- TEMPLATES TABLE
-- Resume templates available in the app
-- =============================================================================

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category template_category NOT NULL,
  ats_score INTEGER DEFAULT 100 NOT NULL CHECK (ats_score >= 0 AND ats_score <= 100),
  is_premium BOOLEAN DEFAULT false NOT NULL,
  thumbnail_url TEXT NOT NULL,

  -- Template styles stored as JSONB
  styles JSONB NOT NULL DEFAULT '{
    "fonts": {"heading": "Inter", "body": "Inter"},
    "colors": {"primary": "#2563EB", "secondary": "#6B7280", "accent": "#3B82F6", "text": "#1F2937"},
    "spacing": {"sectionGap": 24, "itemGap": 12, "margins": 48}
  }'::jsonb,

  -- Template status
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for active templates
CREATE INDEX idx_templates_active ON templates(is_active, sort_order) WHERE is_active = true;

-- =============================================================================
-- RESUMES TABLE
-- User's resumes with full resume data stored as JSONB
-- =============================================================================

CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL DEFAULT NULL,

  -- Full resume data stored as JSONB for flexibility
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Resume metadata
  is_primary BOOLEAN DEFAULT false NOT NULL,
  last_exported_at TIMESTAMPTZ,
  export_count INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_updated_at ON resumes(user_id, updated_at DESC);

-- Function to ensure only one primary resume per user
CREATE OR REPLACE FUNCTION ensure_single_primary_resume()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE resumes
    SET is_primary = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single primary resume
CREATE TRIGGER trg_ensure_single_primary_resume
BEFORE INSERT OR UPDATE OF is_primary ON resumes
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION ensure_single_primary_resume();

-- =============================================================================
-- RESUME VERSIONS TABLE
-- Version history for resumes (for undo/redo and version comparison)
-- =============================================================================

CREATE TABLE resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of resume data at this version
  data JSONB NOT NULL,

  -- Optional description of changes
  change_summary TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure unique version numbers per resume
  UNIQUE(resume_id, version_number)
);

-- Index for fetching versions
CREATE INDEX idx_resume_versions_resume_id ON resume_versions(resume_id, version_number DESC);

-- Function to auto-increment version number
CREATE OR REPLACE FUNCTION set_resume_version_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM resume_versions
  WHERE resume_id = NEW.resume_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set version number
CREATE TRIGGER trg_set_resume_version_number
BEFORE INSERT ON resume_versions
FOR EACH ROW
EXECUTE FUNCTION set_resume_version_number();

-- =============================================================================
-- AI USAGE TABLE
-- Track AI feature usage for billing and analytics
-- =============================================================================

CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type ai_action_type NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model_used TEXT NOT NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,

  -- Additional metadata (prompt, response, etc.)
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for usage queries
CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Users can view and update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow insert during signup (user creates their own profile)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Resumes policies
-- Users can only access their own resumes
CREATE POLICY "Users can view own resumes"
  ON resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
  ON resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
  ON resumes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
  ON resumes FOR DELETE
  USING (auth.uid() = user_id);

-- Resume versions policies
-- Users can access versions of their own resumes
CREATE POLICY "Users can view own resume versions"
  ON resume_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = resume_versions.resume_id
      AND resumes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own resume versions"
  ON resume_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = resume_versions.resume_id
      AND resumes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own resume versions"
  ON resume_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM resumes
      WHERE resumes.id = resume_versions.resume_id
      AND resumes.user_id = auth.uid()
    )
  );

-- Templates policies
-- All authenticated users can view active templates
CREATE POLICY "Authenticated users can view active templates"
  ON templates FOR SELECT
  USING (is_active = true);

-- AI usage policies
-- Users can view their own AI usage
CREATE POLICY "Users can view own AI usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI usage"
  ON ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_resumes_updated_at
  BEFORE UPDATE ON resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to decrement AI credits
CREATE OR REPLACE FUNCTION decrement_ai_credits(p_user_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining INTEGER;
  v_tier subscription_tier;
BEGIN
  -- Get current credits and tier
  SELECT ai_credits_remaining, subscription_tier
  INTO v_remaining, v_tier
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Pro and premium users have unlimited credits
  IF v_tier IN ('pro', 'premium') THEN
    RETURN TRUE;
  END IF;

  -- Check if enough credits
  IF v_remaining < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Decrement credits
  UPDATE profiles
  SET ai_credits_remaining = ai_credits_remaining - p_amount
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly AI credits
CREATE OR REPLACE FUNCTION reset_monthly_ai_credits()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET
    ai_credits_remaining = 10,
    ai_credits_reset_at = NOW() + INTERVAL '30 days'
  WHERE
    subscription_tier = 'free'
    AND ai_credits_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- SEED DATA: Default Templates
-- =============================================================================

INSERT INTO templates (name, category, ats_score, is_premium, thumbnail_url, styles, sort_order) VALUES
(
  'Classic Professional',
  'ats-optimized',
  100,
  false,
  '/templates/classic-professional.png',
  '{
    "fonts": {"heading": "Inter", "body": "Inter"},
    "colors": {"primary": "#1F2937", "secondary": "#6B7280", "accent": "#2563EB", "text": "#1F2937"},
    "spacing": {"sectionGap": 24, "itemGap": 12, "margins": 48}
  }'::jsonb,
  1
),
(
  'Modern Minimal',
  'minimal',
  95,
  false,
  '/templates/modern-minimal.png',
  '{
    "fonts": {"heading": "Inter", "body": "Inter"},
    "colors": {"primary": "#0F172A", "secondary": "#64748B", "accent": "#3B82F6", "text": "#0F172A"},
    "spacing": {"sectionGap": 28, "itemGap": 14, "margins": 56}
  }'::jsonb,
  2
),
(
  'Executive Suite',
  'professional',
  90,
  true,
  '/templates/executive-suite.png',
  '{
    "fonts": {"heading": "Georgia", "body": "Inter"},
    "colors": {"primary": "#1E3A5F", "secondary": "#64748B", "accent": "#C9A227", "text": "#1F2937"},
    "spacing": {"sectionGap": 26, "itemGap": 13, "margins": 52}
  }'::jsonb,
  3
),
(
  'Tech Focus',
  'modern',
  88,
  true,
  '/templates/tech-focus.png',
  '{
    "fonts": {"heading": "SF Pro", "body": "Inter"},
    "colors": {"primary": "#18181B", "secondary": "#71717A", "accent": "#10B981", "text": "#18181B"},
    "spacing": {"sectionGap": 24, "itemGap": 12, "margins": 48}
  }'::jsonb,
  4
),
(
  'Creative Bold',
  'creative',
  75,
  true,
  '/templates/creative-bold.png',
  '{
    "fonts": {"heading": "Poppins", "body": "Inter"},
    "colors": {"primary": "#7C3AED", "secondary": "#A78BFA", "accent": "#EC4899", "text": "#1F2937"},
    "spacing": {"sectionGap": 28, "itemGap": 16, "margins": 44}
  }'::jsonb,
  5
);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE profiles IS 'Extended user profiles with subscription and credits info';
COMMENT ON TABLE resumes IS 'User resumes with JSONB data for flexibility';
COMMENT ON TABLE resume_versions IS 'Version history for resumes';
COMMENT ON TABLE templates IS 'Resume templates available in the app';
COMMENT ON TABLE ai_usage IS 'AI feature usage tracking for billing and analytics';

COMMENT ON FUNCTION decrement_ai_credits IS 'Decrements AI credits for free tier users';
COMMENT ON FUNCTION reset_monthly_ai_credits IS 'Resets monthly AI credits for free tier users';
COMMENT ON FUNCTION handle_new_user IS 'Creates profile when new user signs up';
