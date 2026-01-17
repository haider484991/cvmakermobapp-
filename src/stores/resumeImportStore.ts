/**
 * Resume Import Store
 * Manages state for the AI-powered resume import feature
 */

import { create } from 'zustand';
import type {
  ImportStatus,
  SelectedFile,
  ParsedResumeData,
  ResumeImportState,
  ResumeImportActions,
} from '@/types/resumeImport';

/**
 * Initial state for the import store
 */
const initialState: ResumeImportState = {
  status: 'idle',
  selectedFile: null,
  parsedData: null,
  confidence: 0,
  warnings: [],
  error: null,
};

/**
 * Resume Import Store
 */
export const useResumeImportStore = create<ResumeImportState & ResumeImportActions>((set) => ({
  ...initialState,

  setStatus: (status: ImportStatus) => set({ status }),

  setSelectedFile: (file: SelectedFile | null) => set({ selectedFile: file }),

  setParsedData: (data: ParsedResumeData | null) => set({ parsedData: data }),

  setConfidence: (confidence: number) => set({ confidence }),

  setWarnings: (warnings: string[]) => set({ warnings }),

  setError: (error: string | null) =>
    set({
      error,
      status: error ? 'error' : 'idle',
    }),

  reset: () => set(initialState),
}));

/**
 * Selector for checking if import is in progress
 */
export const selectIsImporting = (state: ResumeImportState): boolean =>
  ['selecting_file', 'reading_file', 'parsing', 'importing'].includes(state.status);

/**
 * Selector for checking if review modal should be shown
 */
export const selectShowReviewModal = (state: ResumeImportState): boolean =>
  state.status === 'reviewing' && state.parsedData !== null;

/**
 * Selector for getting status message
 */
export const getStatusMessage = (status: ImportStatus): string => {
  switch (status) {
    case 'idle':
      return '';
    case 'selecting_file':
      return 'Selecting file...';
    case 'reading_file':
      return 'Reading file...';
    case 'parsing':
      return 'Analyzing resume with AI...';
    case 'reviewing':
      return 'Review parsed data';
    case 'importing':
      return 'Creating resume...';
    case 'success':
      return 'Import successful!';
    case 'error':
      return 'Import failed';
    default:
      return '';
  }
};
