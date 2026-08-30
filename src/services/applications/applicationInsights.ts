/**
 * Application tracking — the logic half.
 *
 * Why this feature exists: a resume builder is structurally one-and-done, and
 * 73% of this app's users never came back after exporting. A *job search* is
 * not one-and-done — it runs for weeks — but only if the app holds something
 * that changes while the user is away. A list of live applications is that
 * something: it accrues, it ages, and it eventually needs chasing. Job seekers
 * already keep this list, in spreadsheets and Notes apps.
 *
 * Everything here is pure and clock-injected, so the "this needs a follow-up"
 * judgement is testable rather than a surprise at runtime.
 */

export type ApplicationStatus = 'applied' | 'interviewing' | 'offer' | 'rejected';

export interface Application {
  id: string;
  /** Feed job id, so we don't log the same posting twice. */
  jobId: string;
  title: string;
  company: string;
  location: string;
  /** The posting, for reopening it later. */
  url: string;
  status: ApplicationStatus;
  /** ISO. Set once, on logging. */
  appliedAt: string;
  /** ISO. Bumped on every status change — this is what "stale" measures. */
  updatedAt: string;
  notes?: string;
  /** Which resume went out, so we can later compare response rates. */
  resumeId?: string;
  resumeName?: string;
  /** Match score at the time of applying. */
  matchScore?: number;
  /**
   * Interview prep, cached once generated. Kept on the application rather
   * than regenerated on open: it is the most expensive call the app makes,
   * and someone re-reads it several times in the days before an interview.
   */
  interviewPrep?: {
    questions: Array<{ category: string; question: string; why: string; angle: string }>;
    askThem: string[];
    generatedAt: string;
  };
}

/** Statuses that are still in play. */
export const OPEN_STATUSES: ApplicationStatus[] = ['applied', 'interviewing', 'offer'];

/**
 * Days after applying with no word back before we suggest a follow-up.
 * A week is the common advice and, more practically, is long enough that the
 * nudge reads as useful rather than nagging.
 */
export const FOLLOW_UP_DAYS = 7;

/** Whole days between an ISO timestamp and `now`. Negative clamps to 0. */
export function daysSince(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/**
 * Is this application worth chasing?
 *
 * Only ever true for 'applied' — once someone is interviewing they have a
 * live thread and a generic nudge is noise; 'rejected' is closed; and 'offer'
 * needs a decision, not a chase.
 */
export function needsFollowUp(app: Application, now: number): boolean {
  return app.status === 'applied' && daysSince(app.appliedAt, now) >= FOLLOW_UP_DAYS;
}

export interface ApplicationSummary {
  total: number;
  /** Still in play. */
  open: number;
  byStatus: Record<ApplicationStatus, number>;
  /** Applied, no reply, past the follow-up threshold. */
  needsFollowUp: number;
  /** Applications logged in the last 7 days — the "am I still trying?" number. */
  thisWeek: number;
}

export function summarize(apps: Application[], now: number): ApplicationSummary {
  const byStatus: Record<ApplicationStatus, number> = {
    applied: 0,
    interviewing: 0,
    offer: 0,
    rejected: 0,
  };
  let needs = 0;
  let thisWeek = 0;

  for (const a of apps) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    if (needsFollowUp(a, now)) needs++;
    if (daysSince(a.appliedAt, now) < 7) thisWeek++;
  }

  return {
    total: apps.length,
    open: OPEN_STATUSES.reduce((n, s) => n + byStatus[s], 0),
    byStatus,
    needsFollowUp: needs,
    thisWeek,
  };
}

/**
 * Display order: things needing action first, then live threads, then the
 * closed ones. Within a group, most recently touched first.
 *
 * The point of the list is "what should I do next", so a rejection from three
 * weeks ago must never sit above an interview happening tomorrow.
 */
const STATUS_RANK: Record<ApplicationStatus, number> = {
  offer: 0,
  interviewing: 1,
  applied: 2,
  rejected: 3,
};

export function sortForDisplay(apps: Application[], now: number): Application[] {
  return [...apps].sort((a, b) => {
    const aNeeds = needsFollowUp(a, now) ? 0 : 1;
    const bNeeds = needsFollowUp(b, now) ? 0 : 1;
    if (aNeeds !== bNeeds) return aNeeds - bNeeds;

    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;

    const t = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (t !== 0 && Number.isFinite(t)) return t;
    return a.id.localeCompare(b.id); // stable
  });
}

/**
 * Response rate per resume, for the "which version actually worked" question.
 * A response is any application that moved beyond 'applied' — including a
 * rejection, because a rejection still means a human read it.
 *
 * Returns nothing below `minSent`: a 100% rate from one application is noise
 * dressed up as insight, and showing it would be worse than showing nothing.
 */
export interface ResumePerformance {
  resumeId: string;
  resumeName: string;
  sent: number;
  responses: number;
  responseRate: number;
}

export function resumePerformance(apps: Application[], minSent = 3): ResumePerformance[] {
  const byResume = new Map<string, { name: string; sent: number; responses: number }>();

  for (const a of apps) {
    if (!a.resumeId) continue;
    const entry = byResume.get(a.resumeId) ?? { name: a.resumeName || '', sent: 0, responses: 0 };
    entry.sent++;
    if (a.status !== 'applied') entry.responses++;
    if (!entry.name && a.resumeName) entry.name = a.resumeName;
    byResume.set(a.resumeId, entry);
  }

  return [...byResume.entries()]
    .filter(([, v]) => v.sent >= minSent)
    .map(([resumeId, v]) => ({
      resumeId,
      resumeName: v.name,
      sent: v.sent,
      responses: v.responses,
      responseRate: Math.round((v.responses / v.sent) * 100),
    }))
    .sort((a, b) => b.responseRate - a.responseRate || b.sent - a.sent);
}
