import { create } from 'zustand';
import type { Job } from '@/types/jobs';

/**
 * Carries a job between screens (v1.11).
 *
 * `activeJob` is the job the user opened; `pendingJob` is the job whose
 * description should pre-fill the next tailor / cover-letter screen. We pass
 * it through a store rather than a route param because job descriptions run
 * to several thousand characters — far too large for a URL.
 *
 * Not persisted: a job posting is transient context, and stale listings
 * shouldn't resurface days later.
 */
interface JobState {
  activeJob: Job | null;
  pendingJob: Job | null;
  /** Last search text, so returning to the Jobs tab keeps the user's place. */
  lastQuery: string;
  setActiveJob: (job: Job | null) => void;
  /** Queue a job's description for the tailor / cover-letter screen. */
  setPendingJob: (job: Job | null) => void;
  /** Read + clear in one step so a job pre-fills exactly once. */
  consumePendingJob: () => Job | null;
  setLastQuery: (q: string) => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  activeJob: null,
  pendingJob: null,
  lastQuery: '',
  setActiveJob: (activeJob) => set({ activeJob }),
  setPendingJob: (pendingJob) => set({ pendingJob }),
  consumePendingJob: () => {
    const job = get().pendingJob;
    if (job) set({ pendingJob: null });
    return job;
  },
  setLastQuery: (lastQuery) => set({ lastQuery }),
}));
