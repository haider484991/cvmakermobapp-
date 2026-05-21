import {
  chatCompletion,
  streamingChatCompletion,
  parseJSONResponse,
  getModelByTier,
  DEFAULT_MODELS,
  createAIError,
} from '@/lib/openrouter';
import {
  SYSTEM_PROMPT,
  SUMMARY_PROMPT,
  BULLET_POINT_PROMPT,
  SKILL_SUGGESTION_PROMPT,
  RESUME_SCORE_PROMPT,
} from './prompts';
import type {
  AIContext,
  AIModel,
  AIRequestOptions,
  SummaryGenerationResult,
  EnhancedBulletsResult,
  BulletPointResult,
  SkillSuggestionsResult,
  SkillSuggestion,
  ResumeScore,
  ScoreCategory,
} from '@/types/ai';
import type { Resume, WorkExperience } from '@/types/resume';

/**
 * Default request options
 */
const DEFAULT_OPTIONS: Required<AIRequestOptions> = {
  model: 'x-ai/grok-4.3',
  temperature: 0.7,
  maxTokens: 2048,
};

/**
 * Merge options with defaults
 */
function mergeOptions(options?: AIRequestOptions): Required<AIRequestOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

/**
 * Get the appropriate model for a feature
 */
function getModelForFeature(
  feature: keyof typeof DEFAULT_MODELS,
  options?: AIRequestOptions
): AIModel {
  if (options?.model) {
    return options.model;
  }
  const tier = DEFAULT_MODELS[feature];
  return getModelByTier(tier).id;
}

/**
 * Generate professional summary options based on context
 *
 * @param context - Background information about the candidate
 * @param options - Optional AI request configuration
 * @returns Array of 3 professional summary options
 */
export async function generateSummary(
  context: AIContext,
  options?: AIRequestOptions
): Promise<SummaryGenerationResult> {
  const model = getModelForFeature('summary', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const response = await chatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: SUMMARY_PROMPT(context) },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: mergedOptions.maxTokens,
  });

  const parsed = parseJSONResponse<{ summaries: string[] }>(response.content);

  if (!parsed.summaries || !Array.isArray(parsed.summaries)) {
    throw createAIError('PARSE_ERROR', 'Invalid response format for summaries');
  }

  return {
    summaries: parsed.summaries,
    model: response.model,
    tokensUsed: response.tokensUsed,
  };
}

/**
 * Enhance bullet points to be achievement-focused
 *
 * @param experience - Work experience with bullet points to enhance
 * @param options - Optional AI request configuration
 * @returns Enhanced bullet points with improvement explanations
 */
export async function enhanceBulletPoints(
  experience: WorkExperience,
  options?: AIRequestOptions
): Promise<EnhancedBulletsResult> {
  if (!experience.bullets || experience.bullets.length === 0) {
    throw createAIError('PARSE_ERROR', 'No bullet points provided to enhance');
  }

  const model = getModelForFeature('bullets', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const context: Partial<AIContext> = {
    jobTitle: experience.title,
  };

  const response = await chatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: BULLET_POINT_PROMPT(experience.bullets, context) },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: mergedOptions.maxTokens,
  });

  const parsed = parseJSONResponse<{ bullets: BulletPointResult[] }>(response.content);

  if (!parsed.bullets || !Array.isArray(parsed.bullets)) {
    throw createAIError('PARSE_ERROR', 'Invalid response format for bullet points');
  }

  return {
    bullets: parsed.bullets,
    model: response.model,
    tokensUsed: response.tokensUsed,
  };
}

/**
 * Suggest relevant skills based on job title and industry
 *
 * @param jobTitle - Target job title
 * @param industry - Target industry
 * @param existingSkills - Skills already on the resume (to avoid duplicates)
 * @param options - Optional AI request configuration
 * @returns List of suggested skills with categories and relevance
 */
export async function suggestSkills(
  jobTitle: string,
  industry: string,
  existingSkills?: string[],
  options?: AIRequestOptions
): Promise<SkillSuggestionsResult> {
  if (!jobTitle || !industry) {
    throw createAIError('PARSE_ERROR', 'Job title and industry are required');
  }

  const model = getModelForFeature('skills', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const response = await chatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: SKILL_SUGGESTION_PROMPT(jobTitle, industry, existingSkills),
      },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: mergedOptions.maxTokens,
  });

  const parsed = parseJSONResponse<{ skills: SkillSuggestion[] }>(response.content);

  if (!parsed.skills || !Array.isArray(parsed.skills)) {
    throw createAIError('PARSE_ERROR', 'Invalid response format for skills');
  }

  // Validate and clean up skill suggestions
  const validatedSkills = parsed.skills.filter(
    (skill): skill is SkillSuggestion =>
      typeof skill.name === 'string' &&
      ['technical', 'soft', 'tools', 'certifications', 'languages'].includes(skill.category) &&
      ['high', 'medium', 'low'].includes(skill.relevance)
  );

  return {
    skills: validatedSkills,
    model: response.model,
    tokensUsed: response.tokensUsed,
  };
}

/**
 * Score and analyze a resume
 *
 * @param resume - The resume to analyze
 * @param jobDescription - Optional target job description for tailored analysis
 * @param options - Optional AI request configuration
 * @returns Comprehensive resume score with detailed feedback
 */
export async function scoreResume(
  resume: Resume,
  jobDescription?: string,
  options?: AIRequestOptions
): Promise<ResumeScore> {
  const model = getModelForFeature('score', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const response = await chatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: RESUME_SCORE_PROMPT(resume, jobDescription) },
    ],
    temperature: 0.5, // Lower temperature for more consistent scoring
    maxTokens: mergedOptions.maxTokens,
  });

  interface ParsedScore {
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
  }

  const parsed = parseJSONResponse<ParsedScore>(response.content);

  // Validate the parsed response structure
  if (
    typeof parsed.overallScore !== 'number' ||
    !parsed.categories ||
    !parsed.strengths ||
    !parsed.improvements ||
    !parsed.atsCompatibility
  ) {
    throw createAIError('PARSE_ERROR', 'Invalid response format for resume score');
  }

  // Ensure score is within valid range
  const normalizedScore = Math.min(100, Math.max(0, parsed.overallScore));

  return {
    ...parsed,
    overallScore: normalizedScore,
    model: response.model,
    tokensUsed: response.tokensUsed,
  };
}

/**
 * Build AIContext from a Resume object
 */
export function buildContextFromResume(resume: Resume): AIContext {
  return {
    jobTitle: resume.header.jobTitle,
    currentSummary: resume.summary,
    skills: resume.skills.map((s) => s.name),
    experience: resume.experience,
    education: resume.education.map((edu) => ({
      degree: edu.degree,
      field: edu.field,
      institution: edu.institution,
    })),
  };
}

/**
 * Quick enhancement for a single bullet point
 */
export async function enhanceSingleBullet(
  bullet: string,
  jobTitle?: string,
  options?: AIRequestOptions
): Promise<string> {
  const model = getModelForFeature('bullets', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const response = await chatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Transform this job responsibility into an achievement-focused bullet point:

"${bullet}"

${jobTitle ? `Role: ${jobTitle}` : ''}

Return only the improved bullet point, starting with a strong action verb. Include metrics if possible. Keep it under 20 words.`,
      },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: 256,
  });

  return response.content.trim().replace(/^["']|["']$/g, '');
}

/**
 * Streaming callback options
 */
export interface StreamingCallbacks {
  onChunk: (chunk: string, fullText: string) => void;
  onComplete?: (fullText: string, tokensUsed: number) => void;
  onError?: (error: any) => void;
}

/**
 * Generate a single professional summary with streaming (ChatGPT-like effect)
 *
 * @param context - Background information about the candidate
 * @param callbacks - Streaming callbacks for real-time text updates
 * @param options - Optional AI request configuration
 */
export async function generateSummaryStreaming(
  context: AIContext,
  callbacks: StreamingCallbacks,
  options?: AIRequestOptions
): Promise<void> {
  const model = getModelForFeature('summary', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const streamingPrompt = `Based on the following context, write ONE professional summary paragraph for a resume. The summary should be 3-4 sentences, highlight key achievements, and be written in first person. Do NOT use JSON format - just write the summary text directly.

Context:
- Job Title: ${context.jobTitle || 'Professional'}
- Skills: ${context.skills?.join(', ') || 'Various professional skills'}
- Current Summary: ${context.currentSummary || 'None provided'}
${context.experience?.length ? `- Experience: ${context.experience.map(e => e.title + ' at ' + e.company).join('; ')}` : ''}

Write a compelling, achievement-focused professional summary:`;

  await streamingChatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: streamingPrompt },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: 512,
    onChunk: callbacks.onChunk,
    onComplete: callbacks.onComplete,
    onError: callbacks.onError,
  });
}

/**
 * Enhance a single bullet point with streaming (ChatGPT-like effect)
 *
 * @param bullet - The bullet point to enhance
 * @param jobTitle - Optional job title for context
 * @param callbacks - Streaming callbacks for real-time text updates
 * @param options - Optional AI request configuration
 */
export async function enhanceBulletStreaming(
  bullet: string,
  jobTitle: string | undefined,
  callbacks: StreamingCallbacks,
  options?: AIRequestOptions
): Promise<void> {
  const model = getModelForFeature('bullets', options);
  const mergedOptions = mergeOptions({ ...options, model });

  const streamingPrompt = `Transform this job responsibility into an achievement-focused bullet point. Start with a strong action verb, include metrics if possible, and keep it under 20 words. Do NOT use JSON format - just write the improved bullet point directly.

Original: "${bullet}"
${jobTitle ? `Role: ${jobTitle}` : ''}

Improved bullet point:`;

  await streamingChatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: streamingPrompt },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: 256,
    onChunk: callbacks.onChunk,
    onComplete: callbacks.onComplete,
    onError: callbacks.onError,
  });
}

/**
 * Generic streaming text generation
 *
 * @param prompt - The prompt to send to the AI
 * @param callbacks - Streaming callbacks for real-time text updates
 * @param options - Optional AI request configuration
 */
export async function streamTextGeneration(
  prompt: string,
  callbacks: StreamingCallbacks,
  options?: AIRequestOptions
): Promise<void> {
  const model = getModelForFeature('summary', options);
  const mergedOptions = mergeOptions({ ...options, model });

  await streamingChatCompletion({
    model: mergedOptions.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: mergedOptions.temperature,
    maxTokens: mergedOptions.maxTokens,
    onChunk: callbacks.onChunk,
    onComplete: callbacks.onComplete,
    onError: callbacks.onError,
  });
}

/**
 * Export all AI service functions
 */
export const resumeAIService = {
  generateSummary,
  generateSummaryStreaming,
  enhanceBulletPoints,
  enhanceBulletStreaming,
  suggestSkills,
  scoreResume,
  enhanceSingleBullet,
  buildContextFromResume,
  streamTextGeneration,
};

export default resumeAIService;
