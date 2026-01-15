-- FreeResume AI Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');
CREATE TYPE template_category AS ENUM ('ats-optimized', 'professional', 'modern', 'creative', 'minimal');
CREATE TYPE ai_action_type AS ENUM ('generate_summary', 'improve_bullet', 'analyze_resume', 'job_match', 'keyword_optimize');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    job_title TEXT,
    subscription_tier subscription_tier DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,
    ai_credits_remaining INTEGER DEFAULT 10,
    ai_credits_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category template_category NOT NULL,
    ats_score INTEGER DEFAULT 85,
    is_premium BOOLEAN DEFAULT false,
    thumbnail_url TEXT NOT NULL,
    styles JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    data JSONB NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    last_exported_at TIMESTAMPTZ,
    export_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resume versions table
CREATE TABLE IF NOT EXISTS resume_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_type ai_action_type NOT NULL,
    tokens_used INTEGER NOT NULL,
    model_used TEXT NOT NULL,
    resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_template_id ON resumes(template_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_resume_id ON resume_versions(resume_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Resumes policies
CREATE POLICY "Users can view own resumes" ON resumes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own resumes" ON resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes" ON resumes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes" ON resumes
    FOR DELETE USING (auth.uid() = user_id);

-- Resume versions policies
CREATE POLICY "Users can view own resume versions" ON resume_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM resumes
            WHERE resumes.id = resume_versions.resume_id
            AND resumes.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own resume versions" ON resume_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM resumes
            WHERE resumes.id = resume_versions.resume_id
            AND resumes.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own resume versions" ON resume_versions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM resumes
            WHERE resumes.id = resume_versions.resume_id
            AND resumes.user_id = auth.uid()
        )
    );

-- AI usage policies
CREATE POLICY "Users can view own AI usage" ON ai_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AI usage" ON ai_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Templates policies (public read for all, admin write)
CREATE POLICY "Anyone can view active templates" ON templates
    FOR SELECT USING (is_active = true);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resumes_updated_at
    BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default templates
INSERT INTO templates (name, category, ats_score, is_premium, thumbnail_url, styles, sort_order) VALUES
('Classic Professional', 'professional', 95, false, '/templates/classic-professional.png',
 '{"primaryColor": "#2563eb", "fontFamily": "Georgia", "layout": "single-column", "headerStyle": "centered", "sectionStyle": "underlined"}', 1),

('Modern Minimal', 'minimal', 90, false, '/templates/modern-minimal.png',
 '{"primaryColor": "#1f2937", "fontFamily": "Inter", "layout": "single-column", "headerStyle": "left-aligned", "sectionStyle": "simple"}', 2),

('ATS Optimized', 'ats-optimized', 100, false, '/templates/ats-optimized.png',
 '{"primaryColor": "#000000", "fontFamily": "Arial", "layout": "single-column", "headerStyle": "left-aligned", "sectionStyle": "simple"}', 3),

('Creative Portfolio', 'creative', 75, true, '/templates/creative-portfolio.png',
 '{"primaryColor": "#8b5cf6", "fontFamily": "Poppins", "layout": "two-column", "headerStyle": "banner", "sectionStyle": "boxed"}', 4),

('Executive Suite', 'professional', 92, true, '/templates/executive-suite.png',
 '{"primaryColor": "#0f172a", "fontFamily": "Merriweather", "layout": "single-column", "headerStyle": "centered", "sectionStyle": "underlined"}', 5);

-- Enable realtime for resumes table
ALTER PUBLICATION supabase_realtime ADD TABLE resumes;
