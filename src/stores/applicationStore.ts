/**
 * Application tracker store.
 *
 * Persisted, unlike `jobStore` — that one carries a transient posting between
 * screens, this one is the record of what the user actually did, and it is the
 * whole point of the feature. If it vanished on restart there would be no
 * reason to reopen the app, which is the problem it exists to solve.
 *
 * Deliberately local-only: no account required, nothing leaves the device.
 * The app's data-safety declaration says resume data stays on the device by
 * default, and where someone is applying for work is at least as sensitive as
 * their resume.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Application, ApplicationStatus } from '@/services/applications/applicationInsights';
import type { Job } from '@/types/jobs';

interface LogInput {
  job: Job;
  resumeId?: string;
  resumeName?: string;
  matchScore?: number;
}

interface ApplicationState {
  applications: Record<string, Application>;
  /**
   * Log an application. Returns the id, or null when this job is already
   * tracked — tapping Apply twice on the same posting is a normal thing to do
   * (the browser opens, they come back, they tap again) and must not create a
   * duplicate.
   */
  logApplication: (input: LogInput) => string | null;
  setStatus: (id: string, status: ApplicationStatus) => void;
  setNotes: (id: string, notes: string) => void;
  /** Cache generated interview prep so re-opening it costs nothing. */
  setInterviewPrep: (id: string, prep: NonNullable<Application['interviewPrep']>) => void;
  removeApplication: (id: string) => void;
  getAll: () => Application[];
  getByJobId: (jobId: string) => Application | null;
  hasApplied: (jobId: string) => boolean;
}

/** Stable-enough id without pulling in a uuid dependency. */
function newId(): string {
  return `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useApplicationStore = create<ApplicationState>()(
  persist(
    (set, get) => ({
      applications: {},

      logApplication: ({ job, resumeId, resumeName, matchScore }) => {
        if (get().hasApplied(job.id)) return null;

        const nowIso = new Date().toISOString();
        const app: Application = {
          id: newId(),
          jobId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.url,
          status: 'applied',
          appliedAt: nowIso,
          updatedAt: nowIso,
          resumeId,
          resumeName,
          matchScore,
        };
        set((s) => ({ applications: { ...s.applications, [app.id]: app } }));
        return app.id;
      },

      setStatus: (id, status) =>
        set((s) => {
          const existing = s.applications[id];
          if (!existing || existing.status === status) return s;
          return {
            applications: {
              ...s.applications,
              [id]: { ...existing, status, updatedAt: new Date().toISOString() },
            },
          };
        }),

      setInterviewPrep: (id, prep) =>
        set((s) => {
          const existing = s.applications[id];
          if (!existing) return s;
          return {
            applications: { ...s.applications, [id]: { ...existing, interviewPrep: prep } },
          };
        }),

      setNotes: (id, notes) =>
        set((s) => {
          const existing = s.applications[id];
          if (!existing) return s;
          return {
            applications: {
              ...s.applications,
              [id]: { ...existing, notes, updatedAt: new Date().toISOString() },
            },
          };
        }),

      removeApplication: (id) =>
        set((s) => {
          if (!s.applications[id]) return s;
          const next = { ...s.applications };
          delete next[id];
          return { applications: next };
        }),

      getAll: () => Object.values(get().applications),

      getByJobId: (jobId) => Object.values(get().applications).find((a) => a.jobId === jobId) ?? null,

      hasApplied: (jobId) => Object.values(get().applications).some((a) => a.jobId === jobId),
    }),
    {
      name: 'application-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useApplicationStore;
