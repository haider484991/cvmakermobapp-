/**
 * PDF Export Service
 * Generates and exports PDF resumes using Expo Print
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File, Directory } from 'expo-file-system';
import { Resume } from '@/types/resume';
import { ResumeTemplate } from '@/types/template';
import { generateResumeHTML } from './htmlGenerator';
import { useTemplateStore, TEMPLATES } from '@/stores/templateStore';

export type PaperSize = 'letter' | 'a4';

export interface PDFExportOptions {
  /**
   * Paper size for the PDF
   */
  paperSize?: PaperSize;

  /**
   * File name without extension
   */
  fileName?: string;

  /**
   * Whether to add watermark (for free tier)
   */
  addWatermark?: boolean;

  /**
   * Custom watermark text
   */
  watermarkText?: string;
}

export interface PDFExportResult {
  success: boolean;
  uri?: string;
  error?: string;
}

/**
 * Paper size dimensions in points (72 points = 1 inch)
 */
const PAPER_SIZES = {
  letter: { width: 612, height: 792 }, // 8.5 x 11 inches
  a4: { width: 595, height: 842 },     // 210 x 297 mm
};

/**
 * Get the default template if no template is provided
 */
function getDefaultTemplate(): ResumeTemplate {
  return TEMPLATES[0]; // ats-classic
}

/**
 * Add watermark to HTML
 */
function addWatermarkToHTML(html: string, watermarkText: string): string {
  const watermarkCSS = `
    .watermark {
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-size: 8pt;
      color: #999999;
      opacity: 0.7;
      z-index: 1000;
    }
  `;

  const watermarkHTML = `<div class="watermark">${watermarkText}</div>`;

  // Insert watermark CSS before closing </style> tag
  html = html.replace('</style>', `${watermarkCSS}</style>`);

  // Insert watermark HTML before closing </body> tag
  html = html.replace('</body>', `${watermarkHTML}</body>`);

  return html;
}

/**
 * Generate PDF from resume data
 */
export async function generatePDF(
  resume: Resume,
  template?: ResumeTemplate,
  options: PDFExportOptions = {}
): Promise<PDFExportResult> {
  try {
    const {
      paperSize = 'letter',
      fileName = `${resume.header.fullName?.replace(/\s+/g, '_') || 'Resume'}`,
      addWatermark = false,
      watermarkText = 'Created with FreeResume AI',
    } = options;

    console.log('[PDFExport] Starting PDF generation for:', resume.header.fullName);

    // Use provided template or get default
    const selectedTemplate = template || getDefaultTemplate();

    // Generate HTML
    let html = generateResumeHTML(resume, selectedTemplate);

    // Add watermark if needed (free tier)
    if (addWatermark) {
      html = addWatermarkToHTML(html, watermarkText);
    }

    // Get paper dimensions
    const dimensions = PAPER_SIZES[paperSize];

    console.log('[PDFExport] Generating PDF with dimensions:', dimensions);

    // Generate PDF using Expo Print
    const { uri } = await Print.printToFileAsync({
      html,
      width: dimensions.width,
      height: dimensions.height,
      base64: false,
    });

    console.log('[PDFExport] PDF generated at:', uri);

    return {
      success: true,
      uri,
    };
  } catch (error) {
    console.error('[PDFExport] Generate PDF error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
    };
  }
}

/**
 * Generate and share PDF
 */
export async function generateAndSharePDF(
  resume: Resume,
  template?: ResumeTemplate,
  options: PDFExportOptions = {}
): Promise<PDFExportResult> {
  try {
    // First generate the PDF
    const result = await generatePDF(resume, template, options);

    if (!result.success || !result.uri) {
      return result;
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      return {
        success: false,
        error: 'Sharing is not available on this device',
        uri: result.uri,
      };
    }

    // Share the PDF
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Resume',
      UTI: 'com.adobe.pdf', // iOS specific
    });

    return result;
  } catch (error) {
    console.error('[PDFExport] Share PDF error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to share PDF',
    };
  }
}

/**
 * Preview PDF in print dialog
 */
export async function previewPDF(
  resume: Resume,
  template?: ResumeTemplate,
  options: Omit<PDFExportOptions, 'fileName'> = {}
): Promise<PDFExportResult> {
  try {
    const {
      paperSize = 'letter',
      addWatermark = false,
      watermarkText = 'Created with FreeResume AI',
    } = options;

    // Use provided template or get default
    const selectedTemplate = template || getDefaultTemplate();

    // Generate HTML
    let html = generateResumeHTML(resume, selectedTemplate);

    // Add watermark if needed
    if (addWatermark) {
      html = addWatermarkToHTML(html, watermarkText);
    }

    // Get paper dimensions
    const dimensions = PAPER_SIZES[paperSize];

    // Open print preview
    await Print.printAsync({
      html,
      width: dimensions.width,
      height: dimensions.height,
    });

    return { success: true };
  } catch (error) {
    console.error('[PDFExport] Preview PDF error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to preview PDF',
    };
  }
}

/**
 * Get HTML preview (for in-app preview)
 */
export function getHTMLPreview(
  resume: Resume,
  template?: ResumeTemplate,
  addWatermark = false
): string {
  const selectedTemplate = template || getDefaultTemplate();
  let html = generateResumeHTML(resume, selectedTemplate);

  if (addWatermark) {
    html = addWatermarkToHTML(html, 'Created with FreeResume AI');
  }

  return html;
}

/**
 * Sanitize file name for safe storage
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

/**
 * Delete a generated PDF file
 */
export async function deletePDF(uri: string): Promise<boolean> {
  try {
    const file = new File(uri);
    if (file.exists) {
      await file.delete();
      return true;
    }
    return false;
  } catch (error) {
    console.error('[PDFExport] Delete PDF error:', error);
    return false;
  }
}

/**
 * Get all generated PDFs in the document directory
 */
export async function getGeneratedPDFs(): Promise<string[]> {
  try {
    const docDir = Paths.document;
    const contents = docDir.list();
    return contents
      .filter((item): item is File => item instanceof File && item.name.endsWith('.pdf'))
      .map(file => file.uri);
  } catch (error) {
    console.error('[PDFExport] Get PDFs error:', error);
    return [];
  }
}

export default {
  generatePDF,
  generateAndSharePDF,
  previewPDF,
  getHTMLPreview,
  deletePDF,
  getGeneratedPDFs,
};
