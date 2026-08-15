/**
 * Resume Import Hook
 * Handles the complete resume import flow with AI parsing
 */

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useResumeImportStore, getStatusMessage } from '@/stores/resumeImportStore';
import { useResumeStore } from '@/stores/resumeStore';
import {
  pickResumeFile,
  readFileAsBase64,
  cleanupTempFile,
  FilePickerError,
} from '@/services/fileImport/filePicker';
import { parseResumeWithAI } from '@/services/ai/resumeParser';
import { mapParsedDataToResume, getImportStats } from '@/services/fileImport/resumeMapper';
import { reviewSignals } from '@/services/review/reviewManager';
import { track, ANALYTICS_EVENTS } from '@/services/analytics/analytics';
import { captureError } from '@/services/analytics/sentry';
import type { SelectedFile, ParsedResumeData, ImportStats } from '@/types/resumeImport';
import type { Resume } from '@/types/resume';

/**
 * Resume Import Hook
 * Provides methods for selecting, parsing, and importing resumes
 */
export function useResumeImport() {
  const store = useResumeImportStore();
  const { createResume, setActiveResume } = useResumeStore();

  // Mutation for parsing resume with AI
  const parseMutation = useMutation({
    mutationFn: async (file: SelectedFile) => {
      store.setStatus('reading_file');
      const base64Content = await readFileAsBase64(file);

      store.setStatus('parsing');
      const result = await parseResumeWithAI(base64Content, file.type, file.mimeType);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to parse resume');
      }

      return result;
    },
    onSuccess: (result) => {
      store.setParsedData(result.data);
      store.setConfidence(result.confidence);
      store.setWarnings(result.warnings);
      store.setStatus('reviewing');
    },
    onError: (error: Error) => {
      store.setError(error.message);
      // Deliberate report (parse failures used to reach Sentry only as
      // context-free unhandled promise rejections).
      const file = store.selectedFile;
      captureError(error, {
        feature: 'resume_import',
        stage: store.status,
        fileType: file?.type,
        fileSizeKb: file?.size ? Math.round(file.size / 1024) : undefined,
      });
    },
  });

  /**
   * Select a file using the document picker
   */
  const selectFile = useCallback(async (): Promise<SelectedFile | null> => {
    try {
      store.setStatus('selecting_file');
      store.setError(null);

      const file = await pickResumeFile();
      store.setSelectedFile(file);

      return file;
    } catch (error) {
      if (error instanceof FilePickerError) {
        if (error.code === 'CANCELLED') {
          store.reset();
          return null;
        }
        store.setError(error.message);
      } else {
        store.setError(error instanceof Error ? error.message : 'Failed to select file');
      }
      return null;
    }
  }, [store]);

  /**
   * Parse the selected file with AI
   */
  const parseSelectedFile = useCallback(async (): Promise<void> => {
    const file = store.selectedFile;
    if (!file) {
      store.setError('No file selected');
      return;
    }

    // Failures land in store.error via onError; swallowing here keeps them
    // from doubling as unhandled promise rejections in Sentry.
    await parseMutation.mutateAsync(file).catch(() => {});
  }, [store, parseMutation]);

  /**
   * Combined flow: select file and parse
   */
  const selectAndParse = useCallback(async (): Promise<void> => {
    const file = await selectFile();
    if (file) {
      await parseMutation.mutateAsync(file).catch(() => {});
    }
  }, [selectFile, parseMutation]);

  /**
   * Import parsed data as a new resume
   */
  const importAsNewResume = useCallback(
    (resumeName?: string): string | null => {
      const data = store.parsedData;
      if (!data) {
        store.setError('No parsed data available');
        return null;
      }

      try {
        store.setStatus('importing');

        // Create the resume from parsed data
        const resume = mapParsedDataToResume(data, resumeName);

        // Get the resumeStore and add the new resume
        const resumeStore = useResumeStore.getState();

        // Create empty resume first to get an ID, then update with imported data
        const id = resumeStore.createResume(resume.name);

        // Get the created resume and update it with imported data
        const createdResume = resumeStore.getResume(id);
        if (createdResume) {
          // Update all fields from the imported resume
          resumeStore.updateHeader(id, resume.header);
          resumeStore.updateSummary(id, resume.summary);

          // Add all experience entries
          resume.experience.forEach((exp) => {
            resumeStore.addExperience(id, exp);
          });

          // Add all education entries
          resume.education.forEach((edu) => {
            resumeStore.addEducation(id, edu);
          });

          // Add all skills
          resume.skills.forEach((skill) => {
            resumeStore.addSkill(id, skill);
          });

          // Add all projects
          resume.projects.forEach((proj) => {
            resumeStore.addProject(id, proj);
          });
        }

        // Cleanup temp file
        if (store.selectedFile) {
          cleanupTempFile(store.selectedFile.uri);
        }

        store.setStatus('success');
        setActiveResume(id);

        // Record positive signal for the review prompt manager.
        reviewSignals.resumeImported().catch(() => {});

        // Analytics: this is the killer feature — track confidence + sizes.
        track(ANALYTICS_EVENTS.RESUME_IMPORT_SUCCEEDED, {
          confidence: store.confidence,
          file_type: store.selectedFile?.type,
          file_size_kb: store.selectedFile?.size ? Math.round(store.selectedFile.size / 1024) : undefined,
          experience_count: data.experience?.length ?? 0,
          education_count: data.education?.length ?? 0,
          skills_count: data.skills?.length ?? 0,
        });

        // Reset after a short delay
        setTimeout(() => store.reset(), 1500);

        return id;
      } catch (error) {
        store.setError(error instanceof Error ? error.message : 'Failed to import resume');
        return null;
      }
    },
    [store, setActiveResume]
  );

  /**
   * Cancel the import and reset state
   */
  const cancelImport = useCallback(() => {
    if (store.selectedFile) {
      cleanupTempFile(store.selectedFile.uri);
    }
    store.reset();
  }, [store]);

  /**
   * Get import statistics for the current parsed data
   */
  const getStats = useCallback((): ImportStats | null => {
    if (!store.parsedData) return null;
    return getImportStats(store.parsedData);
  }, [store.parsedData]);

  return {
    // State
    status: store.status,
    statusMessage: getStatusMessage(store.status),
    selectedFile: store.selectedFile,
    parsedData: store.parsedData,
    confidence: store.confidence,
    warnings: store.warnings,
    error: store.error,

    // Derived state
    isLoading: parseMutation.isPending || ['selecting_file', 'reading_file', 'parsing', 'importing'].includes(store.status),
    isReviewing: store.status === 'reviewing',
    isSuccess: store.status === 'success',
    isError: store.status === 'error',

    // Actions
    selectFile,
    parseSelectedFile,
    selectAndParse,
    importAsNewResume,
    cancelImport,
    getStats,
    reset: store.reset,
  };
}

export default useResumeImport;
