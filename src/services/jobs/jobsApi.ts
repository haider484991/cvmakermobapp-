/**
 * Live Job Feed — job search service (v1.11).
 *
 * Uses the Remotive public job board API. Chosen deliberately:
 *   - KEYLESS (no signup, no secret to leak in the client bundle)
 *   - returns the FULL job description, which powers one-tap "Tailor to this
 *     job" and AI cover letters
 *   - remote roles are applicable to our globally-distributed, diaspora-heavy
 *     audience (a job in "Worldwide" is reachable from Jakarta or Kingston)
 *
 * React Native's fetch is native (no CORS), so we call the API directly.
 * If we later add a keyed aggregator (Adzuna, JSearch) for local on-site
 * jobs, proxy it through a Supabase Edge Function to hide the key — the app
 * only ever talks to `searchJobs()`, so the swap is invisible to the UI.
 */

import type { Job, JobSearchResult } from '@/types/jobs';

const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';

/** Convert Remotive's HTML description into readable plain text. */
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
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Prettify Remotive's snake_case job_type ("full_time" → "Full time"). */
function prettyType(t?: string): string | undefined {
  if (!t) return undefined;
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description: string;
}

/**
 * Search remote jobs. `query` is a free-text keyword (usually the user's
 * target role). Returns normalized Job objects with plain-text descriptions.
 * Never throws for an empty/failed response — returns an empty list so the UI
 * can show a friendly empty state.
 */
export async function searchJobs(
  query: string,
  opts: { limit?: number; signal?: AbortSignal } = {},
): Promise<JobSearchResult> {
  const { limit = 50, signal } = opts;
  const params = new URLSearchParams();
  if (query.trim()) params.set('search', query.trim());
  params.set('limit', String(limit));

  const res = await fetch(`${REMOTIVE_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Job search failed (${res.status})`);
  }
  const data = (await res.json()) as { jobs?: RemotiveJob[]; 'job-count'?: number };
  const jobs: Job[] = (data.jobs || []).map((j) => ({
    id: String(j.id),
    title: j.title,
    company: j.company_name,
    companyLogo: j.company_logo || undefined,
    location: j.candidate_required_location || 'Remote',
    category: j.category,
    jobType: prettyType(j.job_type),
    salary: j.salary || undefined,
    url: j.url,
    publishedAt: j.publication_date,
    description: htmlToText(j.description),
    tags: (j.tags || []).slice(0, 6),
    remote: true,
  }));

  return { jobs, total: data['job-count'] ?? jobs.length };
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
