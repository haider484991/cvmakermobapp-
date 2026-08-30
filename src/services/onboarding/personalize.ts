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

/**
 * An onboarding choice. Only the id and the emoji live in code: the id is what
 * gets stored on the profile, and the emoji is language-neutral. Every piece of
 * display text is looked up from the locale files, because these labels are
 * read by users in 12 languages AND some of them (the level hints) end up
 * inside the narrative the AI turns into a resume.
 */
export interface Option {
  id: string;
  emoji: string;
}

/** Label key for a goal / industry chip. */
export const goalLabelKey = (id: string): string => `onboarding.options.goals.${id}`;
export const industryLabelKey = (id: string): string => `onboarding.options.industries.${id}`;
export const levelLabelKey = (id: string): string => `onboarding.options.levels.${id}.label`;
export const levelDescriptionKey = (id: string): string =>
  `onboarding.options.levels.${id}.description`;

export const ONBOARDING_GOALS: Option[] = [
  { id: 'new-job', emoji: '🎯' },
  { id: 'first-job', emoji: '🌱' },
  { id: 'career-switch', emoji: '🔄' },
  { id: 'promotion', emoji: '📈' },
  { id: 'exploring', emoji: '✨' },
];

export const ONBOARDING_INDUSTRIES: Option[] = [
  { id: 'tech', emoji: '💻' },
  { id: 'healthcare', emoji: '🏥' },
  { id: 'finance', emoji: '💰' },
  { id: 'marketing', emoji: '📣' },
  { id: 'education', emoji: '📚' },
  { id: 'engineering', emoji: '⚙️' },
  { id: 'design', emoji: '🎨' },
  { id: 'sales', emoji: '📈' },
  { id: 'other', emoji: '✨' },
];

export const ONBOARDING_LEVELS: Option[] = [
  { id: 'entry', emoji: '🌱' },
  { id: 'mid', emoji: '🌿' },
  { id: 'senior', emoji: '🌳' },
  { id: 'executive', emoji: '🏆' },
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

/**
 * The subset of i18next's `t` we need. Declared structurally so this module
 * stays free of React and i18next imports and remains directly testable.
 */
export type Translate = (key: string, vars?: Record<string, string>) => string;

/** Industry name as it reads inside a sentence, e.g. "technology". */
function industryPhrase(id: string | undefined, t: Translate): string | null {
  if (!id || id === 'other') return null;
  const found = ONBOARDING_INDUSTRIES.find((i) => i.id === id);
  if (!found) return null;
  // Lower-casing is an English/European convention; locales where it is wrong
  // (German nouns, CJK) supply an already-correct in-sentence form instead.
  return t(`onboarding.options.industries.${found.id}Inline`);
}

/**
 * Build a starter narrative for the AI wizard from what onboarding learned.
 * Returns '' when we know too little to help (so the wizard stays blank
 * rather than seeding a useless "I'm a [role]..." stub).
 *
 * The result intentionally contains [bracketed] prompts the user fills in —
 * it's a scaffold to edit, not a finished paragraph. Those brackets are load
 * bearing: `detectPlaceholder()` treats their presence as proof the user has
 * not replaced that part yet, so every locale must keep them.
 *
 * Localised because this text is the AI's input, and the resume comes back in
 * whatever language the narrative was written in.
 */
export function seedNarrative(profile: OnboardingProfile, t: Translate): string {
  const role = profile.targetRole?.trim();
  const industry = industryPhrase(profile.industry, t);
  const level = ONBOARDING_LEVELS.find((l) => l.id === profile.experienceLevel);

  // Need at least a role or an industry to make a useful scaffold.
  if (!role && !industry) return '';

  const roleText = role || t('onboarding.seed.roleFallback');
  const expText = level
    ? t('onboarding.seed.yearsOfExperience', {
        years: t(`onboarding.options.levels.${level.id}.yearsHint`),
      })
    : t('onboarding.seed.experienceFallback');
  const inText = industry ? t('onboarding.seed.inIndustry', { industry }) : '';

  const lines = [
    t('onboarding.seed.line1', { role: roleText, experience: expText, industry: inText }),
    t('onboarding.seed.line2'),
    t('onboarding.seed.line3'),
    t('onboarding.seed.line4'),
  ];
  return lines.join(t('onboarding.seed.join'));
}

/** First-name greeting helper, safe for empty/whitespace input. */
export function greetingName(profile: OnboardingProfile): string | null {
  const n = profile.firstName?.trim();
  return n ? n.split(/\s+/)[0] : null;
}
