/**
 * Live Job Feed — multi-source job search (v1.11).
 *
 * Aggregates several PUBLIC, KEYLESS job boards so no secret ships in the
 * client bundle and users get real, varied listings:
 *
 *   • The Muse  — real companies (Uber, SpaceX, Bank of America) with REAL
 *                 LOCATIONS, on-site + remote. Supports location search, so a
 *                 user in New York or Jakarta can find local roles.
 *   • Remotive  — remote-first roles, worldwide-friendly.
 *   • Jobicy    — remote roles with a geo filter.
 *
 * All sources are normalized to one `Job` shape with plain-text descriptions,
 * then deduped and interleaved so no single board dominates the feed. Sources
 * are queried in parallel and failures are isolated: if one board is down the
 * feed still works.
 *
 * If we later add a keyed aggregator (Adzuna/JSearch) it should be proxied
 * through a Supabase Edge Function — the UI only ever calls `searchJobs()`.
 */

import type { Job, JobSearchResult } from '@/types/jobs';

const MUSE_URL = 'https://www.themuse.com/api/public/jobs';
const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';
const JOBICY_URL = 'https://jobicy.com/api/v2/remote-jobs';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Convert an HTML job description into readable plain text. */
function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&rsquo;|&lsquo;|&apos;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&hellip;/gi, '…')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Prettify snake_case job types ("full_time" → "Full time"). */
function prettyType(t?: string | string[]): string | undefined {
  const raw = Array.isArray(t) ? t[0] : t;
  if (!raw) return undefined;
  return String(raw).replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Abortable fetch with a timeout so one slow board can't hang the feed. */
async function getJson(url: string, signal?: AbortSignal, timeoutMs = 12_000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Source adapters — each returns Job[] and never throws to the caller */
/* ------------------------------------------------------------------ */

async function fromMuse(query: string, location: string, signal?: AbortSignal): Promise<Job[]> {
  const p = new URLSearchParams({ page: '1' });
  if (location.trim()) p.set('location', location.trim());
  const data = await getJson(`${MUSE_URL}?${p.toString()}`, signal);
  const q = query.trim().toLowerCase();
  return (data.results || [])
    // The Muse has no keyword param, so filter client-side. Require EVERY
    // word to match (AND, not OR) — an OR match on "product manager" happily
    // returns "Nurse Care Manager", which is not what the user asked for.
    .filter((j: any) => {
      if (!q) return true;
      const hay = `${j.name} ${j.company?.name || ''} ${(j.categories || []).map((c: any) => c.name).join(' ')}`.toLowerCase();
      return q.split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
    })
    .map((j: any): Job => {
      const locs = (j.locations || []).map((l: any) => l.name).filter(Boolean);
      const isRemote = locs.some((l: string) => /flexible|remote/i.test(l));
      return {
        id: `muse-${j.id}`,
        title: j.name,
        company: j.company?.name || 'Company',
        location: locs.length ? locs.slice(0, 2).join(' · ') : 'Flexible',
        category: (j.categories || [])[0]?.name,
        jobType: (j.levels || [])[0]?.name,
        url: j.refs?.landing_page || '',
        publishedAt: j.publication_date,
        description: htmlToText(j.contents || ''),
        tags: (j.categories || []).map((c: any) => c.name).slice(0, 3),
        remote: isRemote,
        source: 'The Muse',
      };
    })
    .filter((j: Job) => j.url && j.description.length > 100);
}

async function fromRemotive(query: string, signal?: AbortSignal): Promise<Job[]> {
  const p = new URLSearchParams({ limit: '40' });
  if (query.trim()) p.set('search', query.trim());
  const data = await getJson(`${REMOTIVE_URL}?${p.toString()}`, signal);
  return (data.jobs || []).map(
    (j: any): Job => ({
      id: `remotive-${j.id}`,
      title: j.title,
      company: j.company_name,
      companyLogo: j.company_logo || undefined,
      location: j.candidate_required_location || 'Remote',
      category: j.category,
      jobType: prettyType(j.job_type),
      salary: j.salary || undefined,
      url: j.url,
      publishedAt: j.publication_date,
      description: htmlToText(j.description || ''),
      tags: (j.tags || []).slice(0, 3),
      remote: true,
      source: 'Remotive',
    }),
  );
}

async function fromJobicy(query: string, signal?: AbortSignal): Promise<Job[]> {
  const p = new URLSearchParams({ count: '30' });
  if (query.trim()) p.set('tag', query.trim());
  const data = await getJson(`${JOBICY_URL}?${p.toString()}`, signal);
  return (data.jobs || []).map(
    (j: any): Job => ({
      id: `jobicy-${j.id}`,
      title: j.jobTitle,
      company: j.companyName,
      companyLogo: j.companyLogo || undefined,
      location: j.jobGeo || 'Remote',
      category: (j.jobIndustry || [])[0],
      jobType: prettyType(j.jobType),
      salary: j.annualSalaryMin ? `${j.salaryCurrency || ''}${j.annualSalaryMin}+` : undefined,
      url: j.url,
      publishedAt: j.pubDate,
      description: htmlToText(j.jobDescription || j.jobExcerpt || ''),
      tags: (j.jobIndustry || []).slice(0, 3),
      remote: true,
      source: 'Jobicy',
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

/** Interleave lists round-robin so one board never dominates the top. */
function interleave(lists: Job[][]): Job[] {
  const out: Job[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) if (list[i]) out.push(list[i]);
  }
  return out;
}

export interface JobSearchOptions {
  /** City/region for on-site roles, e.g. "New York, NY". Empty = anywhere. */
  location?: string;
  /** Only return remote-friendly roles. */
  remoteOnly?: boolean;
  signal?: AbortSignal;
}

/**
 * Search jobs across every source. Resolves even if some boards fail —
 * a partial feed beats an error screen.
 */
export async function searchJobs(query: string, opts: JobSearchOptions = {}): Promise<JobSearchResult> {
  const { location = '', remoteOnly = false, signal } = opts;

  // Skip location-less boards when the user is searching a specific city, and
  // skip The Muse when they explicitly want remote-only.
  const tasks: Promise<Job[]>[] = [
    remoteOnly ? Promise.resolve([]) : fromMuse(query, location, signal).catch(() => []),
    fromRemotive(query, signal).catch(() => []),
    fromJobicy(query, signal).catch(() => []),
  ];

  const [muse, remotive, jobicy] = await Promise.all(tasks);

  // Dedupe on title+company (the same role is often syndicated to several boards).
  const seen = new Set<string>();
  const dedupe = (list: Job[]) =>
    list.filter((j) => {
      const key = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  let jobs = interleave([dedupe(muse), dedupe(remotive), dedupe(jobicy)]);
  if (remoteOnly) jobs = jobs.filter((j) => j.remote);

  return { jobs, total: jobs.length, sources: [muse.length, remotive.length, jobicy.length] };
}

/** "3 days ago" style relative date for a job's publish time. */
export function jobAge(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
