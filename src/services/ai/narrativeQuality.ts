/**
 * Narrative quality analysis for the AI wizard
 * --------------------------------------------
 *
 * Why this exists: measured over 60 days, 14 of 36 wizard generations were
 * the "Senior engineer" EXAMPLES entry submitted VERBATIM (char_count 421,
 * from users in the US, France, Jamaica and Australia), and most of the rest
 * were the onboarding scaffold with its [bracketed] prompts unedited. Every
 * one of those returned confidence 0.25 with zero skills and zero education —
 * a blank resume — and the user left. The single narrative anyone actually
 * wrote themselves (1,979 chars) returned confidence 0.85 with 9 skills.
 *
 * The old gate was `charCount >= 30`, which every placeholder clears, and the
 * UI even labelled that state "Ready". So the app confidently spent a paid AI
 * call on text about a fictional Stripe engineer.
 *
 * Two separate jobs here, deliberately kept apart:
 *
 *   1. `detectPlaceholder()` — a HARD gate. Must never fire on real writing
 *      and must work in every language we ship, so it only uses structural
 *      signals: unresolved [brackets], and near-identity with a template we
 *      ourselves put in the box. No vocabulary, no language assumptions.
 *
 *   2. `scoreNarrative()` — SOFT coaching that suggests what to add. This one
 *      leans on English keywords, so it is advisory only and never blocks.
 *      A non-English narrative simply scores on its structural signals
 *      (length, digits, proper nouns, list commas) and is never penalised for
 *      failing an English keyword test.
 */

/** Resume-critical elements we coach the user toward. */
export type SignalKey = 'detail' | 'employer' | 'numbers' | 'skills' | 'education';

export interface QualitySignal {
  key: SignalKey;
  present: boolean;
}

export type Readiness = 'placeholder' | 'thin' | 'ok' | 'strong';

export interface NarrativeQuality {
  /** True when the text is still a template we supplied. Blocks generation. */
  isPlaceholder: boolean;
  /** Why it was flagged — drives the message shown to the user. */
  placeholderReason: 'brackets' | 'unedited-template' | null;
  signals: QualitySignal[];
  /** 0–100, from the signals that are present. Advisory. */
  score: number;
  readiness: Readiness;
  wordCount: number;
}

/** Collapse whitespace + case so "unedited" survives stray spaces/newlines. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Distinctive words (length >= 4) used for the near-identity check. */
function contentWords(s: string): string[] {
  return normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
}

/**
 * Does the text still contain an unresolved `[fill this in]` prompt?
 * `seedNarrative()` builds its scaffold out of these, so their presence is
 * proof the user has not replaced that part.
 *
 * Three bracket families, because the scaffold is localised and ASCII square
 * brackets are not the convention everywhere: `[…]` (most locales), `［…］`
 * full-width and `【…】` (ja / zh-CN). Missing these would silently let the
 * Japanese and Chinese scaffolds through the gate — exactly the bug this
 * function exists to prevent, just in someone else's alphabet.
 */
function hasUnresolvedBrackets(text: string): boolean {
  return /\[[^\]]{2,}\]|［[^］]{2,}］|【[^】]{2,}】/.test(text);
}

/**
 * Is `text` still substantially one of `templates`?
 *
 * Exact match after normalising catches the measured case (14 verbatim
 * submissions). The token-overlap pass additionally catches "changed two
 * words and hit Generate": if the narrative carries >= 85% of a template's
 * distinctive words AND has not grown much, the user has not really written
 * anything of their own.
 */
function matchesTemplate(text: string, templates: string[]): boolean {
  const n = normalize(text);
  if (!n) return false;

  for (const tpl of templates) {
    const t = normalize(tpl);
    if (!t) continue;
    if (n === t) return true;

    const tplWords = new Set(contentWords(tpl));
    if (tplWords.size < 8) continue; // too short to judge by overlap

    const narrativeWords = new Set(contentWords(text));
    let shared = 0;
    for (const w of tplWords) if (narrativeWords.has(w)) shared++;
    const overlap = shared / tplWords.size;

    // Grown by more than half again? They've added real substance — allow it
    // even if the template's skeleton is still recognisable.
    const grew = narrativeWords.size > tplWords.size * 1.5;
    if (overlap >= 0.85 && !grew) return true;
  }
  return false;
}

/**
 * The hard gate. `templates` should include the onboarding seed currently in
 * the box plus every canned example we offer.
 */
export function detectPlaceholder(
  text: string,
  templates: string[],
): { isPlaceholder: boolean; reason: 'brackets' | 'unedited-template' | null } {
  if (hasUnresolvedBrackets(text)) return { isPlaceholder: true, reason: 'brackets' };
  if (matchesTemplate(text, templates)) return { isPlaceholder: true, reason: 'unedited-template' };
  return { isPlaceholder: false, reason: null };
}

/* -------------------------------------------------------------------------
 * Soft coaching signals
 * ---------------------------------------------------------------------- */

/** Capitalised token that isn't sentence-initial — usually an employer/school. */
const PROPER_NOUN = /(?:[^.!?]\s)([A-Z][\p{L}]{2,})/u;
/** Two or more digits in a row, or a %/$/k/m magnitude — an achievement metric. */
const METRIC = /\d[\d,.]*\s*(?:%|k\b|m\b|bn?\b|\+)|[$£€]\s*\d|\b\d{2,}\b/i;

/** Scripts that don't put spaces between words, so word-counting is useless. */
const UNSPACED_SCRIPT = /[぀-ヿ一-鿿가-힯]/;

/**
 * List separators across the scripts we ship: ASCII comma, ideographic comma
 * (ja/zh), Arabic comma, and semicolons. A skills list looks like a list in
 * every language — it just doesn't always use ",".
 */
const LIST_SEPARATOR = /[,;、，؛،]/g;

/**
 * Keyword hints are a BONUS signal, never a requirement — a narrative in a
 * language absent from these lists still scores on its structure. They include
 * the verbs our own compose frames use in each locale, so a guided narrative
 * scores consistently whichever language it was written in.
 */
const EDUCATION_HINT = new RegExp(
  [
    'degree|bachelor|master|phd|b\\.?s|m\\.?s|b\\.?a|m\\.?a|mba|diploma|certificat|graduat',
    'licence|licenciatura|universit|college|school|akademi|sarjana|ijazah|opleiding|studium',
    'diplôme|abschluss|ausbildung|formación|formação|gelar|pendidikan|eğitim|lisans|üniversite',
    'образован|университ|диплом|степень|بكالوريوس|جامع|شهادة|学位|大学|卒業|学士|本科|毕业',
    'डिग्री|विश्वविद्यालय|स्नातक',
  ].join('|'),
  'i',
);

const SKILLS_HINT = new RegExp(
  [
    'skill|proficient|experienced in|strong in|tools|stack|software|fluent',
    'habilidad|domino|compéten|maîtrise|vaardigh|kemampuan|keahlian|menguasai',
    'kann gut|kenntnis|fähigkeit|güçlüyüm|beceri|владею|навык|хорошо владею',
    'أجيد|مهارات|得意|スキル|擅长|技能|आते हैं|कौशल',
  ].join('|'),
  'i',
);

/**
 * Score the narrative and say what's missing. Never blocks — a narrative in
 * a language we don't keyword-match still scores on structure alone, and the
 * hints are phrased as suggestions.
 */
export function scoreNarrative(text: string): Omit<NarrativeQuality, 'isPlaceholder' | 'placeholderReason'> {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/) : [];
  const wordCount = words.length;

  // Structural signals work in any language; keyword hints only ever add.
  const hasCommaList = (trimmed.match(LIST_SEPARATOR) || []).length >= 2;

  /**
   * Japanese and Chinese don't put spaces between words, so a complete
   * Japanese narrative counts as a handful of "words" and the detail signal
   * would fail on text that is in fact perfectly detailed. Measure characters
   * for those scripts instead (~2.5 chars carries about one English word).
   */
  const unspaced = UNSPACED_SCRIPT.test(trimmed);
  const denseLength = trimmed.replace(/\s+/g, '').length;
  const hasEnoughDetail = unspaced ? denseLength >= 100 : wordCount >= 40;

  // Signals carry keys, not prose: the UI translates them via
  // `wizard.hint.<key>` so the coaching speaks the user's language.
  const signals: QualitySignal[] = [
    { key: 'detail', present: hasEnoughDetail },
    { key: 'employer', present: PROPER_NOUN.test(trimmed) },
    { key: 'numbers', present: METRIC.test(trimmed) },
    { key: 'skills', present: hasCommaList || SKILLS_HINT.test(trimmed) },
    { key: 'education', present: EDUCATION_HINT.test(trimmed) },
  ];

  const present = signals.filter((s) => s.present).length;
  const score = Math.round((present / signals.length) * 100);

  // Same script caveat applies to the floor below which nothing is worth saying.
  const tooShort = unspaced ? denseLength < 30 : wordCount < 12;

  let readiness: Readiness;
  if (tooShort) readiness = 'thin';
  else if (present >= 4) readiness = 'strong';
  else if (present >= 2) readiness = 'ok';
  else readiness = 'thin';

  return { signals, score, readiness, wordCount };
}

/** Convenience wrapper the wizard calls on every keystroke. */
export function analyseNarrative(text: string, templates: string[]): NarrativeQuality {
  const { isPlaceholder, reason } = detectPlaceholder(text, templates);
  const scored = scoreNarrative(text);
  return {
    ...scored,
    isPlaceholder,
    placeholderReason: reason,
    readiness: isPlaceholder ? 'placeholder' : scored.readiness,
  };
}

/**
 * Keys for whatever is still missing, best-first. The caller renders them
 * through `wizard.hint.<key>`.
 */
export function missingSignalKeys(q: NarrativeQuality, limit = 3): SignalKey[] {
  return q.signals.filter((s) => !s.present).map((s) => s.key).slice(0, limit);
}
