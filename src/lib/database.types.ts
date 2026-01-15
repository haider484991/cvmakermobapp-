import type { Resume, ResumeTemplate } from '@/types/resume';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          job_title: string | null;
          subscription_tier: 'free' | 'pro' | 'premium';
          subscription_expires_at: string | null;
          ai_credits_remaining: number;
          ai_credits_reset_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          job_title?: string | null;
          subscription_tier?: 'free' | 'pro' | 'premium';
          subscription_expires_at?: string | null;
          ai_credits_remaining?: number;
          ai_credits_reset_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          job_title?: string | null;
          subscription_tier?: 'free' | 'pro' | 'premium';
          subscription_expires_at?: string | null;
          ai_credits_remaining?: number;
          ai_credits_reset_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          template_id: string;
          data: Resume;
          is_primary: boolean;
          last_exported_at: string | null;
          export_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          template_id?: string;
          data: Resume;
          is_primary?: boolean;
          last_exported_at?: string | null;
          export_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          template_id?: string;
          data?: Resume;
          is_primary?: boolean;
          last_exported_at?: string | null;
          export_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resumes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'resumes_template_id_fkey';
            columns: ['template_id'];
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          }
        ];
      };
      resume_versions: {
        Row: {
          id: string;
          resume_id: string;
          version_number: number;
          data: Resume;
          change_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resume_id: string;
          version_number: number;
          data: Resume;
          change_summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          resume_id?: string;
          version_number?: number;
          data?: Resume;
          change_summary?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'resume_versions_resume_id_fkey';
            columns: ['resume_id'];
            referencedRelation: 'resumes';
            referencedColumns: ['id'];
          }
        ];
      };
      templates: {
        Row: {
          id: string;
          name: string;
          category: 'ats-optimized' | 'professional' | 'modern' | 'creative' | 'minimal';
          ats_score: number;
          is_premium: boolean;
          thumbnail_url: string;
          styles: ResumeTemplate['styles'];
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: 'ats-optimized' | 'professional' | 'modern' | 'creative' | 'minimal';
          ats_score?: number;
          is_premium?: boolean;
          thumbnail_url: string;
          styles: ResumeTemplate['styles'];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: 'ats-optimized' | 'professional' | 'modern' | 'creative' | 'minimal';
          ats_score?: number;
          is_premium?: boolean;
          thumbnail_url?: string;
          styles?: ResumeTemplate['styles'];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          id: string;
          user_id: string;
          action_type: 'generate_summary' | 'improve_bullet' | 'analyze_resume' | 'job_match' | 'keyword_optimize';
          tokens_used: number;
          model_used: string;
          resume_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action_type: 'generate_summary' | 'improve_bullet' | 'analyze_resume' | 'job_match' | 'keyword_optimize';
          tokens_used: number;
          model_used: string;
          resume_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action_type?: 'generate_summary' | 'improve_bullet' | 'analyze_resume' | 'job_match' | 'keyword_optimize';
          tokens_used?: number;
          model_used?: string;
          resume_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_usage_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_usage_resume_id_fkey';
            columns: ['resume_id'];
            referencedRelation: 'resumes';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      subscription_tier: 'free' | 'pro' | 'premium';
      template_category: 'ats-optimized' | 'professional' | 'modern' | 'creative' | 'minimal';
      ai_action_type: 'generate_summary' | 'improve_bullet' | 'analyze_resume' | 'job_match' | 'keyword_optimize';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier access
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type DbResume = Database['public']['Tables']['resumes']['Row'];
export type DbResumeInsert = Database['public']['Tables']['resumes']['Insert'];
export type DbResumeUpdate = Database['public']['Tables']['resumes']['Update'];

export type ResumeVersion = Database['public']['Tables']['resume_versions']['Row'];
export type ResumeVersionInsert = Database['public']['Tables']['resume_versions']['Insert'];

export type Template = Database['public']['Tables']['templates']['Row'];
export type TemplateInsert = Database['public']['Tables']['templates']['Insert'];

export type AiUsage = Database['public']['Tables']['ai_usage']['Row'];
export type AiUsageInsert = Database['public']['Tables']['ai_usage']['Insert'];
