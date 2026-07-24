/**
 * Live Job Feed types (v1.11).
 */

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  /** Where the candidate can be based, e.g. "Worldwide", "USA Only". */
  location: string;
  category?: string;
  /** full_time / contract / part_time / freelance … (as the source reports it). */
  jobType?: string;
  salary?: string;
  /** URL to view / apply for the posting. */
  url: string;
  /** ISO date the job was published. */
  publishedAt?: string;
  /** Plain-text description (HTML stripped) — fed to the tailor + cover-letter AI. */
  description: string;
  tags: string[];
  remote: boolean;
  /** Which board this came from — shown as a small credit on the card. */
  source?: string;
}

export interface JobSearchResult {
  jobs: Job[];
  total: number;
  /** Per-source result counts [muse, remotive, jobicy] — for diagnostics. */
  sources?: number[];
}
