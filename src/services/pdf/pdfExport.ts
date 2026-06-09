/**
 * PDF Export Service
 * Generates and exports PDF resumes using Expo Print
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File, Directory } from 'expo-file-system';
// Legacy FS gives us the Storage Access Framework, which is the only way to
// write a file to a user-visible folder (Downloads, Documents) on modern
// Android without the restricted MANAGE_EXTERNAL_STORAGE permission.
import {
  StorageAccessFramework,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, ToastAndroid } from 'react-native';
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
  /** How the file left the app — 'saved' to a folder, or 'shared' via the sheet. */
  method?: 'saved' | 'shared';
  /** True when the user dismissed the save/share dialog. Not an error. */
  cancelled?: boolean;
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

    // Generate HTML — pass paperSize so the engine's @page declaration and
    // .rb-page container width match the PDF print size. Without this, A4
    // selections clip content because the HTML still sized itself for Letter.
    let html = generateResumeHTML(resume, selectedTemplate, { paperSize });

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

/** AsyncStorage key for the folder the user chose to save resumes into. */
const SAF_DIR_KEY = '@pdf/saf-download-dir-v1';

/**
 * Write an already-generated PDF into a user-visible folder via the Storage
 * Access Framework. The chosen folder is remembered, so only the FIRST save
 * shows a folder picker — every later save is silent.
 *
 * Returns 'saved' with the new file URI, or 'cancelled' if the user dismissed
 * the picker. Throws on a real write failure so the caller can fall back to
 * the share sheet.
 */
async function saveViaStorageAccessFramework(
  tempUri: string,
  baseName: string,
): Promise<{ status: 'saved'; uri: string } | { status: 'cancelled' }> {
  const base64 = await readAsStringAsync(tempUri, { encoding: EncodingType.Base64 });

  const writeInto = async (dirUri: string): Promise<string> => {
    // createFileAsync appends the extension from the mime type, so pass the
    // name WITHOUT ".pdf" to avoid producing "Name_Resume.pdf.pdf".
    const fileUri = await StorageAccessFramework.createFileAsync(dirUri, baseName, 'application/pdf');
    await writeAsStringAsync(fileUri, base64, { encoding: EncodingType.Base64 });
    return fileUri;
  };

  // 1) Reuse the remembered folder for a silent save.
  const cachedDir = await AsyncStorage.getItem(SAF_DIR_KEY).catch(() => null);
  if (cachedDir) {
    try {
      return { status: 'saved', uri: await writeInto(cachedDir) };
    } catch {
      // Permission revoked or folder gone — forget it and ask again below.
      await AsyncStorage.removeItem(SAF_DIR_KEY).catch(() => {});
    }
  }

  // 2) Ask the user to choose a folder (one time).
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted || !perm.directoryUri) {
    return { status: 'cancelled' };
  }
  await AsyncStorage.setItem(SAF_DIR_KEY, perm.directoryUri).catch(() => {});
  return { status: 'saved', uri: await writeInto(perm.directoryUri) };
}

/**
 * Save the resume PDF to the device.
 *
 * On Android this now performs a REAL save to a user-chosen folder (Downloads,
 * Documents, etc.) via the Storage Access Framework — previously it copied the
 * file into the app's private directory and opened a share sheet, so "Download"
 * confusingly looked like "Share" and the file was never findable.
 *
 * On iOS the share sheet IS the native "Save to Files" path, so we keep it.
 */
export async function downloadPDFToDevice(
  resume: Resume,
  template?: ResumeTemplate,
  options: PDFExportOptions = {}
): Promise<PDFExportResult> {
  try {
    // First generate the PDF.
    const result = await generatePDF(resume, template, options);
    if (!result.success || !result.uri) {
      return result;
    }

    const sanitizedName =
      resume.header.fullName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Resume';
    const baseName = `${sanitizedName}_Resume`;

    if (Platform.OS === 'android') {
      try {
        const saved = await saveViaStorageAccessFramework(result.uri, baseName);
        if (saved.status === 'saved') {
          ToastAndroid.show('Saved to your device ✓', ToastAndroid.LONG);
          return { success: true, uri: saved.uri, method: 'saved' };
        }
        // User backed out of the folder picker — a quiet no-op, not an error.
        return { success: false, cancelled: true };
      } catch (androidError) {
        // Real SAF failure (rare) — fall back to the share sheet so the user
        // can still get their file out via Drive/Gmail/etc.
        console.error('[PDFExport] SAF save failed, falling back to share:', androidError);
        const shared = await generateAndSharePDF(resume, template, options);
        return { ...shared, method: shared.success ? 'shared' : undefined };
      }
    }

    // iOS — share sheet doubles as "Save to Files".
    const shared = await generateAndSharePDF(resume, template, options);
    return { ...shared, method: shared.success ? 'shared' : undefined };
  } catch (error) {
    console.error('[PDFExport] Download PDF error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download PDF',
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
      dialogTitle: 'Save Resume',
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

    // Generate HTML — see comment in generatePDF() for why paperSize must be
    // propagated to the engine.
    let html = generateResumeHTML(resume, selectedTemplate, { paperSize });

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
  addWatermark = false,
  paperSize: PaperSize = 'letter',
): string {
  const selectedTemplate = template || getDefaultTemplate();
  let html = generateResumeHTML(resume, selectedTemplate, { paperSize });

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
