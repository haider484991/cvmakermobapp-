/**
 * PDF Export Hook
 * Provides convenient methods for PDF generation and export
 */

import { useState, useCallback } from 'react';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import {
  generatePDF,
  generateAndSharePDF,
  previewPDF,
  getHTMLPreview,
  PDFExportOptions,
  PDFExportResult,
  PaperSize,
} from '@/services/pdf';

export interface UsePDFExportOptions {
  /**
   * Whether user is on premium tier (affects watermark)
   */
  isPremium?: boolean;
}

export interface UsePDFExportReturn {
  /**
   * Whether PDF is currently being generated
   */
  isGenerating: boolean;

  /**
   * Current export progress message
   */
  progress: string;

  /**
   * Last error message
   */
  error: string | null;

  /**
   * URI of last generated PDF
   */
  lastGeneratedUri: string | null;

  /**
   * Generate PDF for a resume
   */
  exportPDF: (resumeId: string, options?: Partial<PDFExportOptions>) => Promise<PDFExportResult>;

  /**
   * Generate and share PDF
   */
  sharePDF: (resumeId: string, options?: Partial<PDFExportOptions>) => Promise<PDFExportResult>;

  /**
   * Preview PDF in print dialog
   */
  preview: (resumeId: string, options?: Omit<PDFExportOptions, 'fileName'>) => Promise<PDFExportResult>;

  /**
   * Get HTML preview for in-app display
   */
  getPreviewHTML: (resumeId: string) => string | null;

  /**
   * Clear any errors
   */
  clearError: () => void;
}

export function usePDFExport(options: UsePDFExportOptions = {}): UsePDFExportReturn {
  const { isPremium = false } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedUri, setLastGeneratedUri] = useState<string | null>(null);

  const { getResume } = useResumeStore();
  const { getTemplate, selectedTemplateId } = useTemplateStore();

  /**
   * Get the current template
   */
  const getCurrentTemplate = useCallback(() => {
    if (selectedTemplateId) {
      return getTemplate(selectedTemplateId);
    }
    return undefined;
  }, [getTemplate, selectedTemplateId]);

  /**
   * Export PDF for a resume
   */
  const exportPDF = useCallback(
    async (
      resumeId: string,
      exportOptions: Partial<PDFExportOptions> = {}
    ): Promise<PDFExportResult> => {
      setIsGenerating(true);
      setProgress('Preparing resume...');
      setError(null);

      try {
        const resume = getResume(resumeId);
        if (!resume) {
          const errorMsg = 'Resume not found';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        setProgress('Generating PDF...');

        const template = getCurrentTemplate();
        const result = await generatePDF(resume, template, {
          addWatermark: !isPremium,
          ...exportOptions,
        });

        if (result.success && result.uri) {
          setLastGeneratedUri(result.uri);
          setProgress('PDF generated successfully!');
        } else {
          setError(result.error || 'Failed to generate PDF');
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Export failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsGenerating(false);
      }
    },
    [getResume, getCurrentTemplate, isPremium]
  );

  /**
   * Generate and share PDF
   */
  const sharePDF = useCallback(
    async (
      resumeId: string,
      exportOptions: Partial<PDFExportOptions> = {}
    ): Promise<PDFExportResult> => {
      setIsGenerating(true);
      setProgress('Preparing resume...');
      setError(null);

      try {
        const resume = getResume(resumeId);
        if (!resume) {
          const errorMsg = 'Resume not found';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        setProgress('Generating PDF...');

        const template = getCurrentTemplate();
        const result = await generateAndSharePDF(resume, template, {
          addWatermark: !isPremium,
          ...exportOptions,
        });

        if (result.success) {
          setProgress('Sharing...');
          if (result.uri) {
            setLastGeneratedUri(result.uri);
          }
        } else {
          setError(result.error || 'Failed to share PDF');
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Share failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsGenerating(false);
      }
    },
    [getResume, getCurrentTemplate, isPremium]
  );

  /**
   * Preview PDF in print dialog
   */
  const preview = useCallback(
    async (
      resumeId: string,
      previewOptions: Omit<PDFExportOptions, 'fileName'> = {}
    ): Promise<PDFExportResult> => {
      setIsGenerating(true);
      setProgress('Opening preview...');
      setError(null);

      try {
        const resume = getResume(resumeId);
        if (!resume) {
          const errorMsg = 'Resume not found';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        const template = getCurrentTemplate();
        const result = await previewPDF(resume, template, {
          addWatermark: !isPremium,
          ...previewOptions,
        });

        if (!result.success) {
          setError(result.error || 'Failed to preview PDF');
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Preview failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsGenerating(false);
        setProgress('');
      }
    },
    [getResume, getCurrentTemplate, isPremium]
  );

  /**
   * Get HTML preview for in-app display
   */
  const getPreviewHTML = useCallback(
    (resumeId: string): string | null => {
      const resume = getResume(resumeId);
      if (!resume) return null;

      const template = getCurrentTemplate();
      return getHTMLPreview(resume, template, !isPremium);
    },
    [getResume, getCurrentTemplate, isPremium]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isGenerating,
    progress,
    error,
    lastGeneratedUri,
    exportPDF,
    sharePDF,
    preview,
    getPreviewHTML,
    clearError,
  };
}

export default usePDFExport;
