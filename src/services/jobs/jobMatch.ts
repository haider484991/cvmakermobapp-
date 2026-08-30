/**
 * Local resume ↔ job matching
 * ---------------------------
 *
 * Ranks feed jobs against a resume WITHOUT calling the AI. That constraint is
 * the whole design: a feed page is 30–60 jobs, and `tailorToJob()` is a paid
 * model call, so AI-scoring the feed would cost more per browse than the app
 * earns per user. This runs on-device, instantly, for free — and the paid
 * tailor call then runs on the single job the user actually taps.
 *
 * What it scores, in rough order of how much it matters:
 *
 *   - TITLE. A "Staff Nurse" resume against a "Registered Nurse" posting is a
 *     strong match; against "Sales Manager" it is not. Token overlap on the
 *     title carries the most weight because it is the strongest real signal.
 *   - SKILLS. How many of the resume's skills appear anywhere in the posting.
 *   - SENIORITY. Junior/senior/lead/manager markers, penalised when they
 *     clash — a junior resume against a Director role is a bad suggestion
 *     even if every keyword lines up.
 *   - RECENCY and REMOTE, as light tiebreakers only.
 *
 * The output is deliberately honest: `matchedSkills` and `missingSkills` come
 * from the same comparison that produced the score, so the UI can explain a
 * number rather than assert it.
 */

import type { Resume } from '@/types/resume';
import type { Job } from '@/types/jobs';

export interface JobMatch {
  job: Job;
  /** 0–100. Comparable within a result set; not a probability of anything. */
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  /** True when the resume and the posting disagree on seniority. */
  seniorityMismatch: boolean;
}

/** Words too common in job ads to carry signal. */
const STOP = new Set([
  'the', 'and', 'for', 'with', 'you', 'our', 'are', 'will', 'that', 'this', 'have',
  'job', 'jobs', 'role', 'roles', 'work', 'team', 'new', 'all', 'your', 'from',
  'senior', 'junior', 'lead', 'staff', 'principal', 'head', 'chief', 'director',
  'manager', 'i', 'ii', 'iii', 'sr', 'jr', 'remote', 'hybrid', 'full', 'time', 'part',
]);

const SENIORITY: Array<{ rank: number; markers: RegExp }> = [
  { rank: 1, markers: /\b(intern|trainee|graduate|entry[- ]level|junior|jr\.?|apprentice|assistant)\b/i },
  { rank: 2, markers: /\b(associate|mid[- ]level|ii\b)\b/i },
  { rank: 3, markers: /\b(senior|sr\.?|iii\b|specialist|lead)\b/i },
  { rank: 4, markers: /\b(principal|staff engineer|manager|head of|director|vp|vice president|chief|executive|c[teof]o)\b/i },
];

function tokens(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** Seniority rank 1–4, or 0 when the text says nothing about it. */
export function seniorityOf(text: string): number {
  let rank = 0;
  for (const { rank: r, markers } of SENIORITY) if (markers.test(text)) rank = Math.max(rank, r);
  return rank;
}

/** The resume's own seniority, from its title plus the most recent role. */
function resumeSeniority(resume: Resume): number {
  const fromTitle = seniorityOf(resume.header.jobTitle || '');
  if (fromTitle) return fromTitle;
  const recent = resume.experience[0];
  return recent ? seniorityOf(recent.title || '') : 0;
}

/**
 * Every skill-ish phrase the resume claims. Skills first (the user listed them
 * deliberately), then role titles, which are often the strongest keyword a
 * posting will echo back.
 */
export function resumeSkills(resume: Resume): string[] {
  const out: string[] = [];
  for (const s of resume.skills) if (s.name?.trim()) out.push(s.name.trim());
  for (const e of resume.experience) if (e.title?.trim()) out.push(e.title.trim());
  // Dedupe case-insensitively, keeping the first spelling the user used.
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Fraction of `a`'s meaningful tokens that also appear in `b`. */
function overlap(a: string, b: string): number {
  const at = tokens(a);
  if (at.length === 0) return 0;
  const bt = new Set(tokens(b));
  let hit = 0;
  for (const w of at) if (bt.has(w)) hit++;
  return hit / at.length;
}

/** Days since the posting went up, or null when the source didn't say. */
function ageInDays(job: Job, now: number): number | null {
  if (!job.publishedAt) return null;
  const t = Date.parse(job.publishedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (now - t) / 86_400_000);
}

/**
 * Score one job against one resume.
 *
 * `now` is injected rather than read from the clock so the scoring stays pure
 * and the recency component is testable.
 */
export function scoreJob(resume: Resume, job: Job, skills: string[], now: number): JobMatch {
  const haystack = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase();

  // --- Title (0–55) -------------------------------------------------------
  const resumeTitle = resume.header.jobTitle || resume.experience[0]?.title || '';
  const titleScore = overlap(resumeTitle, job.title) * 55;

  // --- Skills (0–35) ------------------------------------------------------
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const skill of skills) {
    const needle = skill.toLowerCase();
    // Short tokens like "R" or "Go" need a word boundary; longer ones don't,
    // so "React" still matches "ReactJS".
    const found =
      needle.length <= 3
        ? new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack)
        : haystack.includes(needle);
    (found ? matchedSkills : missingSkills).push(skill);
  }
  const skillScore = skills.length ? (matchedSkills.length / skills.length) * 35 : 0;

  // --- Seniority (−20 … +10) ---------------------------------------------
  const rRank = resumeSeniority(resume);
  const jRank = seniorityOf(job.title);
  let seniorityScore = 0;
  let seniorityMismatch = false;
  if (rRank && jRank) {
    const gap = Math.abs(rRank - jRank);
    if (gap === 0) seniorityScore = 10;
    else if (gap === 1) seniorityScore = 2;
    else {
      seniorityScore = -20;
      seniorityMismatch = true;
    }
  }

  // --- Tiebreakers (0–10 combined) ---------------------------------------
  const age = ageInDays(job, now);
  const recencyScore = age === null ? 3 : age <= 7 ? 6 : age <= 30 ? 3 : 0;
  const remoteScore = job.remote ? 4 : 0;

  const raw = titleScore + skillScore + seniorityScore + recencyScore + remoteScore;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return { job, score, matchedSkills, missingSkills, seniorityMismatch };
}

export interface RankOptions {
  /** Drop anything below this before returning. Default 25. */
  minScore?: number;
  /** Cap the list. Default 8 — this is a suggestion strip, not a feed. */
  limit?: number;
  /** Injected clock, for testability. */
  now?: number;
}

/**
 * Rank a feed against a resume, best first.
 *
 * Returns fewer results rather than padding with bad ones: a weak suggestion
 * at the export moment costs more trust than an empty state does.
 */
export function rankJobs(resume: Resume, jobs: Job[], opts: RankOptions = {}): JobMatch[] {
  const { minScore = 25, limit = 8, now = Date.now() } = opts;
  const skills = resumeSkills(resume);

  return jobs
    .map((job) => scoreJob(resume, job, skills, now))
    .filter((m) => m.score >= minScore && !m.seniorityMismatch)
    .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
    .slice(0, limit);
}

/**
 * The search term to pull a feed for this resume. The user's stated target
 * title beats their last job title, which beats their strongest skill.
 */
export function queryForResume(resume: Resume): string {
  const title = resume.header.jobTitle?.trim();
  if (title) return title;
  const recent = resume.experience[0]?.title?.trim();
  if (recent) return recent;
  return resume.skills[0]?.name?.trim() ?? '';
}

/** Coarse label for a score, so the UI isn't just a bare number. */
export function matchLabel(score: number): 'strong' | 'good' | 'partial' {
  if (score >= 70) return 'strong';
  if (score >= 45) return 'good';
  return 'partial';
}
