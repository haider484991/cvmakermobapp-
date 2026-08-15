/**
 * AI Resume Scoring Service
 * Analyzes resumes and provides scores with improvement suggestions
 */

import { chatCompletion, parseJSONResponse } from '@/lib/openrouter';
import { resolveModelChain } from '@/services/ai/modelRegistry';
import type { Resume } from '@/types/resume';

export interface ResumeScore {
  overall: number; // 0-100
  categories: {
    content: number;
    formatting: number;
    keywords: number;
    impact: number;
    completeness: number;
  };
  strengths: string[];
  improvements: string[];
  tips: string[];
  atsCompatibility: number; // 0-100
}

export interface ScoringResult {
  success: boolean;
  score: ResumeScore | null;
  error?: string;
}

const SCORING_SYSTEM_PROMPT = `You are an expert resume reviewer and career coach. Analyze resumes and provide detailed scoring with actionable feedback.

You must respond with valid JSON only, no markdown or explanation. Use this exact structure:
{
  "overall": <number 0-100>,
  "categories": {
    "content": <number 0-100>,
    "formatting": <number 0-100>,
    "keywords": <number 0-100>,
    "impact": <number 0-100>,
    "completeness": <number 0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "tips": ["<actionable tip 1>", "<actionable tip 2>"],
  "atsCompatibility": <number 0-100>
}

Scoring Guidelines:
- content: Quality of experience descriptions, achievements, quantified results
- formatting: Structure, readability, professional presentation
- keywords: Industry-relevant terms, skills alignment
- impact: Action verbs, measurable achievements, value demonstration
- completeness: All sections filled, contact info, education, experience
  (certifications/languages/awards are optional extras — their absence must
  not tank the score when core sections are strong)
- atsCompatibility: How well the resume will pass Applicant Tracking Systems

Ground the scores in evidence before writing them: count bullets with numbers
vs without, count weak openers ("Responsible for", "Helped"), check whether the
summary is specific to this person or could fit anyone.

Calibration — use the full 0-100 range, don't cluster at 70-85:
- 90-100 interview-ready | 75-89 strong with clear upgrades left
- 60-74 real gaps (generic bullets, missing metrics, thin sections)
- 40-59 substantial rework | below 40 skeleton resume

Be encouraging but honest. Focus on actionable improvements.`;

function buildScoringPrompt(resume: Resume): string {
  const sections = [];

  // Header
  if (resume.header) {
    const contact = resume.header.contact ?? {};
    sections.push(`CONTACT INFO:
Name: ${resume.header.fullName || 'Not provided'}
Title: ${resume.header.jobTitle || 'Not provided'}
Email: ${contact.email || 'Not provided'}
Phone: ${contact.phone || 'Not provided'}
Location: ${contact.location || 'Not provided'}
LinkedIn: ${contact.linkedin || 'Not provided'}`);
  }

  // Summary
  if (resume.summary) {
    sections.push(`PROFESSIONAL SUMMARY:\n${resume.summary}`);
  }

  // Experience
  if (resume.experience?.length > 0) {
    const expText = resume.experience.map(exp =>
      `- ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.isCurrentRole ? 'Present' : exp.endDate})
  ${exp.description || ''}
  ${exp.bullets?.join('\n  ') || ''}`
    ).join('\n');
    sections.push(`EXPERIENCE:\n${expText}`);
  }

  // Education
  if (resume.education?.length > 0) {
    const eduText = resume.education.map(edu =>
      `- ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.endDate})${edu.gpa ? ` GPA: ${edu.gpa}` : ''}`
    ).join('\n');
    sections.push(`EDUCATION:\n${eduText}`);
  }

  // Skills
  if (resume.skills?.length > 0) {
    const skillsText = resume.skills.map(s => s.name).join(', ');
    sections.push(`SKILLS: ${skillsText}`);
  }

  // Projects
  if (resume.projects?.length > 0) {
    const projText = resume.projects.map(p =>
      `- ${p.name}: ${p.description}${p.technologies?.length ? ` (${p.technologies.join(', ')})` : ''}`
    ).join('\n');
    sections.push(`PROJECTS:\n${projText}`);
  }

  // Optional extras — shown so the scorer credits them instead of assuming
  // an incomplete resume.
  if (resume.certifications?.length > 0) {
    sections.push(
      `CERTIFICATIONS: ${resume.certifications.map(c => `${c.name} (${c.issuer})`).join('; ')}`
    );
  }
  if (resume.languages?.length > 0) {
    sections.push(`LANGUAGES: ${resume.languages.map(l => `${l.name} (${l.proficiency})`).join(', ')}`);
  }
  if (resume.awards?.length > 0) {
    sections.push(`AWARDS: ${resume.awards.map(a => a.title).join('; ')}`);
  }

  return `Please analyze and score this resume:\n\n${sections.join('\n\n')}`;
}

/**
 * Score a resume using AI
 */
export async function scoreResume(resume: Resume): Promise<ScoringResult> {
  try {
    console.log('[ResumeScorer] Starting resume analysis...');

    const prompt = buildScoringPrompt(resume);
    const models = await resolveModelChain('text-quality');

    const result = await chatCompletion({
      model: models[0],
      models,
      messages: [
        { role: 'system', content: SCORING_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: 'json_object',
    });

    const score = parseJSONResponse<ResumeScore>(result.content);

    console.log('[ResumeScorer] Analysis complete. Score:', score.overall);

    return {
      success: true,
      score,
    };
  } catch (error) {
    console.error('[ResumeScorer] Error:', error);
    return {
      success: false,
      score: null,
      error: error instanceof Error ? error.message : 'Failed to analyze resume',
    };
  }
}

/**
 * Get a quick score estimate based on completeness
 * Used as fallback or initial estimate
 */
export function getQuickScore(resume: Resume): number {
  let score = 0;
  let maxScore = 0;

  // Contact info (20 points)
  maxScore += 20;
  const contact = resume.header?.contact;
  if (resume.header?.fullName) score += 5;
  if (contact?.email) score += 5;
  if (contact?.phone) score += 3;
  if (contact?.location) score += 3;
  if (contact?.linkedin) score += 4;

  // Summary (15 points)
  maxScore += 15;
  if (resume.summary) {
    const wordCount = resume.summary.split(/\s+/).length;
    if (wordCount >= 30) score += 15;
    else if (wordCount >= 15) score += 10;
    else if (wordCount > 0) score += 5;
  }

  // Experience (30 points)
  maxScore += 30;
  if (resume.experience?.length > 0) {
    score += Math.min(resume.experience.length * 8, 24);
    // Bonus for descriptions
    const hasDescriptions = resume.experience.some(e => e.description || e.bullets?.length);
    if (hasDescriptions) score += 6;
  }

  // Education (15 points)
  maxScore += 15;
  if (resume.education?.length > 0) {
    score += Math.min(resume.education.length * 8, 15);
  }

  // Skills (15 points)
  maxScore += 15;
  if (resume.skills?.length > 0) {
    score += Math.min(resume.skills.length * 2, 15);
  }

  // Projects (5 points bonus)
  maxScore += 5;
  if (resume.projects?.length > 0) {
    score += Math.min(resume.projects.length * 2, 5);
  }

  return Math.round((score / maxScore) * 100);
}

export default {
  scoreResume,
  getQuickScore,
};
