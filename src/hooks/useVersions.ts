/**
 * Resume Versions Hook
 * Provides version management functionality for resumes
 */

import { useState, useCallback, useEffect } from 'react';
import { versionService, ResumeVersion } from '@/services/versions';
import { useResumeStore } from '@/stores/resumeStore';
import { Resume } from '@/types/resume';

export interface UseVersionsOptions {
  /**
   * Resume ID to manage versions for
   */
  resumeId: string;

  /**
   * Whether to enable auto-save
   */
  autoSave?: boolean;

  /**
   * Auto-save interval in milliseconds
   */
  autoSaveInterval?: number;
}

export interface UseVersionsReturn {
  /**
   * List of versions for the resume
   */
  versions: ResumeVersion[];

  /**
   * Whether versions are loading
   */
  isLoading: boolean;

  /**
   * Error message if any
   */
  error: string | null;

  /**
   * Create a new version snapshot
   */
  createVersion: (name?: string) => Promise<ResumeVersion | null>;

  /**
   * Restore a version
   */
  restoreVersion: (versionId: string) => Promise<boolean>;

  /**
   * Delete a version
   */
  deleteVersion: (versionId: string) => Promise<boolean>;

  /**
   * Rename a version
   */
  renameVersion: (versionId: string, newName: string) => Promise<boolean>;

  /**
   * Refresh versions list
   */
  refresh: () => Promise<void>;

  /**
   * Number of versions
   */
  versionCount: number;
}

export function useVersions({
  resumeId,
  autoSave = false,
  autoSaveInterval = 5 * 60 * 1000, // 5 minutes
}: UseVersionsOptions): UseVersionsReturn {
  const { getResume, getAllResumes, setResumes } = useResumeStore();

  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch versions for the resume
   */
  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const versionList = await versionService.getVersions(resumeId);
      setVersions(versionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch versions');
    } finally {
      setIsLoading(false);
    }
  }, [resumeId]);

  // Fetch versions on mount
  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave) return;

    const resume = getResume(resumeId);
    if (!resume) return;

    const intervalId = setInterval(async () => {
      const currentResume = getResume(resumeId);
      if (currentResume) {
        await versionService.createVersion(resumeId, currentResume, undefined, true);
        // Refresh version list after auto-save
        const updatedVersions = await versionService.getVersions(resumeId);
        setVersions(updatedVersions);
      }
    }, autoSaveInterval);

    return () => clearInterval(intervalId);
  }, [autoSave, autoSaveInterval, resumeId, getResume]);

  /**
   * Create a new version snapshot
   */
  const createVersion = useCallback(
    async (name?: string): Promise<ResumeVersion | null> => {
      const resume = getResume(resumeId);
      if (!resume) return null;

      setIsLoading(true);
      setError(null);

      try {
        const version = await versionService.createVersion(resumeId, resume, name, false);
        if (version) {
          setVersions((prev) => [version, ...prev]);
        }
        return version;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create version');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [resumeId, getResume]
  );

  /**
   * Restore a version
   */
  const restoreVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const restoredResume = await versionService.restoreVersion(versionId);
        if (!restoredResume) return false;

        // Update the resume in the store
        const currentResumes = getAllResumes();
        const updatedResumes = currentResumes.map((r) =>
          r.id === resumeId
            ? {
                ...restoredResume,
                id: resumeId,
                updatedAt: new Date().toISOString(),
              }
            : r
        );
        setResumes(updatedResumes);

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore version');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [resumeId, getAllResumes, setResumes]
  );

  /**
   * Delete a version
   */
  const deleteVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const success = await versionService.deleteVersion(resumeId, versionId);
        if (success) {
          setVersions((prev) => prev.filter((v) => v.id !== versionId));
        }
        return success;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete version');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [resumeId]
  );

  /**
   * Rename a version
   */
  const renameVersion = useCallback(
    async (versionId: string, newName: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const success = await versionService.renameVersion(resumeId, versionId, newName);
        if (success) {
          setVersions((prev) =>
            prev.map((v) => (v.id === versionId ? { ...v, name: newName } : v))
          );
        }
        return success;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename version');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [resumeId]
  );

  return {
    versions,
    isLoading,
    error,
    createVersion,
    restoreVersion,
    deleteVersion,
    renameVersion,
    refresh: fetchVersions,
    versionCount: versions.length,
  };
}

export default useVersions;
