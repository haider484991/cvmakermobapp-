/**
 * useJobMatches — jobs that match a finished resume.
 *
 * Deliberately lazy: nothing is fetched until `load()` is called, because the
 * only place this runs is the moment AFTER a successful export. Firing a
 * three-board search on every visit to the export screen would spend the
 * user's data on a screen they might be leaving.
 *
 * Ranking is local (see services/jobs/jobMatch.ts) so this costs one HTTP
 * search and zero AI calls.
 */

import { useCallback, useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { searchJobs } from '@/services/jobs/jobsApi';
import { rankJobs, queryForResume, type JobMatch } from '@/services/jobs/jobMatch';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { captureError } from '@/services/analytics/sentry';
import type { Resume } from '@/types/resume';

interface UseJobMatchesReturn {
  matches: JobMatch[];
  isLoading: boolean;
  /** True once a load has completed, whether or not it found anything. */
  hasLoaded: boolean;
  error: boolean;
  load: () => void;
}

export function useJobMatches(resume: Resume | null | undefined): UseJobMatchesReturn {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(false);
  /** Guards against a second load if the user exports twice in one session. */
  const inFlight = useRef(false);
  // Onboarding already asked which industry they're in; it's the difference
  // between a nurse seeing nursing roles and seeing nothing at all.
  const industry = useUIStore((s) => s.onboardingProfile.industry);

  const load = useCallback(() => {
    if (!resume || inFlight.current) return;

    const query = queryForResume(resume);
    if (!query) {
      // Nothing to search on — treat as a completed, empty load so the UI can
      // fall back to the job tab rather than spinning forever.
      setHasLoaded(true);
      return;
    }

    inFlight.current = true;
    setIsLoading(true);
    setError(false);

    const location = resume.header.contact?.location?.trim() || '';

    void (async () => {
      const startedAt = Date.now();
      try {
        const { jobs } = await searchJobs(query, { location, industry });
        const ranked = rankJobs(resume, jobs);
        setMatches(ranked);
        track(ANALYTICS_EVENTS.JOB_MATCHES_SHOWN, {
          query,
          had_location: Boolean(location),
          industry: industry ?? null,
          feed_size: jobs.length,
          match_count: ranked.length,
          top_score: ranked[0]?.score ?? 0,
          duration_ms: Date.now() - startedAt,
        });
      } catch (err) {
        setError(true);
        captureError(err, { where: 'useJobMatches', query });
        track(ANALYTICS_EVENTS.JOB_MATCHES_FAILED, { query });
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
        inFlight.current = false;
      }
    })();
  }, [resume, industry]);

  return { matches, isLoading, hasLoaded, error, load };
}

export default useJobMatches;
