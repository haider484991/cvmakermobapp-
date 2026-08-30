/**
 * Tests for the onboarding seed scaffold.
 *
 * The scaffold is the text the wizard pre-loads into the free-text box, and
 * it is deliberately full of [bracketed] prompts. Those brackets are load
 * bearing in two directions:
 *
 *   - to the user, they say "replace this bit";
 *   - to `detectPlaceholder()`, their presence is proof the user has NOT
 *     replaced it, which is what stops us spending a paid AI call on our own
 *     template. That was the single most common failure in production.
 *
 * Localising the scaffold put that contract at risk: Japanese and Chinese use
 * full-width ［brackets］, which the original ASCII-only regex ignored. So the
 * headline test here is that EVERY locale's scaffold is still caught, in the
 * locale's own punctuation.
 */

import { seedNarrative, ONBOARDING_LEVELS, ONBOARDING_INDUSTRIES, type Translate } from '@/services/onboarding/personalize';
import { detectPlaceholder, analyseNarrative } from '@/services/ai/narrativeQuality';

import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import fr from '@/i18n/locales/fr.json';
import de from '@/i18n/locales/de.json';
import hi from '@/i18n/locales/hi.json';
import id from '@/i18n/locales/id.json';
import ar from '@/i18n/locales/ar.json';
import ru from '@/i18n/locales/ru.json';
import tr from '@/i18n/locales/tr.json';
import ja from '@/i18n/locales/ja.json';
import zhCN from '@/i18n/locales/zh-CN.json';

const LOCALES: Array<[string, any]> = [
  ['en', en], ['es', es], ['pt-BR', ptBR], ['fr', fr], ['de', de], ['hi', hi],
  ['id', id], ['ar', ar], ['ru', ru], ['tr', tr], ['ja', ja], ['zh-CN', zhCN],
];

function makeT(bundle: any): Translate {
  return (key, vars) => {
    const found = key.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), bundle);
    let out = typeof found === 'string' ? found : key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
    return out;
  };
}

const PROFILE = { targetRole: 'Registered Nurse', industry: 'healthcare', experienceLevel: 'mid' } as const;

describe('seedNarrative', () => {
  it('returns nothing when it knows too little to help', () => {
    const t = makeT(en);
    expect(seedNarrative({}, t)).toBe('');
    expect(seedNarrative({ experienceLevel: 'mid' }, t)).toBe('');
    // A role alone is enough.
    expect(seedNarrative({ targetRole: 'Welder' }, t)).not.toBe('');
    // So is an industry alone.
    expect(seedNarrative({ industry: 'tech' }, t)).not.toBe('');
  });

  it('treats "other" as no industry rather than writing the word "other"', () => {
    const t = makeT(en);
    expect(seedNarrative({ industry: 'other' }, t)).toBe('');
    expect(seedNarrative({ targetRole: 'Chef', industry: 'other' }, t)).not.toContain(' in other');
  });

  it('uses the profile the user actually gave', () => {
    const n = seedNarrative(PROFILE, makeT(en));
    expect(n).toContain('Registered Nurse');
    expect(n).toContain('healthcare');
    expect(n).toContain('around 4 years');
  });
});

describe('every locale keeps the scaffold catchable', () => {
  it.each(LOCALES)('%s scaffold is detected as an unedited placeholder', (_name, bundle) => {
    const seed = seedNarrative(PROFILE, makeT(bundle));
    expect(seed.length).toBeGreaterThan(40);

    const verdict = detectPlaceholder(seed, [seed]);
    expect(verdict.isPlaceholder).toBe(true);
    // Specifically via brackets — that is the signal that survives editing the
    // surrounding prose, so it must be the one that fires.
    expect(verdict.reason).toBe('brackets');

    // And the full analysis agrees, which is what actually gates the button.
    expect(analyseNarrative(seed, []).isPlaceholder).toBe(true);
  });

  it.each(LOCALES)('%s scaffold leaks no raw keys or unreplaced placeholders', (_name, bundle) => {
    const seed = seedNarrative(PROFILE, makeT(bundle));
    expect(seed).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
    expect(seed).not.toContain('onboarding.seed');
    expect(seed).not.toContain('onboarding.options');
    expect(seed).not.toContain('undefined');
  });

  it('ja and zh-CN use full-width brackets and are still caught', () => {
    for (const bundle of [ja, zhCN]) {
      const seed = seedNarrative(PROFILE, makeT(bundle));
      expect(seed).toMatch(/［[^］]+］/); // the locale's own convention
      expect(seed).not.toMatch(/\[[^\]]+\]/); // not ASCII
      expect(detectPlaceholder(seed, []).isPlaceholder).toBe(true);
    }
  });

  it('produces a distinct scaffold per language', () => {
    const seeds = LOCALES.map(([, b]) => seedNarrative(PROFILE, makeT(b)));
    expect(new Set(seeds).size).toBe(LOCALES.length);
  });
});

describe('onboarding option data', () => {
  it.each(LOCALES)('%s translates every goal, industry and level', (_name, bundle) => {
    const t = makeT(bundle);
    for (const o of ONBOARDING_INDUSTRIES) {
      expect(t(`onboarding.options.industries.${o.id}`)).not.toContain('onboarding.options');
      expect(t(`onboarding.options.industries.${o.id}Inline`)).not.toContain('onboarding.options');
    }
    for (const l of ONBOARDING_LEVELS) {
      for (const field of ['label', 'description', 'yearsHint']) {
        expect(t(`onboarding.options.levels.${l.id}.${field}`)).not.toContain('onboarding.options');
      }
    }
  });

  it('keeps ids and emoji in code so stored profiles stay language-independent', () => {
    // The profile stores ids; if these drifted, every existing user's saved
    // industry/level would stop resolving.
    expect(ONBOARDING_INDUSTRIES.map((i) => i.id)).toEqual([
      'tech', 'healthcare', 'finance', 'marketing', 'education',
      'engineering', 'design', 'sales', 'other',
    ]);
    expect(ONBOARDING_LEVELS.map((l) => l.id)).toEqual(['entry', 'mid', 'senior', 'executive']);
    expect(ONBOARDING_INDUSTRIES.every((i) => i.emoji.length > 0)).toBe(true);
  });
});
