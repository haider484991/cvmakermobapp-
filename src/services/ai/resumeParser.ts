/**
 * AI Resume Parser Service
 * Uses OpenRouter to extract structured data from resume files
 */

import type { ParsedResumeData, ResumeParseResult, ImportFileType } from '@/types/resumeImport';
import { createAIError, parseJSONResponse, parseAPIError } from '@/lib/openrouter';
import { RESUME_PARSE_SYSTEM_PROMPT, RESUME_PARSE_PROMPT } from './prompts';
import type { AIError } from '@/types/ai';

/**
 * OpenRouter base URL
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Models for parsing resumes — multimodal (vision + document understanding).
 *
 * IMPORTANT: model IDs get deprecated by OpenRouter without warning. We
 * learned this twice:
 *   - grok-4.1-fast → 404 (migrated to grok-4.3)
 *   - gemini-2.0-flash-001 → "No endpoints found" (this fix)
 *
 * To survive the next one, we:
 *   1. Read an optional override from env (EXPO_PUBLIC_PARSE_MODEL) so a
 *      future break is a config change, not a code+rebuild cycle.
 *   2. Fall through a chain of models — if the primary has no endpoints,
 *      we retry the next one before surfacing an error to the user.
 *
 * All listed models support the OpenAI-style image_url payload we send
 * (base64 PDF page or photo).
 */
const PARSE_MODEL_CHAIN: string[] = [
  process.env.EXPO_PUBLIC_PARSE_MODEL,
  'google/gemini-2.5-flash',
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
].filter(Boolean) as string[];

/**
 * Temperature for consistent parsing
 */
const PARSE_TEMPERATURE = 0.3;

/**
 * Max tokens for response
 */
const MAX_TOKENS = 4096;

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

/**
 * Parse resume content using AI with vision support
 * Works with PDFs, DOCX (sent as base64), and images
 */
export async function parseResumeWithAI(
  base64Content: string,
  fileType: ImportFileType,
  mimeType: string
): Promise<ResumeParseResult> {
  const apiKey = getApiKey();

  try {
    // OpenAI-compatible multimodal payload — same for every model in the
    // chain (text prompt + base64 image_url).
    const userContent: any[] = [
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

    // Try each model in the chain. If a model is deprecated / has no
    // endpoints (the bug we're fixing), fall through to the next one
    // instead of failing the whole import.
    let response: Response | null = null;
    let lastModelError = '';
    for (const model of PARSE_MODEL_CHAIN) {
      console.log('[ResumeParser] Trying model:', model, 'for file type:', fileType);
      const r = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://freeresumeai.app',
          'X-Title': 'FreeResume AI',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: RESUME_PARSE_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          temperature: PARSE_TEMPERATURE,
          max_tokens: MAX_TOKENS,
        }),
      });

      if (r.ok) {
        response = r;
        break;
      }

      // Not OK — decide whether to try the next model or bail.
      const errorData = await r.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API error: ${r.status}`;
      lastModelError = errorMessage;
      const isModelGone =
        r.status === 404 ||
        /no endpoints|not found|no allowed providers|is not a valid model/i.test(errorMessage);

      console.error('[ResumeParser] Model failed:', model, r.status, errorMessage);

      if (isModelGone) {
        // Deprecated / unavailable model — try the next in the chain.
        continue;
      }

      // Hard errors that won't be fixed by switching model — surface now.
      if (r.status === 401) {
        throw createAIError('API_KEY_INVALID', 'Invalid API key. Please check your configuration.');
      } else if (r.status === 429) {
        throw createAIError('RATE_LIMITED', 'Rate limit exceeded. Please try again in a few minutes.');
      } else if (r.status === 503) {
        throw createAIError('MODEL_UNAVAILABLE', 'AI service is temporarily unavailable. Please try again.');
      } else if (r.status === 400) {
        if (errorMessage.includes('file') || errorMessage.includes('format') || errorMessage.includes('content')) {
          throw createAIError('PARSE_ERROR', 'Unable to process this file. Try using an image (PNG/JPG) of your resume instead.');
        }
        throw createAIError('PARSE_ERROR', errorMessage);
      } else if (r.status === 413) {
        throw createAIError('PARSE_ERROR', 'File is too large. Please use a smaller file or an image.');
      }
      // Unknown non-model error — try next model as a last resort.
    }

    if (!response) {
      // Every model in the chain failed (all deprecated / unavailable).
      throw createAIError(
        'MODEL_UNAVAILABLE',
        `Couldn't reach the AI service to read your resume (${lastModelError}). Please try again, or use "Build with AI" to type your details.`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw createAIError('PARSE_ERROR', 'No content in AI response');
    }

    // Parse the JSON response
    const parsed = parseJSONResponse<AIParseResponse>(content);

    // Validate the parsed data structure
    if (!parsed.data || !parsed.data.header) {
      throw createAIError('PARSE_ERROR', 'Invalid data structure in AI response');
    }

    // Ensure all required fields have default values
    const normalizedData = normalizeParseData(parsed.data);

    return {
      success: true,
      data: normalizedData,
      confidence: parsed.confidence ?? 0.5,
      warnings: parsed.warnings ?? [],
    };
  } catch (error) {
    if ((error as AIError).code) {
      return {
        success: false,
        data: null,
        confidence: 0,
        warnings: [],
        error: (error as AIError).message,
      };
    }

    const aiError = parseAPIError(error);
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
