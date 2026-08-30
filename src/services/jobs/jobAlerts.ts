/**
 * Job alerts — the subscription profile and the "what's actually new" logic.
 *
 * PRIVACY, deliberately: this sends a job-alert subscription, NOT a resume.
 * The server gets a search query, a location, an industry and a list of skill
 * keywords — the same thing Indeed or LinkedIn store when you save a search,
 * and the minimum a server needs to find matching roles while the app is
 * closed. It never receives the user's name, contact details, employers,
 * dates, or their resume text. That keeps the Play data-safety declaration
 * ("your resume data stays on your device by default") true.
 *
 * The other half of this file is `newJobIds` / `pickNewMatches`, which answer
 * "what has appeared since we last told them". Without that, an alert repeats
 * the same jobs every day and gets muted within a week — the fastest way to
 * lose a notification permission you only get asked for once.
 */

import type { Resume } from '@/types/resume';
import type { JobMatch } from '@/services/jobs/jobMatch';
import { queryForResume, resumeSkills } from '@/services/jobs/jobMatch';

/** What we send to the server. Nothing here identifies the person. */
export interface JobAlertProfile {
  /** The search term, e.g. "Registered Nurse". */
  query: string;
  /** Free-text city/region, or '' for anywhere. */
  location: string;
  /** Onboarding industry id — narrows The Muse to the right category. */
  industry?: string;
  /** Skill keywords used to score a posting. Capped: this is a filter, not a CV. */
  skills: string[];
  /** Don't notify below this match score. */
  minScore: number;
  /** So the notification arrives in the user's language. */
  locale: string;
}

/** Notifying below this is how you teach someone to ignore you. */
export const ALERT_MIN_SCORE = 70;

/** Plenty for matching; small enough that it is a keyword list, not a profile. */
const MAX_ALERT_SKILLS = 12;

/**
 * Build the subscription from a resume. Returns null when there is nothing to
 * search on — an alert with no query would notify about random jobs, which is
 * worse than no alert.
 */
export function buildAlertProfile(
  resume: Resume | null | undefined,
  opts: { industry?: string; locale: string; minScore?: number },
): JobAlertProfile | null {
  if (!resume) return null;
  const query = queryForResume(resume).trim();
  if (!query) return null;

  return {
    query,
    location: resume.header.contact?.location?.trim() ?? '',
    industry: opts.industry,
    skills: resumeSkills(resume).slice(0, MAX_ALERT_SKILLS),
    minScore: opts.minScore ?? ALERT_MIN_SCORE,
    locale: opts.locale,
  };
}

/**
 * Which of these matches has the user not been shown before?
 *
 * `seen` is every job id previously surfaced in an alert. Ids come from the
 * feed adapters and are stable per source (`muse-123`, `remotive-456`), so a
 * posting syndicated to two boards can still appear twice — the feed already
 * dedupes on title+company before this runs.
 */
export function pickNewMatches(matches: JobMatch[], seen: string[], minScore = ALERT_MIN_SCORE): JobMatch[] {
  const seenSet = new Set(seen);
  return matches.filter((m) => m.score >= minScore && !seenSet.has(m.job.id));
}

/** Ids to remember after an alert. Capped so the list can't grow forever. */
export function rememberSeen(seen: string[], justShown: JobMatch[], cap = 300): string[] {
  const next = [...justShown.map((m) => m.job.id), ...seen];
  // Newest first, deduped, then truncated — a job that falls off the end can
  // re-alert months later, which is fine and better than unbounded storage.
  return [...new Set(next)].slice(0, cap);
}

/**
 * Has anything changed enough to be worth re-registering the subscription?
 * Called when a resume is edited — we don't want a write on every keystroke.
 */
export function profilesDiffer(a: JobAlertProfile | null, b: JobAlertProfile | null): boolean {
  if (!a || !b) return a !== b;
  return (
    a.query !== b.query ||
    a.location !== b.location ||
    a.industry !== b.industry ||
    a.minScore !== b.minScore ||
    a.locale !== b.locale ||
    a.skills.join('|') !== b.skills.join('|')
  );
}
