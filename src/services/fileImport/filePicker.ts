/**
 * File Picker Service
 * Handles document selection and file reading for resume import
 */

import * as DocumentPicker from 'expo-document-picker';
import {
  readAsStringAsync,
  EncodingType,
  getInfoAsync,
  deleteAsync,
} from 'expo-file-system/legacy';
import {
  SelectedFile,
  ImportFileType,
  MAX_FILE_SIZE,
  SUPPORTED_MIME_TYPES,
  getMimeTypeCategory,
} from '@/types/resumeImport';

/**
 * Error types for file operations
 */
export class FilePickerError extends Error {
  constructor(
    message: string,
    public code: 'CANCELLED' | 'TOO_LARGE' | 'WRONG_FORMAT' | 'READ_ERROR' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'FilePickerError';
  }
}

/**
 * Opens the document picker for selecting resume files
 * Supported formats: PDF, DOCX, PNG, JPG, JPEG, WEBP
 */
export async function pickResumeFile(): Promise<SelectedFile> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_MIME_TYPES as unknown as string[],
      copyToCacheDirectory: true,
      multiple: false,
    });

    // User cancelled the picker
    if (result.canceled) {
      throw new FilePickerError('File selection cancelled', 'CANCELLED');
    }

    const asset = result.assets[0];

    // Check if file was selected
    if (!asset || !asset.uri) {
      throw new FilePickerError('No file selected', 'CANCELLED');
    }

    // Validate file size
    if (asset.size && asset.size > MAX_FILE_SIZE) {
      throw new FilePickerError(
        `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        'TOO_LARGE'
      );
    }

    // Validate MIME type
    const mimeType = asset.mimeType || '';
    if (!SUPPORTED_MIME_TYPES.includes(mimeType as any)) {
      throw new FilePickerError(
        'Please select a PDF, DOCX, or image file (PNG, JPG, WEBP)',
        'WRONG_FORMAT'
      );
    }

    const fileType = getMimeTypeCategory(mimeType);

    return {
      uri: asset.uri,
      name: asset.name || 'resume',
      type: fileType,
      size: asset.size || 0,
      mimeType,
    };
  } catch (error) {
    if (error instanceof FilePickerError) {
      throw error;
    }

    throw new FilePickerError(
      error instanceof Error ? error.message : 'Failed to select file',
      'UNKNOWN'
    );
  }
}

/**
 * Reads file content as base64 string
 * All file types are read as base64 for AI processing
 */
export async function readFileAsBase64(file: SelectedFile): Promise<string> {
  try {
    const base64Content = await readAsStringAsync(file.uri, {
      encoding: EncodingType.Base64,
    });

    return base64Content;
  } catch (error) {
    throw new FilePickerError(
      error instanceof Error ? error.message : 'Failed to read file',
      'READ_ERROR'
    );
  }
}

/**
 * Creates a data URL from base64 content and mime type
 * Required for sending images to vision-capable AI models
 */
export function createDataUrl(base64Content: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64Content}`;
}

/**
 * Removes temporary file from cache after import
 */
export async function cleanupTempFile(uri: string): Promise<void> {
  try {
    const fileInfo = await getInfoAsync(uri);
    if (fileInfo.exists) {
      await deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    // Silently fail cleanup - not critical
    console.warn('[FilePicker] Failed to cleanup temp file:', error);
  }
}

/**
 * Gets human-readable file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Gets display name for file type
 */
export function getFileTypeDisplayName(type: ImportFileType): string {
  switch (type) {
    case 'pdf':
      return 'PDF Document';
    case 'docx':
      return 'Word Document';
    case 'image':
      return 'Image';
    default:
      return 'Document';
  }
}
