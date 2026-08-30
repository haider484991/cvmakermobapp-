/**
 * Tests for the AI wizard's input gate.
 *
 * The stakes are asymmetric, so the tests are written around that:
 *
 *   - A FALSE NEGATIVE wastes a paid AI call and hands the user a blank
 *     resume. That is the bug this module exists to fix, and the fixtures
 *     below are the exact strings that caused it in production.
 *   - A FALSE POSITIVE is worse: it locks a real user out of the app's
 *     marquee feature. The app ships in 12 languages and we have live users
 *     in id-ID, fr-FR, nl-NL and pt-BR, so "real writing is never blocked"
 *     is tested in a non-English language too.
 */

import {
  analyseNarrative,
  detectPlaceholder,
  scoreNarrative,
  missingSignalKeys,
} from '@/services/ai/narrativeQuality';

/** The verbatim EXAMPLES[0] text — 421 chars, submitted unedited 14 times. */
const SENIOR_ENGINEER_EXAMPLE =
  "I'm a senior software engineer with 8 years of experience. The last 3 years I led the platform team at Stripe where we rebuilt the payment routing system that processes $500B/year. Before that I was at Square working on Cash App's backend. I'm strong in Go, Rust, and distributed systems, and I've shipped 4 production services that handle millions of requests per day. I have a B.S. in Computer Science from UC Berkeley.";

/** A representative seedNarrative() output, brackets intact. */
const SEEDED_SCAFFOLD =
  "I'm a professional with about 8 years of experience in technology. Most recently I [your current or latest role] where I [one or two things you achieved — add numbers if you can]. Before that I [previous role and what you did]. I'm strong in [your top skills or tools], and I have [your degree or relevant certification].";

const TEMPLATES = [SEEDED_SCAFFOLD, SENIOR_ENGINEER_EXAMPLE];

describe('detectPlaceholder', () => {
  it('blocks the canned example submitted verbatim (the 421-char production case)', () => {
    const r = detectPlaceholder(SENIOR_ENGINEER_EXAMPLE, TEMPLATES);
    expect(r.isPlaceholder).toBe(true);
    expect(r.reason).toBe('unedited-template');
  });

  it('blocks the onboarding scaffold while its [brackets] are unresolved', () => {
    const r = detectPlaceholder(SEEDED_SCAFFOLD, TEMPLATES);
    expect(r.isPlaceholder).toBe(true);
    expect(r.reason).toBe('brackets');
  });

  it('still blocks a template that only had whitespace or case changed', () => {
    const sneaky = `  ${SENIOR_ENGINEER_EXAMPLE.toUpperCase()}\n\n `;
    expect(detectPlaceholder(sneaky, TEMPLATES).isPlaceholder).toBe(true);
  });

  it('blocks a template with only a token edit', () => {
    const barelyEdited = SENIOR_ENGINEER_EXAMPLE.replace('Stripe', 'Shopify');
    expect(detectPlaceholder(barelyEdited, TEMPLATES).isPlaceholder).toBe(true);
  });

  it('allows a template the user genuinely rewrote and expanded', () => {
    const rewritten =
      SENIOR_ENGINEER_EXAMPLE +
      ' Actually let me redo this properly: I run the billing team at Wise in Lahore, ' +
      'six engineers reporting to me, and last year we cut failed payment retries by 34 percent ' +
      'which recovered about 2 million dollars a year. I moved into management from a backend role ' +
      'after five years writing Java and Kotlin services, and I still review most of the tricky code. ' +
      'Before Wise I was at Careem doing driver payouts across four countries. I studied Computer ' +
      'Science at LUMS and finished an AWS solutions architect certification in 2023.';
    expect(detectPlaceholder(rewritten, TEMPLATES).isPlaceholder).toBe(false);
  });

  it('never blocks original writing that shares common words with a template', () => {
    const original =
      "I'm a software engineer with 4 years of experience. I work at a fintech in Karachi " +
      'building payment APIs, and I am strong in Python and Postgres. I have a degree in ' +
      'Computer Science.';
    expect(detectPlaceholder(original, TEMPLATES).isPlaceholder).toBe(false);
  });

  it('does not block a narrative in another language (id-ID user)', () => {
    const indonesian =
      'Saya seorang perawat dengan pengalaman 6 tahun di Rumah Sakit Siloam. Saya menangani ' +
      'lebih dari 30 pasien setiap hari, melatih 5 perawat baru, dan mengelola jadwal shift. ' +
      'Saya menguasai perawatan luka, pemasangan infus, dan rekam medis elektronik. ' +
      'Saya lulusan D3 Keperawatan Universitas Indonesia.';
    expect(detectPlaceholder(indonesian, TEMPLATES).isPlaceholder).toBe(false);
  });

  it('treats an empty box as not-a-placeholder (length gate handles it)', () => {
    expect(detectPlaceholder('', TEMPLATES).isPlaceholder).toBe(false);
    expect(detectPlaceholder('   ', TEMPLATES).isPlaceholder).toBe(false);
  });
});

describe('scoreNarrative', () => {
  it('scores a rich narrative above a thin one', () => {
    const rich = scoreNarrative(
      'I am a registered nurse with 6 years at Siloam Hospital. I handle 30 patients a day, ' +
        'trained 5 new nurses, and manage shift rosters. Skills: wound care, IV lines, ' +
        'electronic medical records. I hold a nursing diploma from Universitas Indonesia.',
    );
    const thin = scoreNarrative('i want a job as a nurse');
    expect(rich.score).toBeGreaterThan(thin.score);
    expect(rich.readiness).toBe('strong');
    expect(thin.readiness).toBe('thin');
  });

  it('credits structural signals so non-English text is not penalised', () => {
    // No English keywords at all, but has digits, proper nouns and a comma list.
    const q = scoreNarrative(
      'Je suis développeur chez Doctolib depuis 5 ans, je gère 12 microservices et ' +
        "j'ai réduit la latence de 40 pour cent. Je maîtrise Go, Python, Kubernetes.",
    );
    expect(q.score).toBeGreaterThanOrEqual(60);
    expect(q.signals.find((s) => s.key === 'numbers')?.present).toBe(true);
    expect(q.signals.find((s) => s.key === 'employer')?.present).toBe(true);
  });

  it('counts words rather than characters', () => {
    expect(scoreNarrative('one two three').wordCount).toBe(3);
    expect(scoreNarrative('   ').wordCount).toBe(0);
  });
});

describe('analyseNarrative + missingHints', () => {
  it('reports placeholder readiness ahead of any scoring verdict', () => {
    const q = analyseNarrative(SENIOR_ENGINEER_EXAMPLE, TEMPLATES);
    // The example is well-written, so it would otherwise score 'strong' —
    // placeholder status must win.
    expect(q.isPlaceholder).toBe(true);
    expect(q.readiness).toBe('placeholder');
  });

  it('returns keys only for the signals that are actually missing', () => {
    const q = analyseNarrative('I am a barista at a coffee shop and I am friendly.', TEMPLATES);
    const hints = missingSignalKeys(q);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.length).toBeLessThanOrEqual(3);
    // It named no numbers, so that hint must be offered.
    expect(hints).toContain('numbers');
  });

  it('offers no hints once every signal is satisfied', () => {
    const q = analyseNarrative(
      'I am a senior accountant with 9 years at Unilever Pakistan. I closed monthly books ' +
        'for 3 entities, cut the close cycle from 12 days to 5, and led a team of 4. ' +
        'My skills are IFRS, SAP, Excel modelling, and audit prep. I have an ACCA ' +
        'qualification and a BSc in Accounting.',
      TEMPLATES,
    );
    expect(missingSignalKeys(q)).toHaveLength(0);
    expect(q.readiness).toBe('strong');
  });
});
