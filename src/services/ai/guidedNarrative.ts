/**
 * Guided narrative composer
 * -------------------------
 *
 * The wizard's free-text box asks the user to "write a paragraph about
 * yourself". Measured, that request fails: people either freeze or submit
 * whatever template we put in the box (14 of 36 generations were our own
 * example, verbatim). Adding a quality gate stops the bad input, but a gate
 * alone just turns a wasted call into a wall.
 *
 * This module is the way through the wall. Instead of one intimidating box,
 * the user answers a handful of small questions — most of them a single
 * field, several answerable by tapping a chip — and we assemble their answers
 * into the rich first-person narrative the AI wanted all along.
 *
 * Two rules govern the assembly, both inherited from the resume-writer craft
 * contract in prompts.ts:
 *
 *   1. NEVER invent. Every clause is emitted only when the user supplied the
 *      underlying fact. A blank field means a missing sentence, not a guess.
 *   2. Read like a person. The downstream prompt expects conversational prose
 *      ("sometimes with typos or fragments"), not a form dump, so we build
 *      real sentences rather than "Company: X | Title: Y".
 *
 * The composer is pure and has no React or React Native imports, so the
 * narrative it produces can be asserted against the quality gate in tests —
 * see __tests__/services/guidedNarrative.test.ts, which proves the guided
 * path yields input that scores 'strong'.
 */

export interface GuidedRole {
  title: string;
  company: string;
  /** Free text — "2021", "Jan 2021", "" are all acceptable. */
  startYear: string;
  /** Empty means "still there", which we render as "and I'm still there". */
  endYear: string;
  /** What they actually did. The quality-critical field. */
  highlights: string;
}

export interface GuidedAnswers {
  fullName: string;
  jobTitle: string;
  location: string;
  /** Most recent first. */
  roles: GuidedRole[];
  /** Students / career starters skip the roles step entirely. */
  noExperienceYet: boolean;
  skills: string[];
  education: string;
}

export function emptyRole(): GuidedRole {
  return { title: '', company: '', startYear: '', endYear: '', highlights: '' };
}

export function emptyAnswers(): GuidedAnswers {
  return {
    fullName: '',
    jobTitle: '',
    location: '',
    roles: [emptyRole()],
    noExperienceYet: false,
    skills: [],
    education: '',
  };
}

/** The industries we offer tap-to-add skills for (ONBOARDING_INDUSTRIES ids). */
export const SKILL_INDUSTRIES = [
  'tech',
  'healthcare',
  'finance',
  'marketing',
  'education',
  'engineering',
  'design',
  'sales',
  'other',
] as const;

/**
 * i18n key for an industry's tap-to-add skills. The lists themselves live in
 * the locale files, because a skill chip is not chrome — it goes verbatim
 * into the finished resume. A French user tapping "Patient care" and getting
 * an English phrase in their French CV is a broken resume, and it would also
 * fight the craft contract's rule that resume content stays in the language
 * the user wrote in. Product names (Figma, SAP, AWS…) are intentionally left
 * untranslated in every locale, because that is what they are called.
 */
export function skillsKeyForIndustry(industry?: string): string {
  const known = (SKILL_INDUSTRIES as readonly string[]).includes(industry ?? '');
  return `wizard.skills.${known ? industry : 'other'}`;
}

/**
 * Prompt keys for the "what did you do there?" step. Universal rather than
 * role-specific: they work for a nurse, a welder or a CFO, and they steer
 * toward the things that actually lift resume quality — scope, outcomes and
 * numbers — without putting words in the user's mouth.
 */
export const HIGHLIGHT_PROMPT_KEYS = ['daily', 'improved', 'led', 'numbers'] as const;

const clean = (s: string): string => s.trim().replace(/\s+/g, ' ');

/**
 * The subset of i18next's `t` we need. Declaring it structurally keeps this
 * module free of React and i18next imports, so it stays pure and the tests
 * can drive it with a plain function.
 */
export type Translate = (key: string, vars?: Record<string, string>) => string;

/** Join using the locale's own separator and conjunction. */
function listPhrase(items: string[], t: Translate): string {
  const xs = items.map(clean).filter(Boolean);
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0];
  const sep = t('wizard.compose.listSeparator');
  const and = t('wizard.compose.listAnd');
  return `${xs.slice(0, -1).join(sep)}${and}${xs[xs.length - 1]}`;
}

/** Localised date clause — never invents a date it wasn't given. */
function datePhrase(role: GuidedRole, t: Translate): string {
  const start = clean(role.startYear);
  const end = clean(role.endYear);
  if (start && end) return t('wizard.compose.dateRange', { start, end });
  if (start) return t('wizard.compose.dateSince', { start });
  if (end) return t('wizard.compose.dateUntil', { end });
  return '';
}

/**
 * Ensure a sentence ends in terminal punctuation without doubling it.
 * The `。` and `？` cases matter for ja/zh-CN, where the frames end in
 * full-width punctuation.
 */
function sentence(s: string): string {
  const x = clean(s);
  if (!x) return '';
  return /[.!?。！？]$/.test(x) ? x : `${x}.`;
}

/**
 * Pick the right role frame. Nine variants rather than string concatenation,
 * because "as a {{title}} at {{company}}" does not survive translation into
 * languages that order or inflect those parts differently.
 *
 * Three tenses, not two: a FIRST role that already ended is "most recently I
 * worked", not "right now I work" and not "before that" — there is nothing
 * before it. (The pre-i18n version produced "Right now I worked at…" here.)
 */
function roleSentence(role: GuidedRole, isFirst: boolean, t: Translate): string {
  const title = clean(role.title);
  const company = clean(role.company);
  if (!title && !company) return '';

  const tense = !isFirst ? 'past' : clean(role.endYear) ? 'recent' : 'current';
  const which = title && company ? 'Full' : title ? 'TitleOnly' : 'CompanyOnly';
  const dates = datePhrase(role, t);

  return sentence(
    t(`wizard.compose.role.${tense}${which}`, { title, company, dates }),
  );
}

/**
 * Turn the guided answers into the narrative the AI consumes, written in the
 * user's own language.
 *
 * Every clause is conditional on the user having supplied it, so a
 * half-finished form yields a shorter narrative rather than a fabricated one.
 * The frames come from the locale because the downstream prompt writes the
 * resume in whatever language the narrative is in — English scaffolding
 * around French answers would produce an English CV for a French user.
 */
export function composeNarrative(a: GuidedAnswers, t: Translate): string {
  const parts: string[] = [];

  // --- Who they are -------------------------------------------------------
  const name = clean(a.fullName);
  const title = clean(a.jobTitle);
  const location = clean(a.location);

  if (name && title) parts.push(sentence(t('wizard.compose.nameAndTitle', { name, title })));
  else if (name) parts.push(sentence(t('wizard.compose.nameOnly', { name })));
  else if (title) parts.push(sentence(t('wizard.compose.titleOnly', { title })));

  if (location) parts.push(sentence(t('wizard.compose.location', { location })));

  // --- Work history -------------------------------------------------------
  if (a.noExperienceYet) {
    parts.push(sentence(t('wizard.compose.noExperience')));
  } else {
    const usable = a.roles.filter((r) => clean(r.title) || clean(r.company) || clean(r.highlights));
    usable.forEach((role, i) => {
      const s = roleSentence(role, i === 0, t);
      if (s) parts.push(s);
      const highlights = clean(role.highlights);
      if (highlights) parts.push(sentence(highlights));
    });
  }

  // --- Skills -------------------------------------------------------------
  const skills = listPhrase(a.skills, t);
  if (skills) parts.push(sentence(t('wizard.compose.skills', { list: skills })));

  // --- Education ----------------------------------------------------------
  const education = clean(a.education);
  if (education) parts.push(sentence(education));

  return parts.join(t('wizard.compose.sentenceJoin'));
}

/**
 * Can we usefully call the AI yet? Deliberately generous — the point of the
 * guided flow is that a partial answer still produces something real. We only
 * insist on enough substance for the model to have a subject.
 */
export function canCompose(a: GuidedAnswers): boolean {
  return missingForCompose(a).length === 0;
}

/** What still has to be filled in before we can build anything. */
export type MissingRequirement = 'identity' | 'substance';

/**
 * Why the form is not submittable yet.
 *
 * This exists because `canCompose` returning false used to be invisible: the
 * button simply went grey. Live users on v1.14.0 who skipped the onboarding
 * goals screen arrived with no name and no job title, hit the last step, found
 * a dead button, and ping-ponged between steps looking for what they had
 * missed — one did thirteen step-views and never submitted. A blocked state
 * has to say what it wants.
 */
export function missingForCompose(a: GuidedAnswers): MissingRequirement[] {
  const missing: MissingRequirement[] = [];
  if (!clean(a.fullName) && !clean(a.jobTitle)) missing.push('identity');

  const hasSubstance =
    a.skills.length > 0 ||
    Boolean(clean(a.education)) ||
    a.roles.some((r) => clean(r.title) || clean(r.company) || clean(r.highlights));
  if (!hasSubstance) missing.push('substance');

  return missing;
}

/** Step index that fixes a given gap, so the UI can offer to jump there. */
export function stepForRequirement(req: MissingRequirement): number {
  return req === 'identity' ? 0 : 1; // 'you' : 'work'
}
