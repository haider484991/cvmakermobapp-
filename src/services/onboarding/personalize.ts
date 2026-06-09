/**
 * Onboarding personalization
 * --------------------------
 *
 * Single source of truth for the onboarding question options, plus the
 * functions that turn a user's answers into real downstream effects:
 *
 *   - defaultTemplateForProfile() picks a sensible FREE template for their
 *     industry/level, so the first resume already looks right (and never
 *     lands them on a premium template they can't use without paying).
 *   - seedNarrative() builds a starter paragraph for the AI wizard from
 *     what we know, so the user edits a scaffold instead of staring at a
 *     blank box — directly addressing the wizard's 71% blank-page drop-off.
 *
 * Keeping the option lists here (instead of inline in each screen) stops
 * the goals screen, the path picker, and the wizard from drifting apart.
 */

import type { OnboardingProfile } from '@/stores/uiStore';

export interface Option {
  id: string;
  label: string;
  emoji: string;
  description?: string;
}

export const ONBOARDING_GOALS: Option[] = [
  { id: 'new-job', label: 'Land a new job', emoji: '🎯' },
  { id: 'first-job', label: 'Get my first job', emoji: '🌱' },
  { id: 'career-switch', label: 'Switch careers', emoji: '🔄' },
  { id: 'promotion', label: 'Go for a promotion', emoji: '📈' },
  { id: 'exploring', label: 'Just exploring', emoji: '✨' },
];

export const ONBOARDING_INDUSTRIES: Option[] = [
  { id: 'tech', label: 'Technology', emoji: '💻' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'marketing', label: 'Marketing', emoji: '📣' },
  { id: 'education', label: 'Education', emoji: '📚' },
  { id: 'engineering', label: 'Engineering', emoji: '⚙️' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'sales', label: 'Sales', emoji: '📈' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

export const ONBOARDING_LEVELS: Array<Option & { years: string; yearsHint: string }> = [
  { id: 'entry', label: 'Entry Level', description: '0–2 years', years: '0-2 years', yearsHint: 'about a year', emoji: '🌱' },
  { id: 'mid', label: 'Mid Level', description: '3–5 years', years: '3-5 years', yearsHint: 'around 4 years', emoji: '🌿' },
  { id: 'senior', label: 'Senior', description: '6–10 years', years: '6-10 years', yearsHint: 'about 8 years', emoji: '🌳' },
  { id: 'executive', label: 'Executive', description: '10+ years', years: '10+ years', yearsHint: 'over a decade', emoji: '🏆' },
];

/**
 * Map an industry to a strong, FREE default template. Falls back to the
 * experience level, then to a universally-safe ATS template. We deliberately
 * never default to a premium template — the first resume should be one the
 * user can finish and download without hitting the paywall.
 */
export function defaultTemplateForProfile(profile: OnboardingProfile): string {
  const byIndustry: Record<string, string> = {
    tech: 'modern-pro',
    engineering: 'modern-pro',
    finance: 'finance-navy',
    healthcare: 'ats-professional',
    marketing: 'startup-bold',
    sales: 'sales-energetic',
    education: 'academic-serif',
    design: 'swiss-style',
  };
  if (profile.industry && byIndustry[profile.industry]) return byIndustry[profile.industry];

  const byLevel: Record<string, string> = {
    executive: 'executive',
    senior: 'consultant',
    mid: 'ats-professional',
    entry: 'minimal-clean',
  };
  if (profile.experienceLevel && byLevel[profile.experienceLevel]) return byLevel[profile.experienceLevel];

  return 'ats-professional';
}

/** Human-readable industry label, e.g. "technology", for prose. */
function industryPhrase(id?: string): string | null {
  if (!id || id === 'other') return null;
  const found = ONBOARDING_INDUSTRIES.find((i) => i.id === id);
  return found ? found.label.toLowerCase() : null;
}

/**
 * Build a starter narrative for the AI wizard from what onboarding learned.
 * Returns '' when we know too little to help (so the wizard stays blank
 * rather than seeding a useless "I'm a [role]..." stub).
 *
 * The result intentionally contains [bracketed] prompts the user fills in —
 * it's a scaffold to edit, not a finished paragraph.
 */
export function seedNarrative(profile: OnboardingProfile): string {
  const role = profile.targetRole?.trim();
  const industry = industryPhrase(profile.industry);
  const level = ONBOARDING_LEVELS.find((l) => l.id === profile.experienceLevel);

  // Need at least a role or an industry to make a useful scaffold.
  if (!role && !industry) return '';

  const roleText = role || 'professional';
  const expText = level ? `${level.yearsHint} of experience` : 'experience';
  const inText = industry ? ` in ${industry}` : '';

  const lines = [
    `I'm a ${roleText} with ${expText}${inText}.`,
    `Most recently I [your current or latest role] where I [one or two things you achieved — add numbers if you can].`,
    `Before that I [previous role and what you did].`,
    `I'm strong in [your top skills or tools], and I have [your degree or relevant certification].`,
  ];
  return lines.join(' ');
}

/** First-name greeting helper, safe for empty/whitespace input. */
export function greetingName(profile: OnboardingProfile): string | null {
  const n = profile.firstName?.trim();
  return n ? n.split(/\s+/)[0] : null;
}
