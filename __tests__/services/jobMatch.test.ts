/**
 * Tests for local resume ↔ job matching.
 *
 * This runs at the highest-intent moment in the app — right after someone
 * exports a resume — so the failure that matters is not "ranked slightly
 * wrong", it is "suggested something obviously irrelevant". A nurse shown
 * sales roles at that moment costs more trust than showing nothing at all.
 * Most of what follows is therefore about what must NOT appear.
 */

import {
  rankJobs,
  scoreJob,
  resumeSkills,
  queryForResume,
  seniorityOf,
  matchLabel,
} from '@/services/jobs/jobMatch';
import type { Resume } from '@/types/resume';
import type { Job } from '@/types/jobs';

const NOW = Date.parse('2026-08-29T12:00:00Z');

function resume(patch: Partial<Resume> = {}): Resume {
  return {
    id: 'r1',
    name: 'Test',
    templateId: 'ats-professional',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    sections: [],
    header: {
      fullName: 'Ayesha Khan',
      jobTitle: 'Registered Nurse',
      contact: { email: '', phone: '', location: 'Lahore' } as any,
    },
    summary: '',
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
        bullets: [],
      },
    ],
    education: [],
    skills: [
      { id: 's1', name: 'Patient care' },
      { id: 's2', name: 'Triage' },
      { id: 's3', name: 'Wound care' },
      { id: 's4', name: 'IV lines' },
    ],
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    customSections: [],
    ...patch,
  } as Resume;
}

function job(patch: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    title: 'Registered Nurse',
    company: 'City Hospital',
    location: 'Lahore',
    url: 'https://example.com/j1',
    description: 'Provide patient care, triage arrivals and manage wound care on the ward.',
    tags: ['nursing', 'healthcare'],
    remote: false,
    publishedAt: '2026-08-26T00:00:00Z',
    ...patch,
  };
}

describe('scoreJob', () => {
  const skills = resumeSkills(resume());

  it('scores an on-title, on-skill posting highly', () => {
    const m = scoreJob(resume(), job(), skills, NOW);
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.matchedSkills).toEqual(expect.arrayContaining(['Patient care', 'Triage', 'Wound care']));
  });

  it('scores an unrelated posting low', () => {
    const m = scoreJob(
      resume(),
      job({
        title: 'Enterprise Sales Manager',
        description: 'Own a territory, run demos and hit quota. Salesforce experience required.',
        tags: ['sales'],
      }),
      skills,
      NOW,
    );
    expect(m.score).toBeLessThan(25);
  });

  it('reports what is missing, not just what matched', () => {
    const m = scoreJob(
      resume(),
      job({ description: 'Provide patient care on a busy ward.' }),
      skills,
      NOW,
    );
    expect(m.matchedSkills).toContain('Patient care');
    expect(m.missingSkills).toEqual(expect.arrayContaining(['Triage', 'Wound care']));
    // Every skill is accounted for exactly once.
    expect(m.matchedSkills.length + m.missingSkills.length).toBe(skills.length);
  });

  it('does not match a short skill inside an unrelated word', () => {
    const r = resume({ skills: [{ id: 's1', name: 'Go' }] as any });
    const m = scoreJob(
      r,
      job({ title: 'Backend Engineer', description: 'A good place to grow. Going places.', tags: [] }),
      resumeSkills(r),
      NOW,
    );
    // "Go" must not be found inside "good" or "Going".
    expect(m.matchedSkills).not.toContain('Go');
  });

  it('still matches a longer skill inside a compound word', () => {
    const r = resume({ skills: [{ id: 's1', name: 'React' }] as any });
    const m = scoreJob(
      r,
      job({ title: 'Frontend Engineer', description: 'We use ReactJS and TypeScript.', tags: [] }),
      resumeSkills(r),
      NOW,
    );
    expect(m.matchedSkills).toContain('React');
  });

  it('prefers a fresh posting over a stale one, all else equal', () => {
    const fresh = scoreJob(resume(), job({ publishedAt: '2026-08-28T00:00:00Z' }), skills, NOW);
    const stale = scoreJob(resume(), job({ id: 'j2', publishedAt: '2026-01-01T00:00:00Z' }), skills, NOW);
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it('tolerates a posting with no publish date', () => {
    const m = scoreJob(resume(), job({ publishedAt: undefined }), skills, NOW);
    expect(Number.isFinite(m.score)).toBe(true);
    expect(m.score).toBeGreaterThan(0);
  });
});

describe('seniority', () => {
  it('reads seniority markers out of a title', () => {
    expect(seniorityOf('Junior Developer')).toBe(1);
    expect(seniorityOf('Senior Developer')).toBe(3);
    expect(seniorityOf('Director of Engineering')).toBe(4);
    expect(seniorityOf('Developer')).toBe(0);
  });

  it('flags a two-step seniority gap as a mismatch', () => {
    const junior = resume({
      header: { ...resume().header, jobTitle: 'Junior Nurse' },
      experience: [],
    } as any);
    const m = scoreJob(junior, job({ title: 'Director of Nursing' }), resumeSkills(junior), NOW);
    expect(m.seniorityMismatch).toBe(true);
  });

  it('does not punish an adjacent step', () => {
    const senior = resume({ header: { ...resume().header, jobTitle: 'Senior Nurse' } } as any);
    const m = scoreJob(senior, job({ title: 'Lead Nurse' }), resumeSkills(senior), NOW);
    expect(m.seniorityMismatch).toBe(false);
  });
});

describe('rankJobs', () => {
  const feed: Job[] = [
    job({ id: 'a', title: 'Registered Nurse' }),
    job({ id: 'b', title: 'Enterprise Sales Manager', description: 'Quota, demos, CRM.', tags: ['sales'] }),
    job({ id: 'c', title: 'Staff Nurse', description: 'Triage and patient care.' }),
    job({ id: 'd', title: 'Director of Nursing', description: 'Lead the nursing department.' }),
  ];

  it('puts the best match first and drops the irrelevant one', () => {
    const out = rankJobs(resume(), feed, { now: NOW });
    expect(out.length).toBeGreaterThan(0);
    expect(['a', 'c']).toContain(out[0].job.id);
    expect(out.map((m) => m.job.id)).not.toContain('b');
  });

  it('never suggests a role two seniority steps away', () => {
    const junior = resume({
      header: { ...resume().header, jobTitle: 'Junior Nurse' },
      experience: [],
    } as any);
    const out = rankJobs(junior, feed, { now: NOW });
    expect(out.map((m) => m.job.id)).not.toContain('d');
  });

  it('returns nothing rather than padding with weak matches', () => {
    const unrelated = [
      job({ id: 'x', title: 'Tax Accountant', description: 'IFRS, audit, payroll.', tags: ['finance'] }),
      job({ id: 'y', title: 'Truck Driver', description: 'Class 1 licence required.', tags: [] }),
    ];
    expect(rankJobs(resume(), unrelated, { now: NOW })).toEqual([]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => job({ id: `m${i}` }));
    expect(rankJobs(resume(), many, { now: NOW, limit: 5 })).toHaveLength(5);
  });

  it('is deterministic for equally-scored jobs', () => {
    const many = [job({ id: 'z', title: 'Registered Nurse' }), job({ id: 'a2', title: 'Registered Nurse' })];
    const first = rankJobs(resume(), many, { now: NOW }).map((m) => m.job.id);
    const second = rankJobs(resume(), many, { now: NOW }).map((m) => m.job.id);
    expect(first).toEqual(second);
  });

  it('survives an empty or skill-less resume without throwing', () => {
    const bare = resume({ skills: [], experience: [], header: { ...resume().header, jobTitle: '' } } as any);
    expect(() => rankJobs(bare, feed, { now: NOW })).not.toThrow();
    expect(rankJobs(resume(), [], { now: NOW })).toEqual([]);
  });
});

describe('queryForResume', () => {
  it('prefers the stated target title', () => {
    expect(queryForResume(resume())).toBe('Registered Nurse');
  });

  it('falls back to the most recent role, then to a skill', () => {
    const noTitle = resume({ header: { ...resume().header, jobTitle: '' } } as any);
    expect(queryForResume(noTitle)).toBe('Staff Nurse');

    const onlySkills = resume({
      header: { ...resume().header, jobTitle: '' },
      experience: [],
    } as any);
    expect(queryForResume(onlySkills)).toBe('Patient care');
  });

  it('returns an empty string when it knows nothing, rather than guessing', () => {
    const empty = resume({
      header: { ...resume().header, jobTitle: '' },
      experience: [],
      skills: [],
    } as any);
    expect(queryForResume(empty)).toBe('');
  });
});

describe('matchLabel', () => {
  it('bands scores for display', () => {
    expect(matchLabel(85)).toBe('strong');
    expect(matchLabel(55)).toBe('good');
    expect(matchLabel(30)).toBe('partial');
  });
});
