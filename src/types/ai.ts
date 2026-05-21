import type { Resume, WorkExperience } from './resume';

/**
 * Available AI models via OpenRouter
 */
/**
 * Available AI models via OpenRouter.
 * NOTE: grok-4.1-fast was deprecated by xAI in 2026. Migrated to grok-4.3.
 */
export type AIModel = 'x-ai/grok-4.3';

export type AIModelTier = 'fast' | 'quality' | 'budget';

export interface AIModelConfig {
  id: AIModel;
  name: string;
  tier: AIModelTier;
  description: string;
  maxTokens: number;
  costPer1KTokens: number;
}

/**
 * Context provided to AI for generating suggestions
 */
export interface AIContext {
  jobTitle?: string;
  industry?: string;
  yearsOfExperience?: number;
  targetRole?: string;
  skills?: string[];
  currentSummary?: string;
  experience?: WorkExperience[];
  education?: Array<{
    degree: string;
    field: string;
    institution: string;
  }>;
}

/**
 * Generated AI suggestion
 */
export interface AISuggestion {
  id: string;
  type: 'summary' | 'bullet_point' | 'skill' | 'general';
  content: string;
  confidence: number;
  createdAt: string;
}

/**
 * Summary generation result
 */
export interface SummaryGenerationResult {
  summaries: string[];
  model: AIModel;
  tokensUsed: number;
}

/**
 * Enhanced bullet points result
 */
export interface BulletPointResult {
  originalBullet: string;
  enhancedBullet: string;
  improvements: string[];
}

export interface EnhancedBulletsResult {
  bullets: BulletPointResult[];
  model: AIModel;
  tokensUsed: number;
}

/**
 * Skill suggestion result
 */
export interface SkillSuggestion {
  name: string;
  category: 'technical' | 'soft' | 'tools' | 'certifications' | 'languages';
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

export interface SkillSuggestionsResult {
  skills: SkillSuggestion[];
  model: AIModel;
  tokensUsed: number;
}

/**
 * Resume score breakdown
 */
export interface ScoreCategory {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
}

export interface ResumeScore {
  overallScore: number;
  categories: {
    content: ScoreCategory;
    formatting: ScoreCategory;
    keywords: ScoreCategory;
    impact: ScoreCategory;
    completeness: ScoreCategory;
  };
  strengths: string[];
  improvements: string[];
  atsCompatibility: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  model: AIModel;
  tokensUsed: number;
}

/**
 * AI request options
 */
export interface AIRequestOptions {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
}

/**
 * AI error types
 */
export type AIErrorCode =
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE'
  | 'CONTEXT_TOO_LONG'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface AIError {
  code: AIErrorCode;
  message: string;
  retryable: boolean;
}

/**
 * AI usage tracking
 */
export interface AIUsageRecord {
  id: string;
  type: 'summary' | 'bullets' | 'skills' | 'score';
  model: AIModel;
  tokensUsed: number;
  timestamp: string;
}

/**
 * Cached suggestion entry
 */
export interface CachedSuggestion<T = unknown> {
  data: T;
  cacheKey: string;
  expiresAt: string;
}
