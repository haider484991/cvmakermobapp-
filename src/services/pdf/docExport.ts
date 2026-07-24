/**
 * Word (.doc) and plain-text (.txt) export.
 *
 * Every major competitor (Resume.io, Zety, Kickresume, Enhancv) ships Word
 * export — recruiting agencies routinely require an editable file — and plain
 * text is what you paste into Workday/Taleo application forms. This app was
 * PDF-only.
 *
 * Word: we emit an HTML document with Word's Office namespaces and a
 * `application/msword` MIME type. Word opens that natively as a fully editable
 * document, so we reuse the SAME html the PDF engine already produces and add
 * no dependencies. (A true .docx would need a zip/OOXML writer for no real
 * gain here — Word treats this as a first-class document.)
 *
 * Text: serialized straight from the Resume object, because a text dump of the
 * styled HTML reads terribly. Layout is the plain-text convention ATS forms
 * expect — uppercase section headings, one item per block.
 */

import { Paths, File, Directory } from 'expo-file-system';
import { Resume } from '@/types/resume';
import { ResumeTemplate } from '@/types/template';
import { generateResumeHTML } from './htmlGenerator';

/* ------------------------------------------------------------------ */
/* Word                                                               */
/* ------------------------------------------------------------------ */

/**
 * Wrap the resume HTML so Word opens it as an editable document with the
 * page size and margins we intend.
 */
export function buildWordHtml(resume: Resume, template?: ResumeTemplate, paperSize: 'letter' | 'a4' = 'letter'): string {
  const inner = generateResumeHTML(resume, template as ResumeTemplate, { paperSize });
  const page = paperSize === 'a4' ? { w: '21cm', h: '29.7cm' } : { w: '8.5in', h: '11in' };

  const body = inner
    // Strip the print-only @page rule; Word uses its own section properties,
    // and leaving both in makes Word add a stray blank first page.
    .replace(/@page\s*\{[^}]*\}/g, '')
    // Drop the base64 @font-face blocks. They're ~1.5MB of embedded Inter that
    // Word won't apply anyway (it resolves fonts from the system), so keeping
    // them turned a 30KB document into a 1.6MB one.
    .replace(/@font-face\s*\{[^}]*\}/g, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <meta name="ProgId" content="Word.Document"/>
  <meta name="Generator" content="FreeResume AI"/>
  <!--[if gte mso 9]><xml>
    <w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument>
  </xml><![endif]-->
  <style>
    @page WordSection1 { size: ${page.w} ${page.h}; margin: 0.6in 0.6in 0.6in 0.6in; }
    div.WordSection1 { page: WordSection1; }
  </style>
</head>
<body>
  <div class="WordSection1">${body}</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Plain text                                                         */
/* ------------------------------------------------------------------ */

function heading(title: string): string {
  return `\n${title.toUpperCase()}\n${'='.repeat(Math.max(title.length, 3))}\n`;
}

// endDate is `string | null` on WorkExperience and `string` on Education,
// so accept null too rather than casting at each call site.
function dateRange(start?: string | null, end?: string | null, current?: boolean): string {
  const s = (start || '').trim();
  const e = current ? 'Present' : (end || '').trim();
  if (!s && !e) return '';
  return `${s}${s && e ? ' - ' : ''}${e}`;
}

/** Serialize a resume to ATS-form-friendly plain text. */
export function buildPlainText(resume: Resume): string {
  const out: string[] = [];
  const h = resume.header;
  const c = h.contact ?? ({} as any);

  if (h.fullName) out.push(h.fullName);
  if (h.jobTitle) out.push(h.jobTitle);
  const contact = [c.email, c.phone, c.location, c.linkedin, c.website].filter(Boolean);
  if (contact.length) out.push(contact.join(' | '));

  // Respect the same hidden-section rule the PDF uses.
  const hidden = new Set(
    (resume.sections ?? []).filter((s) => s.isVisible === false).map((s) => s.type as string),
  );
  const show = (t: string) => !hidden.has(t);

  if (show('summary') && resume.summary?.trim()) {
    out.push(heading('Summary'), resume.summary.trim());
  }

  if (show('experience') && resume.experience?.length) {
    out.push(heading('Experience'));
    resume.experience.forEach((e) => {
      out.push(`${e.title}${e.company ? ` — ${e.company}` : ''}`);
      const meta = [e.location, dateRange(e.startDate, e.endDate, e.isCurrentRole)].filter(Boolean);
      if (meta.length) out.push(meta.join(' | '));
      (e.bullets ?? []).forEach((b) => out.push(`- ${b}`));
      if (!e.bullets?.length && e.description) out.push(e.description);
      out.push('');
    });
  }

  if (show('education') && resume.education?.length) {
    out.push(heading('Education'));
    resume.education.forEach((e) => {
      out.push(`${e.degree}${e.field ? ` in ${e.field}` : ''}`);
      const meta = [e.institution, e.location, dateRange(e.startDate, e.endDate)].filter(Boolean);
      if (meta.length) out.push(meta.join(' | '));
      if (e.gpa) out.push(`GPA: ${e.gpa}`);
      out.push('');
    });
  }

  if (show('skills') && resume.skills?.length) {
    out.push(heading('Skills'), resume.skills.map((s) => s.name).join(', '));
  }

  if (show('projects') && resume.projects?.length) {
    out.push(heading('Projects'));
    resume.projects.forEach((p) => {
      out.push(p.name + (p.link ? ` (${p.link})` : ''));
      if (p.technologies?.length) out.push(p.technologies.join(', '));
      if (p.description) out.push(p.description);
      out.push('');
    });
  }

  if (show('certifications') && resume.certifications?.length) {
    out.push(heading('Certifications'));
    resume.certifications.forEach((x) => {
      out.push([x.name, x.issuer, x.date].filter(Boolean).join(' | '));
    });
  }

  if (show('languages') && resume.languages?.length) {
    out.push(heading('Languages'));
    resume.languages.forEach((l) => out.push(`${l.name}${l.proficiency ? ` — ${l.proficiency}` : ''}`));
  }

  if (show('awards') && resume.awards?.length) {
    out.push(heading('Awards'));
    resume.awards.forEach((a) => {
      out.push([a.title, a.issuer, a.date].filter(Boolean).join(' | '));
      if (a.description) out.push(a.description);
    });
  }

  if (show('custom') && resume.customSections?.length) {
    resume.customSections.forEach((cs) => {
      if (!cs.title?.trim() && !cs.content?.trim()) return;
      out.push(heading(cs.title?.trim() || 'Additional'));
      (cs.content || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => out.push(`- ${l}`));
    });
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ------------------------------------------------------------------ */
/* File writing                                                       */
/* ------------------------------------------------------------------ */

/** Write text content to the app cache and return its file:// URI. */
export async function writeTextFile(fileName: string, contents: string): Promise<string> {
  const dir = new Directory(Paths.cache);
  const file = new File(dir, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  return file.uri;
}

export function sanitizeBaseName(resume: Resume): string {
  return (
    resume.header.fullName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Resume'
  );
}

/** Generate the Word document and return its local file URI. */
export async function generateWordFile(
  resume: Resume,
  template?: ResumeTemplate,
  paperSize: 'letter' | 'a4' = 'letter',
): Promise<string> {
  const html = buildWordHtml(resume, template, paperSize);
  return writeTextFile(`${sanitizeBaseName(resume)}_Resume.doc`, html);
}

/** Generate the plain-text resume and return its local file URI. */
export async function generateTextFile(resume: Resume): Promise<string> {
  return writeTextFile(`${sanitizeBaseName(resume)}_Resume.txt`, buildPlainText(resume));
}

/* ------------------------------------------------------------------ */
/* Cover letter                                                       */
/* ------------------------------------------------------------------ */

/**
 * Typeset a cover letter as a printable A4/Letter page.
 *
 * The cover-letter screen could only copy text to the clipboard or share a
 * raw string, even though a full HTML→PDF pipeline was already in the app —
 * so users had no way to attach a formatted letter to an application.
 */
export function buildCoverLetterHtml(
  letter: string,
  resume: Resume,
  paperSize: 'letter' | 'a4' = 'letter',
): string {
  const h = resume.header;
  const c = h.contact ?? ({} as any);
  const size = paperSize === 'a4' ? 'A4' : 'Letter';
  const contact = [c.email, c.phone, c.location, c.linkedin].filter(Boolean).join('  ·  ');
  const paragraphs = letter
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: ${size}; margin: 0.85in 0.9in; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #14202B; font-size: 11.5pt; line-height: 1.65; margin: 0; }
  .name { font-family: Arial, Helvetica, sans-serif; font-size: 20pt; font-weight: 700; letter-spacing: -0.4px; }
  .role { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #52606D; margin-top: 2px; }
  .contact { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #52606D; margin-top: 8px; }
  .rule { border-bottom: 1.5px solid #14202B; margin: 14px 0 22px; }
  p { margin: 0 0 12pt; }
</style></head>
<body>
  <div class="name">${escapeHtml(h.fullName || '')}</div>
  ${h.jobTitle ? `<div class="role">${escapeHtml(h.jobTitle)}</div>` : ''}
  ${contact ? `<div class="contact">${escapeHtml(contact)}</div>` : ''}
  <div class="rule"></div>
  ${paragraphs}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
