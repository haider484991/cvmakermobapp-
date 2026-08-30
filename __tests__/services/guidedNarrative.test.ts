/**
 * Tests for the guided composer.
 *
 * These drive the composer with the REAL locale files rather than a mock, so
 * they verify the strings that actually ship. Two headline assertions:
 *
 *   1. A narrative composed from ordinary guided answers clears the same
 *      quality gate that rejects our templates, and scores 'strong'. That
 *      closes the loop — the easy path is provably the high-quality path.
 *   2. It does that in all 12 languages, with no unreplaced {{placeholder}}
 *      left behind. The downstream prompt writes the resume in whatever
 *      language the narrative is in, so English scaffolding around French
 *      answers would hand a French user an English CV.
 *
 * The other thing tested hard here is that we never invent. The resume-writer
 * craft contract forbids inventing companies, dates or metrics, and a composer
 * that "helpfully" fills gaps would violate it silently.
 */

import {
  composeNarrative,
  canCompose,
  missingForCompose,
  stepForRequirement,
  emptyAnswers,
  skillsKeyForIndustry,
  SKILL_INDUSTRIES,
  HIGHLIGHT_PROMPT_KEYS,
  type GuidedAnswers,
  type Translate,
} from '@/services/ai/guidedNarrative';
import { analyseNarrative } from '@/services/ai/narrativeQuality';

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

/** Minimal i18next-compatible lookup over a real locale bundle. */
function makeT(bundle: any): Translate {
  return (key, vars) => {
    const found = key.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), bundle);
    let out = typeof found === 'string' ? found : key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
    return out;
  };
}

const t = makeT(en);

function answers(patch: Partial<GuidedAnswers> = {}): GuidedAnswers {
  return { ...emptyAnswers(), ...patch };
}

/** Deliberately modest input — the kind a user gives in about a minute. */
const MODEST = answers({
  fullName: 'Ayesha Khan',
  jobTitle: 'Registered Nurse',
  location: 'Lahore',
  roles: [
    {
      title: 'Staff Nurse',
      company: 'Shaukat Khanum Hospital',
      startYear: '2021',
      endYear: '',
      highlights: 'I look after 30 patients a shift and I trained 5 new nurses.',
    },
  ],
  noExperienceYet: false,
  skills: ['Patient care', 'IV lines', 'Wound care'],
  education: 'I have a BSc in Nursing from Punjab University',
});

describe('composeNarrative', () => {
  it('builds first-person prose from a full answer set', () => {
    const n = composeNarrative(MODEST, t);
    expect(n).toContain('My name is Ayesha Khan');
    expect(n).toContain('Registered Nurse');
    expect(n).toContain('Shaukat Khanum Hospital');
    expect(n).toContain('since 2021');
    expect(n).toContain('Patient care, IV lines and Wound care');
    expect(n).toContain('Punjab University');
  });

  it('omits every clause the user left blank rather than inventing one', () => {
    const n = composeNarrative(
      answers({
        jobTitle: 'Barista',
        roles: [{ title: 'Barista', company: '', startYear: '', endYear: '', highlights: '' }],
      }),
      t,
    );
    expect(n).toContain('Barista');
    expect(n).not.toMatch(/\bat\s+\./);
    expect(n).not.toMatch(/from\s+to/);
    expect(n).not.toContain('undefined');
    expect(n).not.toContain('strong in');
    expect(n).not.toMatch(/since\s*\./);
  });

  it('renders an open-ended current role without fabricating an end date', () => {
    const n = composeNarrative(
      answers({
        jobTitle: 'Welder',
        roles: [{ title: 'Welder', company: 'Descon', startYear: '2019', endYear: '', highlights: '' }],
      }),
      t,
    );
    expect(n).toContain('Right now I work');
    expect(n).toContain('since 2019');
    expect(n).not.toContain('to .');
  });

  it('uses "most recently" — not "right now" or "before that" — for a first role that ended', () => {
    const n = composeNarrative(
      answers({
        jobTitle: 'Chef',
        roles: [{ title: 'Chef', company: 'Cafe Zouk', startYear: '2019', endYear: '2023', highlights: '' }],
      }),
      t,
    );
    expect(n).toContain('Most recently I worked');
    expect(n).not.toContain('Right now I worked');
    expect(n).not.toContain('Before that');
  });

  it('labels the second role as prior experience', () => {
    const n = composeNarrative(
      answers({
        jobTitle: 'Accountant',
        roles: [
          { title: 'Senior Accountant', company: 'Unilever', startYear: '2022', endYear: '', highlights: '' },
          { title: 'Accountant', company: 'Nestle', startYear: '2018', endYear: '2022', highlights: '' },
        ],
      }),
      t,
    );
    expect(n).toContain('Right now I work');
    expect(n).toContain('Before that I worked');
    expect(n).toContain('from 2018 to 2022');
  });

  it('handles the no-experience-yet path without pretending otherwise', () => {
    const n = composeNarrative(
      answers({
        fullName: 'Bilal',
        jobTitle: 'Junior Developer',
        noExperienceYet: true,
        roles: [],
        skills: ['Python', 'SQL'],
        education: 'I finished a BS in Computer Science at FAST in 2025',
      }),
      t,
    );
    expect(n).toContain("haven't worked a full-time job yet");
    expect(n).toContain('Python and SQL');
    expect(n).toContain('FAST');
    expect(n).not.toContain('Right now I work');
  });

  it('returns an empty string for empty answers rather than a skeleton', () => {
    expect(composeNarrative(emptyAnswers(), t)).toBe('');
  });

  it('does not double up terminal punctuation from user text', () => {
    const n = composeNarrative(
      answers({
        jobTitle: 'Chef',
        roles: [{ title: 'Chef', company: 'Cafe', startYear: '', endYear: '', highlights: 'I ran the kitchen.' }],
      }),
      t,
    );
    expect(n).not.toContain('..');
  });
});

describe('canCompose', () => {
  it('requires an identity and some substance', () => {
    expect(canCompose(emptyAnswers())).toBe(false);
    expect(canCompose(answers({ jobTitle: 'Nurse' }))).toBe(false);
    expect(canCompose(answers({ jobTitle: 'Nurse', skills: ['Triage'] }))).toBe(true);
    expect(canCompose(answers({ fullName: 'Sara', education: 'BA in History' }))).toBe(true);
  });
});

describe('locale coverage', () => {
  it.each(LOCALES)('%s has usable skill chips for every industry', (_name, bundle) => {
    for (const industry of SKILL_INDUSTRIES) {
      // The component reads these with i18next's returnObjects, so resolve the
      // path directly rather than through the string-only `t` shim.
      const list = skillsKeyForIndustry(industry)
        .split('.')
        .reduce<any>((o, k) => (o == null ? undefined : o[k]), bundle);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(8);
      expect(new Set(list).size).toBe(list.length);
      expect(list.every((x: unknown) => typeof x === 'string' && x.trim().length > 0)).toBe(true);
    }
  });

  it('falls back to the universal list for an unknown industry', () => {
    expect(skillsKeyForIndustry('nonsense')).toBe('wizard.skills.other');
    expect(skillsKeyForIndustry(undefined)).toBe('wizard.skills.other');
    expect(skillsKeyForIndustry('tech')).toBe('wizard.skills.tech');
  });

  it.each(LOCALES)('%s translates every highlight prompt', (_name, bundle) => {
    const lt = makeT(bundle);
    for (const k of HIGHLIGHT_PROMPT_KEYS) {
      const key = `wizard.guided.prompts.${k}`;
      expect(lt(key)).not.toBe(key);
    }
  });

  it.each(LOCALES)('%s composes a real narrative with no unreplaced placeholders', (_name, bundle) => {
    const n = composeNarrative(MODEST, makeT(bundle));
    expect(n.length).toBeGreaterThan(60);
    // The classic i18n bug: a frame that forgot an interpolation.
    expect(n).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
    // The key itself must never leak into resume prose.
    expect(n).not.toContain('wizard.compose');
    // The user's own data survives translation.
    expect(n).toContain('Ayesha Khan');
    expect(n).toContain('Shaukat Khanum Hospital');
    expect(n).toContain('2021');
  });

  it.each(LOCALES)('%s scores strong — quality must not depend on language', (_name, bundle) => {
    // Identical answers previously scored 100 in English, 80 in French and 60
    // in Japanese, purely because the heuristics were English-shaped: word
    // counting collapses in scripts with no spaces, and list separators and
    // skill verbs differ. A user is not worse at their job in Japanese.
    const q = analyseNarrative(composeNarrative(MODEST, makeT(bundle)), []);
    expect(q.readiness).toBe('strong');
    expect(q.score).toBeGreaterThanOrEqual(80);
  });

  it('produces genuinely different prose per language, not English everywhere', () => {
    const outputs = LOCALES.map(([, b]) => composeNarrative(MODEST, makeT(b)));
    expect(new Set(outputs).size).toBe(LOCALES.length);
    // A French user must not receive the English frame.
    const french = composeNarrative(MODEST, makeT(fr));
    expect(french).toContain("Je m'appelle");
    expect(french).not.toContain('My name is');
  });
});

describe('the guided path clears the quality gate', () => {
  it('produces a narrative that is never mistaken for a template', () => {
    const n = composeNarrative(MODEST, t);
    const q = analyseNarrative(n, ['some unrelated template text about an engineer at Stripe']);
    expect(q.isPlaceholder).toBe(false);
    expect(n).not.toMatch(/\[[^\]]+\]/);
  });

  it('scores strong — the low-effort path is the high-quality path', () => {
    const q = analyseNarrative(composeNarrative(MODEST, t), []);
    expect(q.readiness).toBe('strong');
    expect(q.score).toBeGreaterThanOrEqual(80);
  });

  it('beats what the free-text box was actually receiving', () => {
    const guided = analyseNarrative(composeNarrative(MODEST, t), []);
    const typed = analyseNarrative('i need a resume for a nurse job', []);
    expect(guided.score).toBeGreaterThan(typed.score);
    expect(guided.wordCount).toBeGreaterThan(typed.wordCount);
  });
});

describe('missingForCompose — the blocked state must explain itself', () => {
  // Live v1.14.0 regression: users who skipped the onboarding goals screen
  // arrived with has_name:false and has_role:false, so canCompose() was false
  // and the final button went grey with no message. One device logged 13
  // step-views bouncing between steps and never submitted.
  it('names the identity gap for a user who skipped the goals screen', () => {
    const a = answers({ skills: ['Triage'], fullName: '', jobTitle: '' });
    expect(canCompose(a)).toBe(false);
    expect(missingForCompose(a)).toEqual(['identity']);
    expect(stepForRequirement('identity')).toBe(0); // the 'you' step
  });

  it('names the substance gap when there is nothing to build from', () => {
    const a = answers({ jobTitle: 'Nurse' });
    expect(missingForCompose(a)).toEqual(['substance']);
    expect(stepForRequirement('substance')).toBe(1); // the 'work' step
  });

  it('reports both when the form is untouched', () => {
    expect(missingForCompose(emptyAnswers())).toEqual(['identity', 'substance']);
  });

  it('is empty exactly when canCompose is true', () => {
    const ok = answers({ jobTitle: 'Nurse', skills: ['Triage'] });
    expect(missingForCompose(ok)).toEqual([]);
    expect(canCompose(ok)).toBe(true);
  });
});
