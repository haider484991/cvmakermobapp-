/**
 * HTML Generator for PDF Resume Templates
 *
 * As of v1.3 this is a thin wrapper around `premiumHtmlEngine`. The engine
 * unifies all templates (existing + new) behind a single token-driven
 * renderer with real layout primitives. The legacy per-template generators
 * below are no longer reachable through the public entry point, but are
 * kept for reference / quick rollback. Delete after a release confirms no
 * regressions.
 */

import {
  Resume,
  WorkExperience,
  Education,
  Skill,
  Project,
  Certification,
  Language,
  Award,
} from '@/types/resume';
import { ResumeTemplate, TemplateStyles } from '@/types/template';
import { generatePremiumHTML, type EnginePaperSize } from './premiumHtmlEngine';

export interface ResumeHTMLOptions {
  /** Paper size — MUST match the size used by Print.printToFileAsync so the
   *  CSS @page declaration aligns and content doesn't get clipped. */
  paperSize?: EnginePaperSize;
}

/**
 * Generate complete HTML document for PDF export.
 *
 * Always uses the premium engine. Wrapped in try/catch so a bug in the new
 * engine cannot brick the export flow — we fall back to the legacy classic
 * generator if anything throws.
 */
export function generateResumeHTML(
  resume: Resume,
  template: ResumeTemplate,
  options: ResumeHTMLOptions = {},
): string {
  try {
    // Pass the resume's chosen accent color so the exported PDF matches the
    // re-colored preview exactly.
    return generatePremiumHTML(resume, template, {
      paperSize: options.paperSize,
      accentColor: resume.accentColor,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn('[htmlGenerator] Premium engine failed, falling back to classic:', err);
    }
    return generateClassicHTML(resume, template);
  }
}

/**
 * Classic ATS Template - Clean, centered, maximum readability
 */
function generateClassicHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: ${colors.text};
      background: ${colors.background};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 40px 48px; }
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid ${colors.primary}; }
    .name { font-size: 28pt; font-weight: bold; color: ${colors.text}; margin-bottom: 4px; }
    .title { font-size: 14pt; color: ${colors.primary}; margin-bottom: 8px; }
    .contact { font-size: 10pt; color: ${colors.textLight}; }
    .contact span { margin: 0 8px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 12pt; font-weight: bold; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid ${colors.primary}; }
    .item { margin-bottom: 14px; }
    .item-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; }
    .item-subtitle { font-size: 10pt; color: ${colors.secondary}; font-style: italic; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.text}; line-height: 1.5; }
    .skills { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill { font-size: 9pt; padding: 4px 10px; background: ${colors.primary}15; color: ${colors.primary}; border-radius: 4px; }
    .summary { font-size: 10pt; line-height: 1.6; color: ${colors.text}; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
      <div class="contact">
        ${resume.header.contact.email ? `<span>${escapeHtml(resume.header.contact.email)}</span>` : ''}
        ${resume.header.contact.phone ? `<span>•</span><span>${escapeHtml(resume.header.contact.phone)}</span>` : ''}
        ${resume.header.contact.location ? `<span>•</span><span>${escapeHtml(resume.header.contact.location)}</span>` : ''}
      </div>
    </header>

    ${resume.summary ? `
    <section class="section">
      <h2 class="section-title">Professional Summary</h2>
      <p class="summary">${escapeHtml(resume.summary)}</p>
    </section>
    ` : ''}

    ${resume.experience.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Work Experience</h2>
      ${resume.experience.map(exp => `
        <div class="item">
          <div class="item-header">
            <span class="item-title">${escapeHtml(exp.title)}</span>
            <span class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</span>
          </div>
          <div class="item-subtitle">${escapeHtml(exp.company)}${exp.location ? ` • ${escapeHtml(exp.location)}` : ''}</div>
          ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.education.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Education</h2>
      ${resume.education.map(edu => `
        <div class="item">
          <div class="item-header">
            <span class="item-title">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</span>
            <span class="item-date">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</span>
          </div>
          <div class="item-subtitle">${escapeHtml(edu.institution)}</div>
          ${edu.gpa ? `<div class="item-desc">GPA: ${escapeHtml(edu.gpa)}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.skills.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Skills</h2>
      <div class="skills">
        ${resume.skills.map(skill => `<span class="skill">${escapeHtml(skill.name)}</span>`).join('')}
      </div>
    </section>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Banner Template - Full-width colored header
 */
function generateBannerHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { background: ${colors.primary}; padding: 32px 48px; margin-bottom: 24px; }
    .name { font-size: 28pt; font-weight: bold; color: white; margin-bottom: 4px; }
    .title { font-size: 14pt; color: rgba(255,255,255,0.9); margin-bottom: 12px; }
    .contact { display: flex; gap: 20px; flex-wrap: wrap; }
    .contact span { font-size: 10pt; color: rgba(255,255,255,0.85); }
    .content { padding: 0 48px 40px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14pt; font-weight: bold; color: ${colors.primary}; margin-bottom: 12px; text-transform: uppercase; }
    .item { margin-bottom: 16px; padding-left: 12px; border-left: 3px solid ${colors.primary}; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-meta { font-size: 10pt; color: ${colors.secondary}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.textLight}; line-height: 1.5; }
    .skills { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill { font-size: 9pt; padding: 6px 14px; background: ${colors.primary}20; color: ${colors.primary}; border-radius: 20px; }
  </style>
</head>
<body>
  <header class="header">
    <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
    ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
    <div class="contact">
      ${resume.header.contact.email ? `<span>✉ ${escapeHtml(resume.header.contact.email)}</span>` : ''}
      ${resume.header.contact.phone ? `<span>☎ ${escapeHtml(resume.header.contact.phone)}</span>` : ''}
      ${resume.header.contact.location ? `<span>⚲ ${escapeHtml(resume.header.contact.location)}</span>` : ''}
    </div>
  </header>

  <div class="content">
    ${resume.summary ? `
    <section class="section">
      <h2 class="section-title">Professional Summary</h2>
      <p style="line-height: 1.6;">${escapeHtml(resume.summary)}</p>
    </section>
    ` : ''}

    ${resume.experience.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Experience</h2>
      ${resume.experience.map(exp => `
        <div class="item">
          <div class="item-title">${escapeHtml(exp.title)}</div>
          <div class="item-meta">${escapeHtml(exp.company)} • ${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</div>
          ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.education.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Education</h2>
      ${resume.education.map(edu => `
        <div class="item">
          <div class="item-title">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</div>
          <div class="item-meta">${escapeHtml(edu.institution)} • ${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</div>
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.skills.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Skills</h2>
      <div class="skills">
        ${resume.skills.map(skill => `<span class="skill">${escapeHtml(skill.name)}</span>`).join('')}
      </div>
    </section>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sidebar Template - Two column with colored sidebar
 */
function generateSidebarHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;
  const initials = (resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: ${colors.text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { display: flex; min-height: 11in; }
    .sidebar { width: 240px; background: ${colors.primary}; padding: 32px 20px; color: white; }
    .avatar { width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.2); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 36pt; font-weight: bold; }
    .sidebar-name { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 4px; }
    .sidebar-title { font-size: 11pt; text-align: center; color: rgba(255,255,255,0.8); margin-bottom: 24px; }
    .sidebar-section { margin-bottom: 24px; }
    .sidebar-section-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
    .sidebar-item { font-size: 10pt; margin-bottom: 6px; color: white; }
    .sidebar-skill { display: flex; align-items: center; margin-bottom: 8px; }
    .sidebar-skill::before { content: '•'; margin-right: 8px; color: rgba(255,255,255,0.6); }
    .main { flex: 1; padding: 32px; background: ${colors.background}; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 12pt; font-weight: bold; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .item { margin-bottom: 16px; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-company { font-size: 10pt; color: ${colors.primary}; margin-bottom: 2px; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.textLight}; line-height: 1.5; }
    .summary { font-size: 10pt; line-height: 1.6; color: ${colors.text}; }
  </style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <div class="avatar">${initials}</div>
      <div class="sidebar-name">${escapeHtml(resume.header.fullName || 'Your Name')}</div>
      <div class="sidebar-title">${escapeHtml(resume.header.jobTitle || '')}</div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">Contact</div>
        ${resume.header.contact.email ? `<div class="sidebar-item">${escapeHtml(resume.header.contact.email)}</div>` : ''}
        ${resume.header.contact.phone ? `<div class="sidebar-item">${escapeHtml(resume.header.contact.phone)}</div>` : ''}
        ${resume.header.contact.location ? `<div class="sidebar-item">${escapeHtml(resume.header.contact.location)}</div>` : ''}
      </div>

      ${resume.skills.length > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Skills</div>
        ${resume.skills.map(skill => `<div class="sidebar-skill">${escapeHtml(skill.name)}</div>`).join('')}
      </div>
      ` : ''}

      ${resume.education.length > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Education</div>
        ${resume.education.map(edu => `
          <div style="margin-bottom: 12px;">
            <div style="font-weight: 600; font-size: 10pt;">${escapeHtml(edu.degree)}</div>
            <div style="font-size: 9pt; color: rgba(255,255,255,0.8);">${escapeHtml(edu.institution)}</div>
            <div style="font-size: 9pt; color: rgba(255,255,255,0.6);">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </aside>

    <main class="main">
      ${resume.summary ? `
      <section class="section">
        <h2 class="section-title">About Me</h2>
        <p class="summary">${escapeHtml(resume.summary)}</p>
      </section>
      ` : ''}

      ${resume.experience.length > 0 ? `
      <section class="section">
        <h2 class="section-title">Experience</h2>
        ${resume.experience.map(exp => `
          <div class="item">
            <div class="item-title">${escapeHtml(exp.title)}</div>
            <div class="item-company">${escapeHtml(exp.company)}</div>
            <div class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}${exp.location ? ` | ${escapeHtml(exp.location)}` : ''}</div>
            ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
          </div>
        `).join('')}
      </section>
      ` : ''}
    </main>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Modern Template - Clean with accent line
 */
function generateModernHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 40px; }
    .header { display: flex; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid ${colors.border}; }
    .accent-line { width: 4px; background: ${colors.primary}; border-radius: 2px; margin-right: 16px; }
    .name { font-size: 28pt; font-weight: bold; color: ${colors.text}; margin-bottom: 4px; }
    .title { font-size: 14pt; color: ${colors.primary}; margin-bottom: 8px; }
    .contact { display: flex; gap: 16px; flex-wrap: wrap; font-size: 10pt; color: ${colors.textLight}; }
    .two-col { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11pt; font-weight: 600; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .item { margin-bottom: 16px; }
    .item-header { display: flex; justify-content: space-between; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; }
    .item-subtitle { font-size: 10pt; color: ${colors.primary}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.textLight}; line-height: 1.5; }
    .sidebar { border-left: 1px solid ${colors.border}; padding-left: 24px; }
    .skill-item { display: flex; align-items: center; margin-bottom: 8px; }
    .skill-dot { width: 8px; height: 8px; border-radius: 50%; background: ${colors.primary}; margin-right: 10px; }
    .skill-name { font-size: 10pt; color: ${colors.text}; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="accent-line"></div>
      <div>
        <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
        <div class="contact">
          ${resume.header.contact.email ? `<span>${escapeHtml(resume.header.contact.email)}</span>` : ''}
          ${resume.header.contact.phone ? `<span>${escapeHtml(resume.header.contact.phone)}</span>` : ''}
          ${resume.header.contact.location ? `<span>${escapeHtml(resume.header.contact.location)}</span>` : ''}
        </div>
      </div>
    </header>

    <div class="two-col">
      <div class="main">
        ${resume.summary ? `
        <section class="section">
          <h2 class="section-title">Profile</h2>
          <p style="line-height: 1.6;">${escapeHtml(resume.summary)}</p>
        </section>
        ` : ''}

        ${resume.experience.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Experience</h2>
          ${resume.experience.map(exp => `
            <div class="item">
              <div class="item-header">
                <span class="item-title">${escapeHtml(exp.title)}</span>
                <span class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</span>
              </div>
              <div class="item-subtitle">${escapeHtml(exp.company)}</div>
              ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
            </div>
          `).join('')}
        </section>
        ` : ''}
      </div>

      <div class="sidebar">
        ${resume.skills.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Skills</h2>
          ${resume.skills.map(skill => `
            <div class="skill-item">
              <div class="skill-dot"></div>
              <span class="skill-name">${escapeHtml(skill.name)}</span>
            </div>
          `).join('')}
        </section>
        ` : ''}

        ${resume.education.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Education</h2>
          ${resume.education.map(edu => `
            <div class="item">
              <div style="font-weight: 600; font-size: 10pt;">${escapeHtml(edu.degree)}</div>
              <div style="font-size: 9pt; color: ${colors.secondary};">${escapeHtml(edu.institution)}</div>
              <div style="font-size: 9pt; color: ${colors.textLight};">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</div>
            </div>
          `).join('')}
        </section>
        ` : ''}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Minimal Template - Ultra clean
 */
function generateMinimalHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 48px 56px; }
    .header { margin-bottom: 32px; }
    .name { font-size: 32pt; font-weight: bold; color: ${colors.text}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .title { font-size: 12pt; color: ${colors.textLight}; letter-spacing: 1px; margin-bottom: 12px; }
    .contact { display: flex; gap: 20px; font-size: 10pt; color: ${colors.textLight}; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11pt; font-weight: 600; color: ${colors.primary}; letter-spacing: 1px; margin-bottom: 8px; }
    .divider { height: 1px; background: ${colors.border}; margin-bottom: 12px; }
    .item { margin-bottom: 16px; }
    .item-title { font-weight: 500; font-size: 11pt; color: ${colors.text}; }
    .item-meta { font-size: 10pt; color: ${colors.textLight}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.text}; line-height: 1.6; }
    .skills-text { font-size: 10pt; color: ${colors.text}; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
      <div class="contact">
        ${resume.header.contact.email ? `<span>${escapeHtml(resume.header.contact.email)}</span>` : ''}
        ${resume.header.contact.phone ? `<span>${escapeHtml(resume.header.contact.phone)}</span>` : ''}
        ${resume.header.contact.location ? `<span>${escapeHtml(resume.header.contact.location)}</span>` : ''}
      </div>
    </header>

    ${resume.summary ? `
    <section class="section">
      <h2 class="section-title">PROFILE</h2>
      <div class="divider"></div>
      <p class="item-desc">${escapeHtml(resume.summary)}</p>
    </section>
    ` : ''}

    ${resume.experience.length > 0 ? `
    <section class="section">
      <h2 class="section-title">EXPERIENCE</h2>
      <div class="divider"></div>
      ${resume.experience.map(exp => `
        <div class="item">
          <div class="item-title">${escapeHtml(exp.title)}</div>
          <div class="item-meta">${escapeHtml(exp.company)} — ${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</div>
          ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.education.length > 0 ? `
    <section class="section">
      <h2 class="section-title">EDUCATION</h2>
      <div class="divider"></div>
      ${resume.education.map(edu => `
        <div class="item">
          <div class="item-title">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</div>
          <div class="item-meta">${escapeHtml(edu.institution)} — ${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</div>
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.skills.length > 0 ? `
    <section class="section">
      <h2 class="section-title">SKILLS</h2>
      <div class="divider"></div>
      <p class="skills-text">${resume.skills.map(s => escapeHtml(s.name)).join(' • ')}</p>
    </section>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Executive Template - Formal and sophisticated
 */
function generateExecutiveHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Georgia, serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 40px 48px; }
    .header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid ${colors.primary}; }
    .name { font-size: 28pt; font-weight: bold; color: ${colors.text}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .title { font-size: 14pt; color: ${colors.primary}; letter-spacing: 1px; margin-bottom: 10px; }
    .contact { font-size: 10pt; color: ${colors.textLight}; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11pt; font-weight: bold; color: ${colors.primary}; letter-spacing: 2px; margin-bottom: 12px; }
    .item { margin-bottom: 16px; }
    .item-header { display: flex; justify-content: space-between; }
    .item-title { font-weight: bold; font-size: 11pt; color: ${colors.text}; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; font-style: italic; }
    .item-subtitle { font-size: 10pt; color: ${colors.secondary}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.text}; line-height: 1.6; }
    .summary { font-size: 10pt; line-height: 1.7; font-style: italic; color: ${colors.text}; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .skills { font-size: 10pt; color: ${colors.text}; }
    .skills span::before { content: '• '; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
      <div class="contact">
        ${resume.header.contact.location ? `${escapeHtml(resume.header.contact.location)}` : ''}
        ${resume.header.contact.email ? ` • ${escapeHtml(resume.header.contact.email)}` : ''}
        ${resume.header.contact.phone ? ` • ${escapeHtml(resume.header.contact.phone)}` : ''}
      </div>
    </header>

    ${resume.summary ? `
    <section class="section">
      <h2 class="section-title">EXECUTIVE SUMMARY</h2>
      <p class="summary">${escapeHtml(resume.summary)}</p>
    </section>
    ` : ''}

    ${resume.experience.length > 0 ? `
    <section class="section">
      <h2 class="section-title">PROFESSIONAL EXPERIENCE</h2>
      ${resume.experience.map(exp => `
        <div class="item">
          <div class="item-header">
            <span class="item-title">${escapeHtml(exp.title)}</span>
            <span class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</span>
          </div>
          <div class="item-subtitle">${escapeHtml(exp.company)}${exp.location ? `, ${escapeHtml(exp.location)}` : ''}</div>
          ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
        </div>
      `).join('')}
    </section>
    ` : ''}

    <div class="two-col">
      ${resume.education.length > 0 ? `
      <section class="section">
        <h2 class="section-title">EDUCATION</h2>
        ${resume.education.map(edu => `
          <div class="item">
            <div style="font-weight: 600;">${escapeHtml(edu.degree)}${edu.field ? `, ${escapeHtml(edu.field)}` : ''}</div>
            <div style="color: ${colors.textLight}; font-size: 9pt;">${escapeHtml(edu.institution)}</div>
          </div>
        `).join('')}
      </section>
      ` : ''}

      ${resume.skills.length > 0 ? `
      <section class="section">
        <h2 class="section-title">CORE COMPETENCIES</h2>
        <div class="skills">
          ${resume.skills.map(skill => `<span>${escapeHtml(skill.name)}</span>`).join(' ')}
        </div>
      </section>
      ` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Creative Template - Bold and artistic
 */
function generateCreativeHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { background: ${colors.primary}; padding: 32px 48px 40px; border-bottom-left-radius: 50px; }
    .name { font-size: 28pt; font-weight: bold; color: white; margin-bottom: 4px; }
    .title { font-size: 13pt; color: rgba(255,255,255,0.85); margin-bottom: 16px; }
    .contact-tags { display: flex; gap: 10px; flex-wrap: wrap; }
    .contact-tag { font-size: 9pt; padding: 6px 14px; background: rgba(255,255,255,0.2); border-radius: 20px; color: white; }
    .content { padding: 28px 48px 40px; }
    .skills-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
    .skill-pill { font-size: 10pt; padding: 8px 16px; background: ${colors.primary}; color: white; border-radius: 25px; font-weight: 600; }
    .summary-box { padding: 20px; background: ${colors.primary}10; border-radius: 16px; margin-bottom: 24px; }
    .summary-title { font-weight: bold; color: ${colors.primary}; margin-bottom: 8px; font-size: 12pt; }
    .summary-text { line-height: 1.6; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14pt; font-weight: bold; color: ${colors.primary}; margin-bottom: 16px; }
    .timeline-item { display: flex; margin-bottom: 20px; }
    .timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: ${colors.primary}; margin-right: 16px; margin-top: 4px; flex-shrink: 0; }
    .timeline-line { width: 2px; background: ${colors.primary}30; margin-left: 5px; margin-top: 4px; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-company { font-size: 10pt; color: ${colors.primary}; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.textLight}; line-height: 1.5; }
    .edu-box { padding: 16px; background: ${colors.background}; border: 2px solid ${colors.primary}30; border-radius: 12px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <header class="header">
    <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
    ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
    <div class="contact-tags">
      ${resume.header.contact.email ? `<span class="contact-tag">${escapeHtml(resume.header.contact.email)}</span>` : ''}
      ${resume.header.contact.phone ? `<span class="contact-tag">${escapeHtml(resume.header.contact.phone)}</span>` : ''}
      ${resume.header.contact.location ? `<span class="contact-tag">${escapeHtml(resume.header.contact.location)}</span>` : ''}
    </div>
  </header>

  <div class="content">
    ${resume.skills.length > 0 ? `
    <div class="skills-row">
      ${resume.skills.map(skill => `<span class="skill-pill">${escapeHtml(skill.name)}</span>`).join('')}
    </div>
    ` : ''}

    ${resume.summary ? `
    <div class="summary-box">
      <div class="summary-title">About Me</div>
      <p class="summary-text">${escapeHtml(resume.summary)}</p>
    </div>
    ` : ''}

    ${resume.experience.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Experience</h2>
      ${resume.experience.map((exp, i) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div style="flex: 1;">
            <div class="item-title">${escapeHtml(exp.title)}</div>
            <div class="item-company">${escapeHtml(exp.company)}</div>
            <div class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</div>
            ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </section>
    ` : ''}

    ${resume.education.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Education</h2>
      ${resume.education.map(edu => `
        <div class="edu-box">
          <div style="font-weight: 600; font-size: 11pt;">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ''}</div>
          <div style="color: ${colors.primary}; font-size: 10pt;">${escapeHtml(edu.institution)}</div>
          <div style="color: ${colors.textLight}; font-size: 9pt;">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</div>
        </div>
      `).join('')}
    </section>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Timeline Template
 */
function generateTimelineHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;
  const initials = (resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 40px 48px; }
    .header { display: flex; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid ${colors.border}; }
    .avatar { width: 70px; height: 70px; border-radius: 12px; background: ${colors.primary}; display: flex; align-items: center; justify-content: center; margin-right: 20px; }
    .avatar-text { font-size: 24pt; color: white; font-weight: bold; }
    .name { font-size: 24pt; font-weight: bold; color: ${colors.text}; margin-bottom: 2px; }
    .title { font-size: 13pt; color: ${colors.primary}; margin-bottom: 6px; }
    .contact { display: flex; gap: 12px; font-size: 10pt; color: ${colors.textLight}; }
    .summary { margin-bottom: 24px; line-height: 1.6; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 12pt; font-weight: bold; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .timeline { display: flex; }
    .timeline-bar { width: 3px; background: ${colors.primary}; border-radius: 2px; margin-right: 20px; }
    .timeline-content { flex: 1; }
    .timeline-item { margin-bottom: 20px; position: relative; }
    .timeline-item::before { content: ''; position: absolute; left: -26px; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: ${colors.primary}; border: 3px solid ${colors.background}; }
    .item-date { font-size: 10pt; color: ${colors.primary}; font-weight: 600; margin-bottom: 2px; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-subtitle { font-size: 10pt; color: ${colors.secondary}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.textLight}; line-height: 1.5; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .skills { display: flex; flex-wrap: wrap; gap: 8px; }
    .skill { font-size: 9pt; padding: 5px 12px; background: ${colors.primary}15; color: ${colors.primary}; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="avatar"><span class="avatar-text">${initials}</span></div>
      <div>
        <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
        <div class="contact">
          ${resume.header.contact.email ? `<span>${escapeHtml(resume.header.contact.email)}</span>` : ''}
          ${resume.header.contact.phone ? `<span>${escapeHtml(resume.header.contact.phone)}</span>` : ''}
        </div>
      </div>
    </header>

    ${resume.summary ? `<p class="summary">${escapeHtml(resume.summary)}</p>` : ''}

    ${resume.experience.length > 0 ? `
    <section class="section">
      <h2 class="section-title">Career Timeline</h2>
      <div class="timeline">
        <div class="timeline-bar"></div>
        <div class="timeline-content">
          ${resume.experience.map(exp => `
            <div class="timeline-item">
              <div class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</div>
              <div class="item-title">${escapeHtml(exp.title)}</div>
              <div class="item-subtitle">${escapeHtml(exp.company)}</div>
              ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <div class="two-col">
      ${resume.skills.length > 0 ? `
      <section class="section">
        <h2 class="section-title">Skills</h2>
        <div class="skills">
          ${resume.skills.map(skill => `<span class="skill">${escapeHtml(skill.name)}</span>`).join('')}
        </div>
      </section>
      ` : ''}

      ${resume.education.length > 0 ? `
      <section class="section">
        <h2 class="section-title">Education</h2>
        ${resume.education.map(edu => `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: 600;">${escapeHtml(edu.degree)}</div>
            <div style="color: ${colors.textLight}; font-size: 9pt;">${escapeHtml(edu.institution)}</div>
          </div>
        `).join('')}
      </section>
      ` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Two Column Template
 */
function generateTwoColumnHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;
  const initials = (resume.header.fullName || 'JD').split(' ').map(n => n[0]).join('').slice(0, 2);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: ${colors.text}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { display: flex; min-height: 11in; }
    .sidebar { width: 260px; background: ${colors.primary}08; padding: 32px 20px; }
    .avatar { width: 120px; height: 120px; border-radius: 60px; background: ${colors.primary}; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
    .avatar-text { font-size: 40pt; color: white; font-weight: bold; }
    .sidebar-section { margin-bottom: 24px; }
    .sidebar-title { font-size: 11pt; font-weight: bold; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .sidebar-item { font-size: 10pt; color: ${colors.text}; margin-bottom: 8px; }
    .skill-bar { margin-bottom: 12px; }
    .skill-name { font-size: 10pt; color: ${colors.text}; margin-bottom: 4px; }
    .skill-progress { height: 4px; background: ${colors.border}; border-radius: 2px; }
    .skill-fill { height: 4px; background: ${colors.primary}; border-radius: 2px; width: 85%; }
    .main { flex: 1; padding: 32px; background: ${colors.background}; }
    .header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid ${colors.border}; }
    .name { font-size: 26pt; font-weight: bold; color: ${colors.text}; margin-bottom: 4px; }
    .title { font-size: 13pt; color: ${colors.primary}; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11pt; font-weight: bold; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .item { margin-bottom: 16px; }
    .item-header { display: flex; justify-content: space-between; }
    .item-title { font-weight: 600; font-size: 11pt; color: ${colors.text}; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; }
    .item-subtitle { font-size: 10pt; color: ${colors.primary}; margin-bottom: 4px; }
    .item-desc { font-size: 10pt; color: ${colors.textLight}; line-height: 1.5; }
    .edu-item { margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <div class="avatar"><span class="avatar-text">${initials}</span></div>

      <div class="sidebar-section">
        <div class="sidebar-title">Contact</div>
        ${resume.header.contact.email ? `<div class="sidebar-item">${escapeHtml(resume.header.contact.email)}</div>` : ''}
        ${resume.header.contact.phone ? `<div class="sidebar-item">${escapeHtml(resume.header.contact.phone)}</div>` : ''}
        ${resume.header.contact.location ? `<div class="sidebar-item">${escapeHtml(resume.header.contact.location)}</div>` : ''}
      </div>

      ${resume.skills.length > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-title">Skills</div>
        ${resume.skills.map(skill => `
          <div class="skill-bar">
            <div class="skill-name">${escapeHtml(skill.name)}</div>
            <div class="skill-progress"><div class="skill-fill"></div></div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${resume.education.length > 0 ? `
      <div class="sidebar-section">
        <div class="sidebar-title">Education</div>
        ${resume.education.map(edu => `
          <div class="edu-item">
            <div style="font-weight: 600; font-size: 10pt;">${escapeHtml(edu.degree)}</div>
            <div style="font-size: 9pt; color: ${colors.textLight};">${escapeHtml(edu.institution)}</div>
            <div style="font-size: 9pt; color: ${colors.textLight};">${escapeHtml(edu.startDate)} - ${escapeHtml(edu.endDate)}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </aside>

    <main class="main">
      <header class="header">
        <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
      </header>

      ${resume.summary ? `
      <section class="section">
        <h2 class="section-title">About Me</h2>
        <p style="line-height: 1.6;">${escapeHtml(resume.summary)}</p>
      </section>
      ` : ''}

      ${resume.experience.length > 0 ? `
      <section class="section">
        <h2 class="section-title">Experience</h2>
        ${resume.experience.map(exp => `
          <div class="item">
            <div class="item-header">
              <span class="item-title">${escapeHtml(exp.title)}</span>
              <span class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</span>
            </div>
            <div class="item-subtitle">${escapeHtml(exp.company)}</div>
            ${exp.description ? `<div class="item-desc">${escapeHtml(exp.description)}</div>` : ''}
          </div>
        `).join('')}
      </section>
      ` : ''}
    </main>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Compact Template
 */
function generateCompactHTML(resume: Resume, template: ResumeTemplate): string {
  const { colors } = template.styles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.header.fullName || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: Letter; margin: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: ${colors.text}; background: ${colors.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { max-width: 8.5in; min-height: 11in; margin: 0 auto; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${colors.border}; }
    .name { font-size: 22pt; font-weight: bold; color: ${colors.text}; margin-bottom: 2px; }
    .title { font-size: 12pt; color: ${colors.primary}; }
    .contact { text-align: right; font-size: 10pt; color: ${colors.textLight}; }
    .contact div { margin-bottom: 2px; }
    .summary { margin-bottom: 16px; font-size: 10pt; line-height: 1.5; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .section { margin-bottom: 16px; }
    .section-title { font-size: 10pt; font-weight: bold; color: ${colors.primary}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .item { margin-bottom: 10px; }
    .item-title { font-weight: 600; font-size: 10pt; color: ${colors.text}; }
    .item-subtitle { font-size: 9pt; color: ${colors.secondary}; }
    .item-date { font-size: 9pt; color: ${colors.textLight}; }
    .skills { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill { font-size: 9pt; padding: 4px 10px; background: ${colors.primary}12; color: ${colors.primary}; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div>
        <h1 class="name">${escapeHtml(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="title">${escapeHtml(resume.header.jobTitle)}</div>` : ''}
      </div>
      <div class="contact">
        ${resume.header.contact.email ? `<div>${escapeHtml(resume.header.contact.email)}</div>` : ''}
        ${resume.header.contact.phone ? `<div>${escapeHtml(resume.header.contact.phone)}</div>` : ''}
        ${resume.header.contact.location ? `<div>${escapeHtml(resume.header.contact.location)}</div>` : ''}
      </div>
    </header>

    ${resume.summary ? `<p class="summary">${escapeHtml(resume.summary)}</p>` : ''}

    <div class="two-col">
      <div>
        ${resume.experience.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Experience</h2>
          ${resume.experience.map(exp => `
            <div class="item">
              <div class="item-title">${escapeHtml(exp.title)}</div>
              <div class="item-subtitle">${escapeHtml(exp.company)}</div>
              <div class="item-date">${escapeHtml(exp.startDate)} - ${exp.endDate || 'Present'}</div>
            </div>
          `).join('')}
        </section>
        ` : ''}

        ${resume.education.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Education</h2>
          ${resume.education.map(edu => `
            <div class="item">
              <div class="item-title">${escapeHtml(edu.degree)}</div>
              <div class="item-subtitle">${escapeHtml(edu.institution)}</div>
            </div>
          `).join('')}
        </section>
        ` : ''}
      </div>

      <div>
        ${resume.skills.length > 0 ? `
        <section class="section">
          <h2 class="section-title">Skills</h2>
          <div class="skills">
            ${resume.skills.map(skill => `<span class="skill">${escapeHtml(skill.name)}</span>`).join('')}
          </div>
        </section>
        ` : ''}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default generateResumeHTML;
