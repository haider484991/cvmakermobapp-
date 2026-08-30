/**
 * Tests for the application tracker's logic.
 *
 * The list answers one question — "what should I do next?" — so the failures
 * that matter are ordering and nagging: a three-week-old rejection sitting
 * above tomorrow's interview, or a follow-up nudge on a thread that is already
 * live. Both make the feature feel stupid rather than useful, and a job search
 * is stressful enough without the app being wrong about it.
 */

import {
  daysSince,
  needsFollowUp,
  summarize,
  sortForDisplay,
  resumePerformance,
  FOLLOW_UP_DAYS,
  type Application,
  type ApplicationStatus,
} from '@/services/applications/applicationInsights';

const NOW = Date.parse('2026-08-29T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

let seq = 0;
function app(patch: Partial<Application> = {}): Application {
  seq += 1;
  const appliedAt = patch.appliedAt ?? daysAgo(1);
  return {
    id: `a${seq}`,
    jobId: `j${seq}`,
    title: 'Registered Nurse',
    company: 'City Hospital',
    location: 'Lahore',
    url: 'https://example.com',
    status: 'applied',
    appliedAt,
    updatedAt: patch.updatedAt ?? appliedAt,
    ...patch,
  };
}

describe('daysSince', () => {
  it('counts whole days', () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(daysAgo(9), NOW)).toBe(9);
  });

  it('never returns a negative for a future timestamp', () => {
    expect(daysSince(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0);
  });

  it('treats an unparseable date as today rather than throwing', () => {
    expect(daysSince('not a date', NOW)).toBe(0);
  });
});

describe('needsFollowUp', () => {
  it('fires once an application has gone quiet past the threshold', () => {
    expect(needsFollowUp(app({ appliedAt: daysAgo(FOLLOW_UP_DAYS) }), NOW)).toBe(true);
    expect(needsFollowUp(app({ appliedAt: daysAgo(FOLLOW_UP_DAYS + 5) }), NOW)).toBe(true);
  });

  it('stays quiet before the threshold', () => {
    expect(needsFollowUp(app({ appliedAt: daysAgo(FOLLOW_UP_DAYS - 1) }), NOW)).toBe(false);
  });

  it('never nags about a thread that is already live or closed', () => {
    const old = daysAgo(30);
    for (const status of ['interviewing', 'offer', 'rejected'] as ApplicationStatus[]) {
      expect(needsFollowUp(app({ appliedAt: old, status }), NOW)).toBe(false);
    }
  });
});

describe('summarize', () => {
  it('counts by status and separates open from closed', () => {
    const s = summarize(
      [
        app({ status: 'applied' }),
        app({ status: 'applied' }),
        app({ status: 'interviewing' }),
        app({ status: 'offer' }),
        app({ status: 'rejected' }),
      ],
      NOW,
    );
    expect(s.total).toBe(5);
    expect(s.open).toBe(4); // rejected is the only closed one
    expect(s.byStatus.applied).toBe(2);
    expect(s.byStatus.rejected).toBe(1);
  });

  it('counts what needs chasing and what went out this week', () => {
    const s = summarize(
      [
        app({ appliedAt: daysAgo(10) }), // quiet, needs a nudge
        app({ appliedAt: daysAgo(9) }), // quiet, needs a nudge
        app({ appliedAt: daysAgo(2) }), // recent
        app({ appliedAt: daysAgo(20), status: 'interviewing' }), // live, no nudge
      ],
      NOW,
    );
    expect(s.needsFollowUp).toBe(2);
    expect(s.thisWeek).toBe(1);
  });

  it('handles an empty tracker', () => {
    const s = summarize([], NOW);
    expect(s).toMatchObject({ total: 0, open: 0, needsFollowUp: 0, thisWeek: 0 });
    expect(s.byStatus.applied).toBe(0);
  });
});

describe('sortForDisplay', () => {
  it('puts what needs chasing at the very top', () => {
    const stale = app({ id: 'stale', appliedAt: daysAgo(20) });
    const fresh = app({ id: 'fresh', appliedAt: daysAgo(1) });
    expect(sortForDisplay([fresh, stale], NOW)[0].id).toBe('stale');
  });

  it('never ranks an old rejection above a live interview', () => {
    const rejected = app({ id: 'rej', status: 'rejected', updatedAt: daysAgo(1) });
    const interviewing = app({ id: 'int', status: 'interviewing', updatedAt: daysAgo(20) });
    const order = sortForDisplay([rejected, interviewing], NOW).map((a) => a.id);
    expect(order.indexOf('int')).toBeLessThan(order.indexOf('rej'));
  });

  it('ranks an offer above everything else that is live', () => {
    const offer = app({ id: 'off', status: 'offer', updatedAt: daysAgo(9) });
    const interviewing = app({ id: 'int', status: 'interviewing', updatedAt: daysAgo(1) });
    expect(sortForDisplay([interviewing, offer], NOW)[0].id).toBe('off');
  });

  it('breaks ties by most recently touched, then stably', () => {
    const older = app({ id: 'older', status: 'interviewing', updatedAt: daysAgo(5) });
    const newer = app({ id: 'newer', status: 'interviewing', updatedAt: daysAgo(1) });
    expect(sortForDisplay([older, newer], NOW).map((a) => a.id)).toEqual(['newer', 'older']);

    const same = { status: 'interviewing' as const, updatedAt: daysAgo(3) };
    const a1 = app({ id: 'aaa', ...same });
    const a2 = app({ id: 'bbb', ...same });
    expect(sortForDisplay([a2, a1], NOW).map((a) => a.id)).toEqual(['aaa', 'bbb']);
  });

  it('does not mutate the input', () => {
    const list = [app({ id: 'x', status: 'rejected' }), app({ id: 'y', status: 'offer' })];
    const before = list.map((a) => a.id);
    sortForDisplay(list, NOW);
    expect(list.map((a) => a.id)).toEqual(before);
  });
});

describe('resumePerformance', () => {
  const sent = (resumeId: string, resumeName: string, statuses: ApplicationStatus[]) =>
    statuses.map((status) => app({ status, resumeId, resumeName }));

  it('counts any movement past "applied" as a response, including a rejection', () => {
    // A rejection still means a human read it — that is signal about the
    // resume, and hiding it would flatter the user with a fake low denominator.
    const out = resumePerformance(sent('r1', 'A', ['applied', 'rejected', 'interviewing']));
    expect(out[0]).toMatchObject({ resumeId: 'r1', sent: 3, responses: 2, responseRate: 67 });
  });

  it('ranks the better-performing resume first', () => {
    const out = resumePerformance([
      ...sent('r1', 'A', ['applied', 'applied', 'applied', 'interviewing']),
      ...sent('r2', 'B', ['interviewing', 'interviewing', 'offer', 'applied']),
    ]);
    expect(out.map((r) => r.resumeId)).toEqual(['r2', 'r1']);
  });

  it('says nothing until there is enough data to mean anything', () => {
    // One application at 100% is noise dressed up as insight.
    expect(resumePerformance(sent('r1', 'A', ['interviewing']))).toEqual([]);
    expect(resumePerformance(sent('r1', 'A', ['interviewing', 'applied']))).toEqual([]);
    expect(resumePerformance(sent('r1', 'A', ['interviewing', 'applied', 'applied']))).toHaveLength(1);
  });

  it('ignores applications with no resume attached', () => {
    expect(resumePerformance([app(), app(), app()])).toEqual([]);
  });
});
