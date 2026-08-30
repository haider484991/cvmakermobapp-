/**
 * Tests for job alert subscriptions.
 *
 * Two things must not break here:
 *
 *   1. PRIVACY. The subscription is sent to a server, and the app's Play
 *      data-safety declaration says resume data stays on the device. If a name,
 *      an employer or a phone number ever leaks into this payload, that
 *      declaration becomes false. Several tests exist purely to assert absence.
 *   2. REPETITION. An alert that re-sends yesterday's jobs gets muted, and you
 *      only get asked for notification permission once.
 */

import {
  buildAlertProfile,
  pickNewMatches,
  rememberSeen,
  profilesDiffer,
  ALERT_MIN_SCORE,
} from '@/services/jobs/jobAlerts';
import type { Resume } from '@/types/resume';
import type { JobMatch } from '@/services/jobs/jobMatch';

function resume(patch: Partial<Resume> = {}): Resume {
  return {
    id: 'r1',
    name: 'Test',
    templateId: 't',
    createdAt: '',
    updatedAt: '',
    sections: [],
    header: {
      fullName: 'Ayesha Khan',
      jobTitle: 'Registered Nurse',
      contact: {
        email: 'ayesha@example.com',
        phone: '+92 300 1234567',
        location: 'Lahore',
        linkedin: 'linkedin.com/in/ayesha',
      },
    },
    summary: 'Nurse with six years on a surgical ward at Shaukat Khanum.',
    experience: [
      {
        id: 'e1',
        company: 'Shaukat Khanum Hospital',
        title: 'Staff Nurse',
        location: 'Lahore',
        startDate: '2021',
        endDate: null,
        isCurrentRole: true,
        description: '',
        bullets: ['Cared for 30 patients per shift'],
      },
    ],
    education: [],
    skills: [
      { id: '1', name: 'Patient care' },
      { id: '2', name: 'Triage' },
    ],
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    customSections: [],
    ...patch,
  } as Resume;
}

const match = (id: string, score: number): JobMatch => ({
  job: {
    id,
    title: 'Registered Nurse',
    company: 'City Hospital',
    location: 'Lahore',
    url: 'https://example.com',
    description: '',
    tags: [],
    remote: false,
  },
  score,
  matchedSkills: [],
  missingSkills: [],
  seniorityMismatch: false,
});

describe('buildAlertProfile', () => {
  it('builds a searchable subscription from the resume', () => {
    const p = buildAlertProfile(resume(), { industry: 'healthcare', locale: 'en' })!;
    expect(p.query).toBe('Registered Nurse');
    expect(p.location).toBe('Lahore');
    expect(p.industry).toBe('healthcare');
    expect(p.skills).toEqual(expect.arrayContaining(['Patient care', 'Triage']));
    expect(p.minScore).toBe(ALERT_MIN_SCORE);
    expect(p.locale).toBe('en');
  });

  it('NEVER includes personal data — this payload leaves the device', () => {
    const p = buildAlertProfile(resume(), { locale: 'en' })!;
    const serialized = JSON.stringify(p);
    for (const secret of [
      'Ayesha',
      'Khan',
      'ayesha@example.com',
      '+92 300 1234567',
      'linkedin.com/in/ayesha',
      'Shaukat Khanum Hospital',
      'surgical ward',
      '2021',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('caps the skill list so it stays a filter rather than a profile', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, name: `Skill ${i}` }));
    const p = buildAlertProfile(resume({ skills: many as any }), { locale: 'en' })!;
    expect(p.skills.length).toBeLessThanOrEqual(12);
  });

  it('refuses to subscribe when there is nothing to search on', () => {
    expect(buildAlertProfile(null, { locale: 'en' })).toBeNull();
    const empty = resume({
      header: { fullName: '', jobTitle: '', contact: {} } as any,
      experience: [],
      skills: [],
    });
    // No query means alerting about random jobs, which is worse than silence.
    expect(buildAlertProfile(empty, { locale: 'en' })).toBeNull();
  });
});

describe('pickNewMatches', () => {
  it('only surfaces jobs above the alert bar', () => {
    const out = pickNewMatches([match('a', 90), match('b', 50)], []);
    expect(out.map((m) => m.job.id)).toEqual(['a']);
  });

  it('never re-alerts something already shown', () => {
    const out = pickNewMatches([match('a', 90), match('b', 88)], ['a']);
    expect(out.map((m) => m.job.id)).toEqual(['b']);
  });

  it('returns nothing when everything has been seen', () => {
    expect(pickNewMatches([match('a', 95)], ['a'])).toEqual([]);
  });
});

describe('rememberSeen', () => {
  it('remembers what was just shown, newest first', () => {
    expect(rememberSeen(['old'], [match('new', 90)])).toEqual(['new', 'old']);
  });

  it('does not grow duplicates', () => {
    expect(rememberSeen(['a'], [match('a', 90)])).toEqual(['a']);
  });

  it('is bounded so storage cannot grow forever', () => {
    const seen = Array.from({ length: 500 }, (_, i) => `j${i}`);
    expect(rememberSeen(seen, [match('fresh', 90)], 300)).toHaveLength(300);
    expect(rememberSeen(seen, [match('fresh', 90)], 300)[0]).toBe('fresh');
  });
});

describe('profilesDiffer', () => {
  const base = buildAlertProfile(resume(), { industry: 'healthcare', locale: 'en' })!;

  it('is false for an unchanged profile — no pointless re-registration', () => {
    const same = buildAlertProfile(resume(), { industry: 'healthcare', locale: 'en' })!;
    expect(profilesDiffer(base, same)).toBe(false);
  });

  it('notices a changed target role, location, skills or language', () => {
    expect(profilesDiffer(base, { ...base, query: 'Nurse Practitioner' })).toBe(true);
    expect(profilesDiffer(base, { ...base, location: 'Karachi' })).toBe(true);
    expect(profilesDiffer(base, { ...base, skills: ['Triage'] })).toBe(true);
    expect(profilesDiffer(base, { ...base, locale: 'ur' })).toBe(true);
  });

  it('handles either side being absent', () => {
    expect(profilesDiffer(null, base)).toBe(true);
    expect(profilesDiffer(null, null)).toBe(false);
  });
});
