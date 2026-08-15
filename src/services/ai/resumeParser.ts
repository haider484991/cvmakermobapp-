/**
 * AI Resume Parser Service
 * Uses OpenRouter to extract structured data from resume files
 */

import type { ParsedResumeData, ResumeParseResult, ImportFileType } from '@/types/resumeImport';
import { createAIError, parseJSONResponse, parseAPIError } from '@/lib/openrouter';
import { resolveModelChain, assertChain } from '@/services/ai/modelRegistry';
import { captureError } from '@/services/analytics/sentry';
import { RESUME_PARSE_SYSTEM_PROMPT, RESUME_PARSE_PROMPT } from './prompts';
import type { AIError } from '@/types/ai';

/**
 * OpenRouter base URL
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Temperature for consistent parsing
 */
const PARSE_TEMPERATURE = 0.3;

/**
 * Output budget for the extracted-resume JSON. The old cap of 4096 is what
 * produced the "Failed to parse AI response as JSON" wave in Sentry: dense
 * resumes (plus any reasoning tokens) overran it, the JSON arrived cut off
 * mid-object, and every retry failed the same way. Output tokens are only
 * billed as used, so a high ceiling costs nothing on normal resumes.
 */
const PARSE_MAX_TOKENS = 16384;
const PARSE_RETRY_MAX_TOKENS = 32768;

/**
 * Total API calls we allow per import before giving up (covers one
 * truncation retry and/or unparseable-output fallbacks to other models).
 */
const PARSE_MAX_ATTEMPTS = 3;

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw createAIError('API_KEY_MISSING', 'OpenRouter API key is not configured');
  }
  return apiKey;
}

/**
 * Raw response from AI parsing
 */
interface AIParseResponse {
  confidence: number;
  warnings: string[];
  data: ParsedResumeData;
}

interface ParseAPIResult {
  content: string;
  usedModel: string;
  finishReason: string;
}

/**
 * One OpenRouter round trip. `models` is sent as the server-side fallback
 * array, so deprecated/unavailable entries fall through without us seeing
 * an error — model deprecations (grok-4.1-fast, gemini-2.0-flash-001)
 * used to break imports until the next store release.
 */
async function callParseAPI(
  models: string[],
  userContent: unknown,
  maxTokens: number,
  apiKey: string
): Promise<ParseAPIResult> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://freeresumeai.app',
      'X-Title': 'FreeResume AI',
    },
    body: JSON.stringify({
      model: models[0],
      // OpenRouter rejects fallback arrays longer than 3 with a 400.
      models: models.length > 1 ? models.slice(0, 3) : undefined,
      messages: [
        { role: 'system', content: RESUME_PARSE_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: PARSE_TEMPERATURE,
      max_tokens: maxTokens,
      // Extraction needs syntax guarantees, not thinking: reasoning tokens
      // count against max_tokens and were the main truncation culprit.
      response_format: { type: 'json_object' },
      reasoning: { enabled: false },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `API error: ${response.status}`;

    if (response.status === 401) {
      throw createAIError('API_KEY_INVALID', 'Invalid API key. Please check your configuration.');
    } else if (response.status === 429) {
      throw createAIError('RATE_LIMITED', 'Rate limit exceeded. Please try again in a few minutes.');
    } else if (response.status === 503 || response.status === 404) {
      // With the fallback array in play, this means every model in the
      // chain was unavailable — not a per-model blip.
      throw createAIError(
        'MODEL_UNAVAILABLE',
        'The AI service is temporarily unavailable. Please try again, or use "Build with AI" to type your details.'
      );
    } else if (response.status === 400) {
      if (errorMessage.includes('file') || errorMessage.includes('format') || errorMessage.includes('content')) {
        throw createAIError('PARSE_ERROR', 'Unable to process this file. Try using an image (PNG/JPG) of your resume instead.');
      }
      throw createAIError('PARSE_ERROR', errorMessage);
    } else if (response.status === 413) {
      throw createAIError('PARSE_ERROR', 'File is too large. Please use a smaller file or an image.');
    }
    throw createAIError('UNKNOWN_ERROR', errorMessage);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? '',
    usedModel: data.model ?? models[0],
    finishReason: choice?.finish_reason ?? 'unknown',
  };
}

/**
 * Parse resume content using AI with vision support
 * Works with PDFs, DOCX (sent as base64), and images
 */
export async function parseResumeWithAI(
  base64Content: string,
  fileType: ImportFileType,
  mimeType: string
): Promise<ResumeParseResult> {
  let chain: string[] = [];
  const attemptLog: string[] = [];

  try {
    const apiKey = getApiKey();

    chain = await resolveModelChain('parse');
    assertChain(chain);

    // OpenAI-compatible multimodal payload — same for every model in the
    // chain (text prompt + base64 image_url).
    const userContent = [
      {
        type: 'text',
        text: RESUME_PARSE_PROMPT(fileType),
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Content}`,
        },
      },
    ];

    let models = [...chain];
    let maxTokens = PARSE_MAX_TOKENS;

    for (let attempt = 1; attempt <= PARSE_MAX_ATTEMPTS && models.length > 0; attempt++) {
      const { content, usedModel, finishReason } = await callParseAPI(
        models,
        userContent,
        maxTokens,
        apiKey
      );

      // Ran out of output budget: raise it once; if that also truncates,
      // rotate to the next model as well.
      if (finishReason === 'length') {
        attemptLog.push(`${usedModel}: truncated at ${maxTokens}`);
        if (maxTokens < PARSE_RETRY_MAX_TOKENS) {
          maxTokens = PARSE_RETRY_MAX_TOKENS;
        } else {
          models = dropModel(models, usedModel);
        }
        continue;
      }

      if (!content) {
        attemptLog.push(`${usedModel}: empty response`);
        models = dropModel(models, usedModel);
        continue;
      }

      let parsed: AIParseResponse;
      try {
        parsed = parseJSONResponse<AIParseResponse>(content);
      } catch {
        attemptLog.push(`${usedModel}: unparseable JSON (${content.length} chars, finish=${finishReason})`);
        models = dropModel(models, usedModel);
        continue;
      }

      if (!parsed.data || !parsed.data.header) {
        attemptLog.push(`${usedModel}: JSON missing data.header`);
        models = dropModel(models, usedModel);
        continue;
      }

      return {
        success: true,
        data: normalizeParseData(parsed.data),
        confidence: parsed.confidence ?? 0.5,
        warnings: parsed.warnings ?? [],
      };
    }

    // Every attempt produced unusable output. Report with enough context
    // to diagnose from the Sentry event alone (no resume content attached).
    captureError(new Error('Resume import: AI parse failed after all attempts'), {
      feature: 'resume_import_parse',
      fileType,
      mimeType,
      chain: chain.join(', '),
      attempts: attemptLog.join(' | '),
    });

    throw createAIError(
      'PARSE_ERROR',
      'Couldn\'t read your resume this time. Please try again — or use "Build with AI" to type your details.'
    );
  } catch (error) {
    const aiError: AIError = (error as AIError).code
      ? (error as AIError)
      : parseAPIError(error);

    // Hard failures (invalid key, rate limit, all models down, …) are worth
    // an event too; parse-exhaustion was already reported above with detail.
    if (aiError.code !== 'PARSE_ERROR') {
      captureError(new Error(`Resume import failed: ${aiError.code}`), {
        feature: 'resume_import_parse',
        fileType,
        mimeType,
        chain: chain.join(', '),
        attempts: attemptLog.join(' | '),
        message: aiError.message,
      });
    }

    return {
      success: false,
      data: null,
      confidence: 0,
      warnings: [],
      error: aiError.message,
    };
  }
}

/**
 * Remove the model that just answered from the retry list. If the server
 * reported an ID we don't recognize (provider-suffixed variants), drop the
 * head instead so a retry never re-runs an identical request.
 */
function dropModel(models: string[], usedModel: string): string[] {
  const next = models.filter((m) => m !== usedModel);
  return next.length === models.length ? models.slice(1) : next;
}

/**
 * Normalize parsed data to ensure all fields have proper default values
 */
function normalizeParseData(data: ParsedResumeData): ParsedResumeData {
  return {
    header: {
      fullName: data.header?.fullName ?? '',
      jobTitle: data.header?.jobTitle ?? '',
      contact: {
        email: data.header?.contact?.email ?? '',
        phone: data.header?.contact?.phone ?? '',
        location: data.header?.contact?.location ?? '',
        linkedin: data.header?.contact?.linkedin,
        website: data.header?.contact?.website,
        github: data.header?.contact?.github,
      },
    },
    summary: data.summary ?? '',
    experience: (data.experience ?? []).map((exp) => ({
      company: exp.company ?? '',
      title: exp.title ?? '',
      location: exp.location ?? '',
      startDate: normalizeDate(exp.startDate),
      endDate: exp.isCurrentRole ? null : normalizeDate(exp.endDate),
      isCurrentRole: exp.isCurrentRole ?? false,
      description: exp.description ?? '',
      bullets: Array.isArray(exp.bullets) ? exp.bullets : [],
    })),
    education: (data.education ?? []).map((edu) => ({
      institution: edu.institution ?? '',
      degree: edu.degree ?? '',
      field: edu.field ?? '',
      location: edu.location ?? '',
      startDate: normalizeDate(edu.startDate),
      endDate: normalizeDate(edu.endDate),
      gpa: edu.gpa,
      achievements: Array.isArray(edu.achievements) ? edu.achievements : undefined,
    })),
    skills: (data.skills ?? []).map((skill) => ({
      name: skill.name ?? '',
      level: normalizeSkillLevel(skill.level),
      category: skill.category,
    })),
    projects: (data.projects ?? []).map((proj) => ({
      name: proj.name ?? '',
      description: proj.description ?? '',
      technologies: Array.isArray(proj.technologies) ? proj.technologies : [],
      link: proj.link,
      startDate: proj.startDate,
      endDate: proj.endDate,
    })),
    certifications: (data.certifications ?? []).map((cert) => ({
      name: cert.name ?? '',
      issuer: cert.issuer ?? '',
      date: normalizeDate(cert.date),
      expiryDate: cert.expiryDate,
      credentialId: cert.credentialId,
      link: cert.link,
    })),
    languages: (data.languages ?? []).map((lang) => ({
      name: lang.name ?? '',
      proficiency: normalizeLanguageProficiency(lang.proficiency),
    })),
    awards: (data.awards ?? []).map((award) => ({
      title: award.title ?? '',
      issuer: award.issuer ?? '',
      date: normalizeDate(award.date),
      description: award.description,
    })),
  };
}

/**
 * Normalize date format to YYYY-MM or empty string
 */
function normalizeDate(date: string | null | undefined): string {
  if (!date || date === 'Present' || date === 'null') return '';

  // If already in YYYY-MM format, return as-is
  if (/^\d{4}-\d{2}$/.test(date)) return date;

  // Try to parse and format
  try {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
  } catch {
    // Fall through to return original or empty
  }

  // Return as-is if it looks like a year
  if (/^\d{4}$/.test(date)) return date;

  return date || '';
}

/**
 * Normalize skill level to valid enum value
 */
function normalizeSkillLevel(
  level: string | undefined
): 'beginner' | 'intermediate' | 'advanced' | 'expert' | undefined {
  if (!level) return undefined;

  const normalized = level.toLowerCase();
  if (['beginner', 'intermediate', 'advanced', 'expert'].includes(normalized)) {
    return normalized as 'beginner' | 'intermediate' | 'advanced' | 'expert';
  }

  return undefined;
}

/**
 * Normalize language proficiency to valid enum value
 */
function normalizeLanguageProficiency(
  proficiency: string | undefined
): 'basic' | 'conversational' | 'professional' | 'native' {
  if (!proficiency) return 'conversational';

  const normalized = proficiency.toLowerCase();
  if (['basic', 'conversational', 'professional', 'native'].includes(normalized)) {
    return normalized as 'basic' | 'conversational' | 'professional' | 'native';
  }

  // Map common variations
  if (['elementary', 'beginner'].includes(normalized)) return 'basic';
  if (['fluent', 'full professional', 'advanced'].includes(normalized)) return 'professional';
  if (['native', 'bilingual', 'native or bilingual'].includes(normalized)) return 'native';

  return 'conversational';
}
