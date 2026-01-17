/**
 * Resume Import Types
 * Types for the AI-powered resume import feature
 */

import type {
  ResumeHeader,
  WorkExperience,
  Education,
  Skill,
  Project,
  Certification,
  Language,
  Award,
} from './resume';

/**
 * Supported file types for import
 */
export type ImportFileType = 'pdf' | 'docx' | 'image';

/**
 * Import status states
 */
export type ImportStatus =
  | 'idle'
  | 'selecting_file'
  | 'reading_file'
  | 'parsing'
  | 'reviewing'
  | 'importing'
  | 'success'
  | 'error';

/**
 * Selected file information
 */
export interface SelectedFile {
  uri: string;
  name: string;
  type: ImportFileType;
  size: number;
  mimeType: string;
}

/**
 * Parsed resume data structure matching the Resume interface
 */
export interface ParsedResumeData {
  header: {
    fullName: string;
    jobTitle: string;
    contact: {
      email: string;
      phone: string;
      location: string;
      linkedin?: string;
      website?: string;
      github?: string;
    };
  };
  summary: string;
  experience: Array<{
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string | null;
    isCurrentRole: boolean;
    description: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    location: string;
    startDate: string;
    endDate: string;
    gpa?: string;
    achievements?: string[];
  }>;
  skills: Array<{
    name: string;
    level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    category?: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    link?: string;
    startDate?: string;
    endDate?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
    expiryDate?: string;
    credentialId?: string;
    link?: string;
  }>;
  languages: Array<{
    name: string;
    proficiency: 'basic' | 'conversational' | 'professional' | 'native';
  }>;
  awards: Array<{
    title: string;
    issuer: string;
    date: string;
    description?: string;
  }>;
}

/**
 * Result from AI resume parsing
 */
export interface ResumeParseResult {
  success: boolean;
  data: ParsedResumeData | null;
  confidence: number;
  warnings: string[];
  error?: string;
}

/**
 * Import statistics for review modal
 */
export interface ImportStats {
  totalSections: number;
  header: boolean;
  summary: boolean;
  experienceCount: number;
  educationCount: number;
  skillsCount: number;
  projectsCount: number;
  certificationsCount: number;
  languagesCount: number;
  awardsCount: number;
}

/**
 * Import store state
 */
export interface ResumeImportState {
  status: ImportStatus;
  selectedFile: SelectedFile | null;
  parsedData: ParsedResumeData | null;
  confidence: number;
  warnings: string[];
  error: string | null;
}

/**
 * Import store actions
 */
export interface ResumeImportActions {
  setStatus: (status: ImportStatus) => void;
  setSelectedFile: (file: SelectedFile | null) => void;
  setParsedData: (data: ParsedResumeData | null) => void;
  setConfidence: (confidence: number) => void;
  setWarnings: (warnings: string[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * File size limit in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Supported MIME types for import
 */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

/**
 * Map MIME type to file type
 */
export function getMimeTypeCategory(mimeType: string): ImportFileType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (mimeType.startsWith('image/')) return 'image';
  return 'pdf'; // Default fallback
}
