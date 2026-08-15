import {
  chatCompletion,
  streamingChatCompletion,
  parseJSONResponse,
  createAIError,
} from '@/lib/openrouter';
import { resolveModelChain, type AICapability } from '@/services/ai/modelRegistry';
import {
  SYSTEM_PROMPT,
  SUMMARY_PROMPT,
  BULLET_POINT_PROMPT,
  SKILL_SUGGESTION_PROMPT,
  RESUME_SCORE_PROMPT,
  NARRATIVE_TO_RESUME_SYSTEM_PROMPT,
  NARRATIVE_TO_RESUME_PROMPT,
  TAILOR_PROMPT,
  COVER_LETTER_PROMPT,
} from './prompts';
import type { ParsedResumeData } from '@/types/resumeImport';
import { normalizeParsedData } from '@/services/fileImport/resumeMapper';
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
 * Default request options. maxTokens is a ceiling, not a cost — output is
 * only billed as generated, and a low cap is how we got truncated JSON.
 */
const DEFAULT_OPTIONS = {
  temperature: 0.7,
  maxTokens: 4096,
};

/**
 * Which registry capability serves each feature.
 */
const FEATURE_CAPABILITY: Record<'summary' | 'bullets' | 'skills' | 'score', AICapability> = {
  summary: 'text-quality',
  bullets: 'text-fast',
  skills: 'text-fast',
  score: 'text-quality',
};

/**
 * Resolve models for a feature. An explicit options.model pins the request
 * to that model; otherwise the registry supplies a validated chain that is
 * also sent as OpenRouter's server-side fallback array.
 */
async function resolveFeatureModels(
  feature: keyof typeof FEATURE_CAPABILITY,
  options?: AIRequestOptions
): Promise<{ model: AIModel; models: string[] }> {
  if (options?.model) {
    return { model: options.model, models: [options.model] };
  }
  const chain = await resolveModelChain(FEATURE_CAPABILITY[feature]);
  return { model: chain[0], models: chain };
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
  const { model, models } = await resolveFeatureModels('summary', options);

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: SUMMARY_PROMPT(context) },
    ],
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
    maxTokens: options?.maxTokens ?? DEFAULT_OPTIONS.maxTokens,
    responseFormat: 'json_object',
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

  const { model, models } = await resolveFeatureModels('bullets', options);

  const context: Partial<AIContext> = {
    jobTitle: experience.title,
  };

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: BULLET_POINT_PROMPT(experience.bullets, context) },
    ],
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
    maxTokens: options?.maxTokens ?? DEFAULT_OPTIONS.maxTokens,
    responseFormat: 'json_object',
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

  const { model, models } = await resolveFeatureModels('skills', options);

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: SKILL_SUGGESTION_PROMPT(jobTitle, industry, existingSkills),
      },
    ],
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
    maxTokens: options?.maxTokens ?? DEFAULT_OPTIONS.maxTokens,
    responseFormat: 'json_object',
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
  const { model, models } = await resolveFeatureModels('score', options);

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: RESUME_SCORE_PROMPT(resume, jobDescription) },
    ],
    temperature: 0.5, // Lower temperature for more consistent scoring
    maxTokens: options?.maxTokens ?? DEFAULT_OPTIONS.maxTokens,
    responseFormat: 'json_object',
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
  const { model, models } = await resolveFeatureModels('bullets', options);

  const response = await chatCompletion({
    model,
    models,
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
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
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
  const { model, models } = await resolveFeatureModels('summary', options);

  const streamingPrompt = `Based on the following context, write ONE professional summary paragraph for a resume. The summary should be 3-4 sentences, highlight key achievements, and be written in first person. Do NOT use JSON format - just write the summary text directly.

Context:
- Job Title: ${context.jobTitle || 'Professional'}
- Skills: ${context.skills?.join(', ') || 'Various professional skills'}
- Current Summary: ${context.currentSummary || 'None provided'}
${context.experience?.length ? `- Experience: ${context.experience.map(e => e.title + ' at ' + e.company).join('; ')}` : ''}

Write a compelling, achievement-focused professional summary:`;

  await streamingChatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: streamingPrompt },
    ],
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
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
  const { model, models } = await resolveFeatureModels('bullets', options);

  const streamingPrompt = `Transform this job responsibility into an achievement-focused bullet point. Start with a strong action verb, include metrics if possible, and keep it under 20 words. Do NOT use JSON format - just write the improved bullet point directly.

Original: "${bullet}"
${jobTitle ? `Role: ${jobTitle}` : ''}

Improved bullet point:`;

  await streamingChatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: streamingPrompt },
    ],
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
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
  const { model, models } = await resolveFeatureModels('summary', options);

  await streamingChatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: options?.temperature ?? DEFAULT_OPTIONS.temperature,
    maxTokens: options?.maxTokens ?? DEFAULT_OPTIONS.maxTokens,
    onChunk: callbacks.onChunk,
    onComplete: callbacks.onComplete,
    onError: callbacks.onError,
  });
}

/**
 * Result of structuring a free-text "tell me about yourself" narrative.
 * Mirrors the resume parser's output so downstream apply code is reused.
 */
export interface NarrativeStructureResult {
  /** AI's confidence (0..1) — low for sparse input, high for detailed. */
  confidence: number;
  /** Every assumption the AI had to make. Surface to the user for review. */
  warnings: string[];
  /** Parsed resume data — same shape as resume PDF import. */
  data: ParsedResumeData;
  model: string;
  tokensUsed: number;
}

/**
 * Turn a user's casual, free-text self-description into a structured
 * resume payload. The killer "magic moment" of the app: user types or
 * speaks one paragraph and gets a populated resume back.
 *
 * Uses a lower temperature than creative generation (0.4 vs 0.7) because
 * fidelity to what the user said matters more than creative phrasing.
 * Caller is responsible for previewing the result + applying it via the
 * resume store (don't auto-apply — user must confirm).
 */
export async function structureFromNarrative(
  narrative: string,
  options?: AIRequestOptions
): Promise<NarrativeStructureResult> {
  if (!narrative || narrative.trim().length < 20) {
    throw createAIError(
      'PARSE_ERROR',
      'Please write at least a sentence or two about yourself so the AI has something to work with.'
    );
  }

  const { model, models } = await resolveFeatureModels('summary', options);
  // Cap input at ~6000 chars (~1500 tokens) so the response has room.
  const trimmed = narrative.trim().slice(0, 6000);

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: NARRATIVE_TO_RESUME_SYSTEM_PROMPT },
      { role: 'user', content: NARRATIVE_TO_RESUME_PROMPT(trimmed) },
    ],
    temperature: 0.4,
    maxTokens: 8192,
    responseFormat: 'json_object',
  });

  const parsed = parseJSONResponse<{
    confidence: number;
    warnings: string[];
    data: ParsedResumeData;
  }>(response.content);

  if (!parsed?.data?.header) {
    throw createAIError(
      'PARSE_ERROR',
      'The AI returned an unexpected response. Try rephrasing your description.'
    );
  }

  return {
    confidence: parsed.confidence ?? 0.5,
    warnings: parsed.warnings ?? [],
    // Normalize so the wizard's review view + apply step never crash on a
    // section the AI omitted (e.g. no education key for a self-taught dev).
    data: normalizeParsedData(parsed.data),
    model: response.model,
    tokensUsed: response.tokensUsed,
  };
}

/* ----------------------------------------------------------------------------
 * v1.10 — Job-outcome features
 * -------------------------------------------------------------------------- */

/** One experience entry's rewritten bullets, keyed back to the store. */
export interface ExperienceRewrite {
  experienceId: string;
  bullets: string[];
}

/** Result of tailoring a resume against a job posting. */
export interface TailorResult {
  matchScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryRewrite: string;
  experienceRewrites: ExperienceRewrite[];
  skillsToAdd: string[];
  model: string;
  tokensUsed: number;
}

/**
 * Analyze a resume against a job posting and produce applicable rewrites.
 * The analysis (score + keywords) is shown free — it proves the value.
 * Applying the rewrites is the Pro action, handled by the caller.
 */
export async function tailorToJob(
  resume: Resume,
  jobDescription: string,
  options?: AIRequestOptions
): Promise<TailorResult> {
  const jd = (jobDescription || '').trim();
  if (jd.length < 60) {
    throw createAIError(
      'PARSE_ERROR',
      'Paste the full job posting (or at least its requirements section) so the AI has something to match against.'
    );
  }

  const { model, models } = await resolveFeatureModels('score', options);
  const payload = {
    jobTitle: resume.header.jobTitle,
    summary: resume.summary,
    skills: resume.skills.map((s) => s.name),
    experience: resume.experience.map((e) => ({
      id: e.id,
      title: e.title,
      company: e.company,
      bullets: e.bullets ?? [],
    })),
  };

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      // Cap the JD at ~8k chars so long postings leave room for the answer.
      { role: 'user', content: TAILOR_PROMPT(payload, jd.slice(0, 8000)) },
    ],
    temperature: 0.4, // fidelity over creativity — these get applied verbatim
    maxTokens: 8192,
    responseFormat: 'json_object',
  });

  const parsed = parseJSONResponse<Omit<TailorResult, 'model' | 'tokensUsed'>>(response.content);

  if (typeof parsed?.matchScore !== 'number' || !Array.isArray(parsed.missingKeywords)) {
    throw createAIError('PARSE_ERROR', 'Invalid response format for job tailoring');
  }

  // Only keep rewrites that reference real experience entries — the model
  // occasionally invents ids; applying those would silently no-op or crash.
  const validIds = new Set(resume.experience.map((e) => e.id));
  const experienceRewrites = (parsed.experienceRewrites ?? []).filter(
    (r) => r && validIds.has(r.experienceId) && Array.isArray(r.bullets) && r.bullets.length > 0
  );

  return {
    matchScore: Math.min(100, Math.max(0, parsed.matchScore)),
    matchedKeywords: (parsed.matchedKeywords ?? []).slice(0, 10),
    missingKeywords: (parsed.missingKeywords ?? []).slice(0, 8),
    summaryRewrite: parsed.summaryRewrite ?? '',
    experienceRewrites,
    skillsToAdd: (parsed.skillsToAdd ?? []).slice(0, 6),
    model: response.model,
    tokensUsed: response.tokensUsed,
  };
}

/**
 * Generate a cover letter from the resume + a job posting. Returns plain
 * text the user edits before sending. Pro feature — gate at the caller.
 */
export async function generateCoverLetter(
  resume: Resume,
  jobDescription: string,
  options?: AIRequestOptions
): Promise<{ letter: string; model: string; tokensUsed: number }> {
  const jd = (jobDescription || '').trim();
  if (jd.length < 60) {
    throw createAIError(
      'PARSE_ERROR',
      'Paste the job posting so the letter can speak to what they ask for.'
    );
  }

  const { model, models } = await resolveFeatureModels('summary', options);
  const payload = {
    fullName: resume.header.fullName,
    jobTitle: resume.header.jobTitle,
    summary: resume.summary,
    skills: resume.skills.map((s) => s.name),
    experience: resume.experience.map((e) => ({
      title: e.title,
      company: e.company,
      bullets: e.bullets ?? [],
    })),
  };

  const response = await chatCompletion({
    model,
    models,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: COVER_LETTER_PROMPT(payload, jd.slice(0, 8000)) },
    ],
    temperature: 0.7,
    maxTokens: 1024,
  });

  const letter = response.content.trim();
  if (letter.length < 80) {
    throw createAIError('PARSE_ERROR', 'The AI returned an unusually short letter. Try again.');
  }

  return { letter, model: response.model, tokensUsed: response.tokensUsed };
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
  structureFromNarrative,
  buildContextFromResume,
  streamTextGeneration,
  tailorToJob,
  generateCoverLetter,
};

export default resumeAIService;
