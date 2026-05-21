/**
 * Premium HTML Resume Engine
 * --------------------------
 *
 * One unified renderer powering all templates. Key design choices:
 *
 *   1. **Layout primitive** (`layout.id`) decides STRUCTURE. There are six
 *      and only six — anything more is just color/typography variation.
 *
 *   2. **Theme tokens** drive every visual property. Colors, font pairing,
 *      accent shape, density: all data, not code. New "templates" are just
 *      new token sets pointing at one of the six layouts.
 *
 *   3. **Section primitives** (header, summary, experience, education,
 *      skills, projects, certifications, languages, awards) are shared
 *      across layouts. A template gets all of them for free.
 *
 *   4. **Premium typography**: real type scale, hairline rules, letter
 *      spacing on caps, italic dates, monospace numbers where appropriate.
 *      None of the "Word document" feel of the old generators.
 *
 *   5. **ATS-safe**: pure HTML/CSS; no SVG, canvas, or web fonts that need
 *      network requests at PDF render time. Single-column layouts stay
 *      parser-friendly; multi-column ones include linearized fallback text.
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
import { ResumeTemplate } from '@/types/template';

/** Paper sizes the engine supports — matches `pdfExport.PaperSize`. */
export type EnginePaperSize = 'letter' | 'a4';

/** Dimensions in inches per paper size. Used to size `.rb-page` correctly so
 * content never overflows the PDF page width on A4 selections. */
const PAPER_DIMENSIONS: Record<EnginePaperSize, { wIn: number; hIn: number; cssSize: string }> = {
  letter: { wIn: 8.5, hIn: 11.0, cssSize: 'Letter' },
  a4: { wIn: 8.27, hIn: 11.69, cssSize: 'A4' },
};

export interface PremiumHtmlOptions {
  /** Page size. Must match the paperSize passed to Print.printToFileAsync,
   *  otherwise the CSS page container won't fit and content gets cut. */
  paperSize?: EnginePaperSize;
}

/* -------------------------------------------------------------------------- */
/* Theme tokens                                                               */
/* -------------------------------------------------------------------------- */

export type LayoutId =
  | 'single-clean' // centered or left-aligned, full-width body
  | 'single-accent' // single column with subtle accent bar on the left
  | 'sidebar-left' // narrow colored sidebar on the left
  | 'sidebar-right' // mirror of sidebar-left for variety
  | 'banner' // full-width colored header band, white body
  | 'split-header' // top half colored, name on it, body below
  | 'two-column' // 35/65 body split, both white
  | 'timeline'; // single column with vertical timeline rail

export interface PremiumTheme {
  layout: LayoutId;
  /** Density preset — drives spacing scale */
  density: 'comfortable' | 'compact' | 'airy';
  /** Display font family used for the name + section titles */
  displayFont: string;
  /** Body font family used for everything else */
  bodyFont: string;
  /** Whether section titles should be ALL CAPS with letter-spacing */
  uppercaseSections: boolean;
  /** Whether to render circle/square photo when resume.header.photo is set */
  showPhoto: boolean;
  /** Accent shape used by the header and section dividers */
  accent: 'hairline' | 'block' | 'underline' | 'badge' | 'pill';
  /** When the layout has a colored panel, this is the panel background */
  panelBg?: string;
  /** When the layout has a colored panel, this is the panel text color */
  panelText?: string;
  /** When the layout has a colored panel, muted text color inside it */
  panelTextMuted?: string;
  /** Primary brand color (section titles, accents, links) */
  primary: string;
  /** Secondary color (job titles, hyperlinks) */
  secondary: string;
  /** Body text color */
  text: string;
  /** Muted text color (dates, locations) */
  textMuted: string;
  /** Page background (almost always #FFFFFF) */
  background: string;
  /** Border / hairline color */
  border: string;
}

/**
 * Public: resolve which layout a template uses. Lets the in-app template
 * picker render a thumbnail with the SAME structure the PDF will produce.
 * Without this, the picker thumbnail can show a sidebar while the PDF
 * generates a single column (or vice versa) — confusing for the user.
 */
export function getTemplateLayoutId(template: ResumeTemplate): LayoutId {
  return deriveTheme(template).layout;
}

/**
 * Translate a stored template into a PremiumTheme. The template metadata
 * stores hex colors + fonts; we infer the rest from `layout.sectionStyle`,
 * `layout.columns`, and a small `themeMap` keyed by template ID for the
 * cases where we want deliberate art direction.
 */
function deriveTheme(template: ResumeTemplate): PremiumTheme {
  const { styles } = template;
  const c = styles.colors;
  const f = styles.fonts;

  // Per-template overrides for art direction not expressible in the old schema.
  const override = THEME_OVERRIDES[template.id];

  const inferredLayout: LayoutId = override?.layout
    ? override.layout
    : styles.layout.columns === 2
      ? styles.layout.sectionStyle === 'sidebar'
        ? 'sidebar-left'
        : 'two-column'
      : styles.layout.headerStyle === 'banner'
        ? 'banner'
        : styles.layout.headerStyle === 'split'
          ? 'split-header'
          : styles.layout.sectionStyle === 'boxed'
            ? 'single-accent'
            : 'single-clean';

  return {
    layout: inferredLayout,
    density: override?.density ?? 'comfortable',
    displayFont: override?.displayFont ?? mapFont(f.heading, 'display'),
    bodyFont: override?.bodyFont ?? mapFont(f.body, 'body'),
    uppercaseSections: override?.uppercaseSections ?? true,
    showPhoto: styles.layout.showPhoto,
    accent: override?.accent ?? defaultAccent(inferredLayout),
    panelBg: override?.panelBg ?? c.primary,
    panelText: override?.panelText ?? '#FFFFFF',
    panelTextMuted: override?.panelTextMuted ?? 'rgba(255,255,255,0.78)',
    primary: c.primary,
    secondary: c.secondary,
    text: c.text,
    textMuted: c.textLight,
    background: c.background,
    border: c.border,
  };
}

function defaultAccent(layout: LayoutId): PremiumTheme['accent'] {
  switch (layout) {
    case 'single-clean':
      return 'underline';
    case 'single-accent':
      return 'block';
    case 'sidebar-left':
    case 'sidebar-right':
      return 'badge';
    case 'banner':
      return 'hairline';
    case 'split-header':
      return 'hairline';
    case 'two-column':
      return 'underline';
    case 'timeline':
      return 'pill';
  }
}

/**
 * Map old font names to proper print-safe stacks with display vs body roles.
 * We intentionally keep the stack short and rely only on fonts present on
 * iOS, Android, and Chrome's print engine.
 */
function mapFont(name: string, role: 'display' | 'body'): string {
  const lc = (name || '').toLowerCase();
  if (lc.includes('georgia') || lc.includes('garamond') || lc.includes('serif')) {
    return role === 'display'
      ? `'Playfair Display', Georgia, 'Times New Roman', serif`
      : `Georgia, 'Times New Roman', serif`;
  }
  if (lc.includes('calibri') || lc.includes('arial nova')) {
    return `Calibri, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
  }
  if (lc.includes('helvetica')) {
    return `'Helvetica Neue', Helvetica, Arial, sans-serif`;
  }
  if (lc.includes('mono') || lc.includes('code') || lc.includes('courier')) {
    return `'JetBrains Mono', 'SF Mono', 'Roboto Mono', Consolas, monospace`;
  }
  // Default — a clean Inter-like stack
  return `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
}

/**
 * Per-template overrides. This is the place where we make a template feel
 * deliberately different from a same-layout sibling. Anything not specified
 * here falls back to defaults derived from the template's stored fields.
 */
type ThemeOverride = Partial<
  Pick<
    PremiumTheme,
    | 'layout'
    | 'density'
    | 'displayFont'
    | 'bodyFont'
    | 'uppercaseSections'
    | 'accent'
    | 'panelBg'
    | 'panelText'
    | 'panelTextMuted'
  >
>;

const THEME_OVERRIDES: Record<string, ThemeOverride> = {
  // ---- Existing templates ----
  'ats-classic': { layout: 'single-clean', accent: 'underline' },
  'ats-professional': { layout: 'single-accent', accent: 'block' },
  'executive': {
    layout: 'single-clean',
    displayFont: `'Playfair Display', Georgia, serif`,
    bodyFont: `Georgia, 'Times New Roman', serif`,
    accent: 'underline',
  },
  'corporate-blue': { layout: 'sidebar-left', density: 'comfortable' },
  'modern-tech': {
    layout: 'banner',
    accent: 'pill',
    bodyFont: `'JetBrains Mono', 'SF Mono', Consolas, monospace`,
  },
  'sleek-gradient': { layout: 'split-header', accent: 'badge' },
  'creative-bold': { layout: 'two-column', density: 'compact' },
  'designer-pink': { layout: 'sidebar-right', accent: 'pill' },
  'minimal-clean': {
    layout: 'single-clean',
    density: 'airy',
    accent: 'hairline',
    uppercaseSections: false,
  },
  'swiss-style': {
    layout: 'single-clean',
    density: 'airy',
    accent: 'hairline',
    uppercaseSections: true,
  },

  // ---- New templates (defined later in templateStore) ----
  'modern-pro': { layout: 'sidebar-left', accent: 'badge' },
  'modern-pro-right': { layout: 'sidebar-right', accent: 'badge' },
  'startup-bold': { layout: 'banner', accent: 'block' },
  'consultant': { layout: 'single-accent', accent: 'block' },
  'engineer-mono': {
    layout: 'sidebar-left',
    bodyFont: `'JetBrains Mono', 'SF Mono', Consolas, monospace`,
    accent: 'pill',
  },
  'academic-serif': {
    layout: 'single-clean',
    displayFont: `'Playfair Display', Georgia, serif`,
    bodyFont: `Georgia, 'Times New Roman', serif`,
    accent: 'underline',
    density: 'airy',
  },
  'marketing-lead': { layout: 'split-header', accent: 'block' },
  'designer-grid': { layout: 'two-column', accent: 'pill' },
  'timeline-pro': { layout: 'timeline', accent: 'pill' },
  'finance-navy': { layout: 'single-accent', accent: 'block' },
  'sales-energetic': { layout: 'banner', accent: 'pill' },
  'product-manager': { layout: 'sidebar-left', accent: 'badge' },
};

/* -------------------------------------------------------------------------- */
/* HTML helpers                                                               */
/* -------------------------------------------------------------------------- */

function esc(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Compact date range renderer. "Jun 2021 – Present" feels premium; raw
 * 2021-06 doesn't. We format conservatively — if the input already looks
 * formatted, we pass it through untouched.
 */
function dateRange(start: string | null | undefined, end: string | null | undefined, isPresent?: boolean): string {
  const s = (start || '').trim();
  const e = isPresent ? 'Present' : (end || '').trim() || 'Present';
  if (!s && !e) return '';
  if (!s) return esc(e);
  if (!e) return esc(s);
  return `${esc(s)} – ${esc(e)}`;
}

/** Detect if the experience description already contains <ul>/<li> markup. */
function renderBullets(description: string | undefined, bullets: string[] | undefined): string {
  const list = (bullets ?? []).filter((b) => b && b.trim().length > 0);
  if (list.length > 0) {
    return `<ul class="rb-list">${list.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }
  if (description && description.trim()) {
    // If the description uses newlines, treat lines starting with '-' / '•'
    // as bullets — common pattern from imported resumes.
    const lines = description.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const looksLikeList = lines.length > 1 && lines.every((l) => /^[-•·*]/.test(l));
    if (looksLikeList) {
      return `<ul class="rb-list">${lines
        .map((l) => `<li>${esc(l.replace(/^[-•·*]\s*/, ''))}</li>`)
        .join('')}</ul>`;
    }
    return `<p class="rb-desc">${esc(description)}</p>`;
  }
  return '';
}

function initialsOf(name: string | undefined): string {
  const parts = (name || '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'YN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Section content blocks (theme-aware)                                       */
/* -------------------------------------------------------------------------- */

interface BlockOpts {
  t: PremiumTheme;
  /** Which "surface" we're rendering inside: main body or colored panel. */
  surface: 'body' | 'panel';
}

function sectionTitle(label: string, opts: BlockOpts): string {
  const onPanel = opts.surface === 'panel';
  const cls = onPanel ? 'rb-section-title rb-on-panel' : 'rb-section-title';
  return `<h2 class="${cls}">${esc(label)}</h2>`;
}

function summaryBlock(text: string | undefined, opts: BlockOpts): string {
  if (!text || !text.trim()) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Summary', opts)}
      <p class="rb-summary">${esc(text)}</p>
    </section>
  `;
}

function experienceBlock(items: WorkExperience[], opts: BlockOpts): string {
  if (!items?.length) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Experience', opts)}
      ${items
        .map(
          (exp) => `
        <div class="rb-item">
          <div class="rb-item-row">
            <span class="rb-item-title">${esc(exp.title)}</span>
            <span class="rb-item-date">${dateRange(exp.startDate, exp.endDate, exp.isCurrentRole)}</span>
          </div>
          <div class="rb-item-meta">
            <span class="rb-item-org">${esc(exp.company)}</span>${exp.location ? ` · <span class="rb-item-loc">${esc(exp.location)}</span>` : ''}
          </div>
          ${renderBullets(exp.description, exp.bullets)}
        </div>
      `,
        )
        .join('')}
    </section>
  `;
}

function educationBlock(items: Education[], opts: BlockOpts): string {
  if (!items?.length) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Education', opts)}
      ${items
        .map((edu) => {
          const titleText = edu.field ? `${edu.degree} in ${edu.field}` : edu.degree;
          return `
        <div class="rb-item">
          <div class="rb-item-row">
            <span class="rb-item-title">${esc(titleText)}</span>
            <span class="rb-item-date">${dateRange(edu.startDate, edu.endDate)}</span>
          </div>
          <div class="rb-item-meta">
            <span class="rb-item-org">${esc(edu.institution)}</span>${edu.location ? ` · <span class="rb-item-loc">${esc(edu.location)}</span>` : ''}${edu.gpa ? ` · <span class="rb-item-loc">GPA ${esc(edu.gpa)}</span>` : ''}
          </div>
        </div>
      `;
        })
        .join('')}
    </section>
  `;
}

function skillsBlock(items: Skill[], opts: BlockOpts): string {
  if (!items?.length) return '';
  const onPanel = opts.surface === 'panel';
  if (onPanel) {
    // On a colored panel we just stack them — looks cleaner than pills on color.
    return `
      <section class="rb-section">
        ${sectionTitle('Skills', opts)}
        <ul class="rb-panel-list">
          ${items.map((s) => `<li>${esc(s.name)}</li>`).join('')}
        </ul>
      </section>
    `;
  }
  return `
    <section class="rb-section">
      ${sectionTitle('Skills', opts)}
      <div class="rb-skills">
        ${items.map((s) => `<span class="rb-skill">${esc(s.name)}</span>`).join('')}
      </div>
    </section>
  `;
}

function projectsBlock(items: Project[], opts: BlockOpts): string {
  if (!items?.length) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Projects', opts)}
      ${items
        .map(
          (p) => `
        <div class="rb-item">
          <div class="rb-item-row">
            <span class="rb-item-title">${esc(p.name)}</span>
            ${p.link ? `<span class="rb-item-date">${esc(p.link.replace(/^https?:\/\//, ''))}</span>` : ''}
          </div>
          ${p.technologies?.length ? `<div class="rb-item-meta">${p.technologies.map((t) => esc(t)).join(' · ')}</div>` : ''}
          ${p.description ? `<p class="rb-desc">${esc(p.description)}</p>` : ''}
        </div>
      `,
        )
        .join('')}
    </section>
  `;
}

function certificationsBlock(items: Certification[], opts: BlockOpts): string {
  if (!items?.length) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Certifications', opts)}
      ${items
        .map(
          (c) => `
        <div class="rb-item rb-item-tight">
          <div class="rb-item-row">
            <span class="rb-item-title">${esc(c.name)}</span>
            <span class="rb-item-date">${esc(c.date || '')}</span>
          </div>
          ${c.issuer ? `<div class="rb-item-meta">${esc(c.issuer)}</div>` : ''}
        </div>
      `,
        )
        .join('')}
    </section>
  `;
}

function languagesBlock(items: Language[], opts: BlockOpts): string {
  if (!items?.length) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Languages', opts)}
      <div class="rb-pairs">
        ${items
          .map(
            (l) =>
              `<div class="rb-pair"><span class="rb-pair-k">${esc(l.name)}</span><span class="rb-pair-v">${esc(l.proficiency || '')}</span></div>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function awardsBlock(items: Award[], opts: BlockOpts): string {
  if (!items?.length) return '';
  return `
    <section class="rb-section">
      ${sectionTitle('Awards', opts)}
      ${items
        .map(
          (a) => `
        <div class="rb-item rb-item-tight">
          <div class="rb-item-row">
            <span class="rb-item-title">${esc(a.title)}</span>
            <span class="rb-item-date">${esc(a.date || '')}</span>
          </div>
          ${a.issuer ? `<div class="rb-item-meta">${esc(a.issuer)}</div>` : ''}
          ${a.description ? `<p class="rb-desc">${esc(a.description)}</p>` : ''}
        </div>
      `,
        )
        .join('')}
    </section>
  `;
}

/* -------------------------------------------------------------------------- */
/* Headers                                                                    */
/* -------------------------------------------------------------------------- */

function contactInline(resume: Resume): string {
  const c = resume.header.contact ?? ({} as any);
  const items: string[] = [];
  if (c.email) items.push(esc(c.email));
  if (c.phone) items.push(esc(c.phone));
  if (c.location) items.push(esc(c.location));
  if (c.linkedin) items.push(esc(c.linkedin));
  if (c.website) items.push(esc(c.website));
  return items.join('<span class="rb-dot">·</span>');
}

function contactStacked(resume: Resume): string {
  const c = resume.header.contact ?? ({} as any);
  const rows: string[] = [];
  if (c.email) rows.push(`<div class="rb-stack-row">${esc(c.email)}</div>`);
  if (c.phone) rows.push(`<div class="rb-stack-row">${esc(c.phone)}</div>`);
  if (c.location) rows.push(`<div class="rb-stack-row">${esc(c.location)}</div>`);
  if (c.linkedin) rows.push(`<div class="rb-stack-row">${esc(c.linkedin)}</div>`);
  if (c.website) rows.push(`<div class="rb-stack-row">${esc(c.website)}</div>`);
  return rows.join('');
}

function bodyHeaderClean(resume: Resume, t: PremiumTheme): string {
  return `
    <header class="rb-header rb-header-clean">
      <h1 class="rb-name">${esc(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="rb-title">${esc(resume.header.jobTitle)}</div>` : ''}
      <div class="rb-contact">${contactInline(resume)}</div>
    </header>
  `;
}

function bodyHeaderBanner(resume: Resume, t: PremiumTheme): string {
  return `
    <header class="rb-header rb-header-banner">
      <div class="rb-header-banner-inner">
        <h1 class="rb-name">${esc(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="rb-title">${esc(resume.header.jobTitle)}</div>` : ''}
        <div class="rb-contact">${contactInline(resume)}</div>
      </div>
    </header>
  `;
}

function bodyHeaderSplit(resume: Resume, t: PremiumTheme): string {
  return `
    <header class="rb-header rb-header-split">
      <div class="rb-header-split-color">
        <h1 class="rb-name">${esc(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="rb-title">${esc(resume.header.jobTitle)}</div>` : ''}
      </div>
      <div class="rb-header-split-light">
        <div class="rb-contact-stack">${contactStacked(resume)}</div>
      </div>
    </header>
  `;
}

function sidebarPanel(resume: Resume, t: PremiumTheme): string {
  const opts: BlockOpts = { t, surface: 'panel' };
  const photo = t.showPhoto && resume.header.photo
    ? `<img class="rb-photo" src="${esc(resume.header.photo)}" alt="" />`
    : `<div class="rb-initials">${initialsOf(resume.header.fullName)}</div>`;

  return `
    <aside class="rb-sidebar">
      ${photo}
      <h1 class="rb-name rb-on-panel">${esc(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="rb-title rb-on-panel">${esc(resume.header.jobTitle)}</div>` : ''}

      <section class="rb-section">
        ${sectionTitle('Contact', opts)}
        <div class="rb-contact-stack">${contactStacked(resume)}</div>
      </section>

      ${skillsBlock(resume.skills, opts)}
      ${languagesBlock(resume.languages || [], opts)}
      ${certificationsBlock(resume.certifications || [], opts)}
    </aside>
  `;
}

/* -------------------------------------------------------------------------- */
/* Shared CSS                                                                 */
/* -------------------------------------------------------------------------- */

function baseStyles(t: PremiumTheme, paper: EnginePaperSize): string {
  const dens = densityScale(t.density);
  const dim = PAPER_DIMENSIONS[paper];
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    /* @page MUST match the size passed to Print.printToFileAsync, otherwise
       Chromium prints content into a smaller box and clips it on the right. */
    @page { size: ${dim.cssSize}; margin: 0; }
    html, body {
      font-family: ${t.bodyFont};
      font-size: ${dens.body}pt;
      line-height: 1.55;
      color: ${t.text};
      background: ${t.background};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
      /* Widows/orphans keep paragraphs from being chopped after one line.
         Important for the descriptions and bullet lists in experience. */
      orphans: 3;
      widows: 3;
    }
    /* The page container: width follows the paper, height is allowed to
       grow naturally so short resumes don't have weird trailing whitespace
       and long resumes paginate via the print engine. */
    .rb-page {
      width: ${dim.wIn}in;
      max-width: 100%;
      margin: 0 auto;
      background: ${t.background};
    }
    /* Page-break controls. Without these, the print engine will happily
       chop a job title and put its bullets on the next page, or split a
       bullet across two pages — both look unprofessional. */
    .rb-section { page-break-inside: avoid; break-inside: avoid; }
    .rb-item    { page-break-inside: avoid; break-inside: avoid; }
    .rb-header  { page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
    .rb-section-title { page-break-after: avoid; break-after: avoid; }
    .rb-list li { page-break-inside: avoid; break-inside: avoid; }

    /* Typography */
    .rb-name {
      font-family: ${t.displayFont};
      font-weight: 700;
      font-size: ${dens.name}pt;
      letter-spacing: -0.01em;
      line-height: 1.1;
      color: ${t.text};
    }
    .rb-name.rb-on-panel { color: ${t.panelText}; }
    .rb-title {
      font-family: ${t.bodyFont};
      font-weight: 500;
      font-size: ${dens.title}pt;
      color: ${t.primary};
      margin-top: 4px;
      letter-spacing: 0.01em;
    }
    .rb-title.rb-on-panel { color: ${t.panelTextMuted}; }
    .rb-contact {
      font-size: ${dens.meta}pt;
      color: ${t.textMuted};
      margin-top: ${dens.tight}px;
      line-height: 1.5;
    }
    .rb-contact-stack { font-size: ${dens.meta}pt; line-height: 1.7; }
    .rb-stack-row { word-break: break-word; }
    .rb-dot { margin: 0 8px; opacity: 0.55; }

    /* Section */
    .rb-section { margin-bottom: ${dens.sectionGap}px; }
    .rb-section-title {
      font-family: ${t.bodyFont};
      font-size: ${dens.sectionTitle}pt;
      font-weight: 700;
      color: ${t.primary};
      ${t.uppercaseSections ? `text-transform: uppercase; letter-spacing: 0.12em;` : ''}
      margin-bottom: ${dens.tight + 2}px;
      ${accentCss(t)}
    }
    .rb-section-title.rb-on-panel {
      color: ${t.panelText};
      ${t.uppercaseSections ? `text-transform: uppercase; letter-spacing: 0.12em;` : ''}
      ${accentCssPanel(t)}
    }

    /* Items */
    .rb-item { margin-bottom: ${dens.itemGap}px; }
    .rb-item-tight { margin-bottom: ${Math.max(4, dens.itemGap - 6)}px; }
    .rb-item-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 1px;
    }
    .rb-item-title {
      font-weight: 700;
      font-size: ${dens.itemTitle}pt;
      color: ${t.text};
    }
    .rb-item-date {
      font-size: ${dens.meta}pt;
      color: ${t.textMuted};
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-style: italic;
    }
    .rb-item-meta {
      font-size: ${dens.meta}pt;
      color: ${t.secondary};
      margin-bottom: 4px;
    }
    .rb-item-org { font-weight: 600; }
    .rb-item-loc { color: ${t.textMuted}; }
    .rb-desc { font-size: ${dens.body}pt; line-height: 1.55; color: ${t.text}; }
    .rb-summary {
      font-size: ${dens.body}pt;
      line-height: 1.6;
      color: ${t.text};
    }

    /* Bullets */
    .rb-list { margin: 4px 0 0; padding-left: 18px; }
    .rb-list li {
      font-size: ${dens.body}pt;
      line-height: 1.55;
      color: ${t.text};
      margin-bottom: 2px;
    }
    .rb-list li::marker { color: ${t.primary}; }

    /* Skills + pills */
    .rb-skills { display: flex; flex-wrap: wrap; gap: 6px; }
    .rb-skill {
      font-size: ${dens.meta}pt;
      padding: 4px 10px;
      background: ${withAlpha(t.primary, 0.08)};
      color: ${t.primary};
      border-radius: 12px;
      border: 1px solid ${withAlpha(t.primary, 0.18)};
    }

    /* Pair lists (Languages) */
    .rb-pairs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
    .rb-pair { display: flex; justify-content: space-between; font-size: ${dens.meta}pt; }
    .rb-pair-k { color: ${t.text}; font-weight: 600; }
    .rb-pair-v { color: ${t.textMuted}; }

    /* Sidebar specifics */
    .rb-sidebar {
      background: ${t.panelBg};
      color: ${t.panelText};
      padding: 36px 26px;
    }
    .rb-sidebar .rb-section-title { color: ${t.panelText}; }
    .rb-panel-list { list-style: none; padding: 0; margin: 0; }
    .rb-panel-list li {
      font-size: ${dens.meta}pt;
      color: ${t.panelText};
      padding: 3px 0;
      border-bottom: 1px solid ${withAlpha('#FFFFFF', 0.12)};
    }
    .rb-photo {
      display: block;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      object-fit: cover;
      margin: 0 auto 16px;
      border: 3px solid ${withAlpha('#FFFFFF', 0.35)};
    }
    .rb-initials {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: ${withAlpha('#FFFFFF', 0.18)};
      color: ${t.panelText};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ${t.displayFont};
      font-size: 30pt;
      font-weight: 700;
      margin: 0 auto 16px;
      letter-spacing: 0.02em;
    }

    /* Header variants */
    .rb-header-clean { margin-bottom: ${dens.sectionGap}px; padding-bottom: 14px; border-bottom: 1px solid ${t.border}; }
    .rb-header-banner {
      background: ${t.panelBg};
      color: ${t.panelText};
      padding: 36px ${dens.pageX}px 28px;
    }
    .rb-header-banner .rb-name { color: ${t.panelText}; }
    .rb-header-banner .rb-title { color: ${t.panelTextMuted}; }
    .rb-header-banner .rb-contact { color: ${t.panelTextMuted}; }
    .rb-header-split { display: flex; }
    .rb-header-split-color {
      flex: 1.1;
      background: ${t.panelBg};
      color: ${t.panelText};
      padding: 36px 28px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .rb-header-split-color .rb-name { color: ${t.panelText}; }
    .rb-header-split-color .rb-title { color: ${t.panelTextMuted}; }
    .rb-header-split-light {
      flex: 0.9;
      padding: 36px 28px;
      background: ${t.background};
      color: ${t.text};
      display: flex;
      align-items: center;
    }
  `;
}

function withAlpha(hex: string, alpha: number): string {
  // Accept #RRGGBB or rgba/rgb. For hex, append 2-digit hex alpha.
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return `${hex}${a}`;
  }
  return hex;
}

function accentCss(t: PremiumTheme): string {
  switch (t.accent) {
    case 'underline':
      return `padding-bottom: 4px; border-bottom: 1px solid ${withAlpha(t.primary, 0.35)};`;
    case 'hairline':
      return `padding-bottom: 6px; border-bottom: 1px solid ${t.border};`;
    case 'block':
      return `padding: 4px 10px; background: ${withAlpha(t.primary, 0.08)}; border-left: 3px solid ${t.primary}; display: inline-block;`;
    case 'badge':
      return ``;
    case 'pill':
      return `display: inline-block; padding: 3px 12px; border-radius: 999px; background: ${withAlpha(t.primary, 0.10)};`;
  }
}

function accentCssPanel(t: PremiumTheme): string {
  switch (t.accent) {
    case 'underline':
      return `padding-bottom: 4px; border-bottom: 1px solid ${withAlpha('#FFFFFF', 0.35)};`;
    case 'hairline':
      return `padding-bottom: 6px; border-bottom: 1px solid ${withAlpha('#FFFFFF', 0.18)};`;
    case 'block':
      return `padding: 4px 10px; background: ${withAlpha('#FFFFFF', 0.10)}; border-left: 3px solid ${withAlpha('#FFFFFF', 0.65)}; display: inline-block;`;
    case 'pill':
      return `display: inline-block; padding: 3px 12px; border-radius: 999px; background: ${withAlpha('#FFFFFF', 0.14)};`;
    case 'badge':
      return ``;
  }
}

function densityScale(d: PremiumTheme['density']) {
  if (d === 'compact') {
    return {
      name: 26,
      title: 12,
      sectionTitle: 10.5,
      itemTitle: 10.5,
      body: 9.5,
      meta: 9,
      sectionGap: 14,
      itemGap: 9,
      tight: 6,
      pageX: 44,
      pageY: 36,
    };
  }
  if (d === 'airy') {
    return {
      name: 32,
      title: 14,
      sectionTitle: 12,
      itemTitle: 11.5,
      body: 10.5,
      meta: 9.5,
      sectionGap: 24,
      itemGap: 16,
      tight: 8,
      pageX: 56,
      pageY: 48,
    };
  }
  // comfortable
  return {
    name: 30,
    title: 13,
    sectionTitle: 11,
    itemTitle: 11,
    body: 10,
    meta: 9.5,
    sectionGap: 20,
    itemGap: 12,
    tight: 7,
    pageX: 48,
    pageY: 40,
  };
}

/* -------------------------------------------------------------------------- */
/* Layout renderers                                                           */
/* -------------------------------------------------------------------------- */

function renderSingle(resume: Resume, t: PremiumTheme, accent: 'clean' | 'leftbar'): string {
  const opts: BlockOpts = { t, surface: 'body' };
  const dens = densityScale(t.density);
  const wrapper = accent === 'leftbar'
    ? `<div style="padding: ${dens.pageY}px ${dens.pageX}px; border-left: 6px solid ${t.primary};">`
    : `<div style="padding: ${dens.pageY}px ${dens.pageX}px;">`;
  return `
    ${wrapper}
      ${bodyHeaderClean(resume, t)}
      ${summaryBlock(resume.summary, opts)}
      ${experienceBlock(resume.experience, opts)}
      ${educationBlock(resume.education, opts)}
      ${projectsBlock(resume.projects || [], opts)}
      ${skillsBlock(resume.skills, opts)}
      ${certificationsBlock(resume.certifications || [], opts)}
      ${languagesBlock(resume.languages || [], opts)}
      ${awardsBlock(resume.awards || [], opts)}
    </div>
  `;
}

function renderBanner(resume: Resume, t: PremiumTheme): string {
  const opts: BlockOpts = { t, surface: 'body' };
  const dens = densityScale(t.density);
  return `
    ${bodyHeaderBanner(resume, t)}
    <div style="padding: ${dens.sectionGap}px ${dens.pageX}px ${dens.pageY}px;">
      ${summaryBlock(resume.summary, opts)}
      ${experienceBlock(resume.experience, opts)}
      ${educationBlock(resume.education, opts)}
      ${projectsBlock(resume.projects || [], opts)}
      ${skillsBlock(resume.skills, opts)}
      ${certificationsBlock(resume.certifications || [], opts)}
      ${languagesBlock(resume.languages || [], opts)}
      ${awardsBlock(resume.awards || [], opts)}
    </div>
  `;
}

function renderSplit(resume: Resume, t: PremiumTheme): string {
  const opts: BlockOpts = { t, surface: 'body' };
  const dens = densityScale(t.density);
  return `
    ${bodyHeaderSplit(resume, t)}
    <div style="padding: ${dens.sectionGap}px ${dens.pageX}px ${dens.pageY}px;">
      ${summaryBlock(resume.summary, opts)}
      ${experienceBlock(resume.experience, opts)}
      ${educationBlock(resume.education, opts)}
      ${projectsBlock(resume.projects || [], opts)}
      ${skillsBlock(resume.skills, opts)}
      ${certificationsBlock(resume.certifications || [], opts)}
      ${languagesBlock(resume.languages || [], opts)}
      ${awardsBlock(resume.awards || [], opts)}
    </div>
  `;
}

function renderSidebar(resume: Resume, t: PremiumTheme, side: 'left' | 'right'): string {
  const body: BlockOpts = { t, surface: 'body' };
  const dens = densityScale(t.density);
  const main = `
    <main class="rb-main" style="padding: ${dens.pageY}px ${dens.pageX}px; vertical-align: top;">
      ${summaryBlock(resume.summary, body)}
      ${experienceBlock(resume.experience, body)}
      ${educationBlock(resume.education, body)}
      ${projectsBlock(resume.projects || [], body)}
      ${awardsBlock(resume.awards || [], body)}
    </main>
  `;
  const sidebar = sidebarPanel(resume, t);
  // CSS table layout instead of flex: print engines (both Chromium-Android and
  // WebKit-iOS) handle table-cell pagination far more reliably than flex when
  // content overflows to a second page. Sidebar gets the colored background
  // continuing down via the table cell; main column wraps to next page.
  const leftCell = side === 'left' ? sidebar : main;
  const rightCell = side === 'left' ? main : sidebar;
  const leftWidth = side === 'left' ? '36%' : '64%';
  const rightWidth = side === 'left' ? '64%' : '36%';
  return `
    <div style="display: table; width: 100%; table-layout: fixed;">
      <div style="display: table-row;">
        <div style="display: table-cell; width: ${leftWidth}; vertical-align: top;">${leftCell}</div>
        <div style="display: table-cell; width: ${rightWidth}; vertical-align: top;">${rightCell}</div>
      </div>
    </div>
  `;
}

function renderTwoColumn(resume: Resume, t: PremiumTheme): string {
  const opts: BlockOpts = { t, surface: 'body' };
  const dens = densityScale(t.density);
  // Same reasoning as renderSidebar: table-cell beats flex for print pagination.
  return `
    ${bodyHeaderClean(resume, t)}
    <div style="display: table; width: 100%; table-layout: fixed; padding: 0 ${dens.pageX}px ${dens.pageY}px;">
      <div style="display: table-row;">
        <div style="display: table-cell; width: 36%; vertical-align: top; padding-right: 22px; border-right: 1px solid ${t.border};">
          ${summaryBlock(resume.summary, opts)}
          ${skillsBlock(resume.skills, opts)}
          ${educationBlock(resume.education, opts)}
          ${certificationsBlock(resume.certifications || [], opts)}
          ${languagesBlock(resume.languages || [], opts)}
        </div>
        <div style="display: table-cell; width: 64%; vertical-align: top; padding-left: 22px;">
          ${experienceBlock(resume.experience, opts)}
          ${projectsBlock(resume.projects || [], opts)}
          ${awardsBlock(resume.awards || [], opts)}
        </div>
      </div>
    </div>
  `;
}

function renderTimeline(resume: Resume, t: PremiumTheme): string {
  const opts: BlockOpts = { t, surface: 'body' };
  const dens = densityScale(t.density);
  // Vertical rail with bullet dots through experience + education
  const timelineStyle = `
    .rb-timeline { position: relative; padding-left: 22px; }
    .rb-timeline::before {
      content: '';
      position: absolute;
      left: 6px;
      top: 4px;
      bottom: 4px;
      width: 2px;
      background: ${withAlpha(t.primary, 0.35)};
    }
    .rb-timeline .rb-item { position: relative; padding-left: 4px; }
    .rb-timeline .rb-item::before {
      content: '';
      position: absolute;
      left: -22px;
      top: 6px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${t.primary};
      box-shadow: 0 0 0 3px ${withAlpha(t.primary, 0.15)};
    }
  `;
  return `
    <style>${timelineStyle}</style>
    <div style="padding: ${dens.pageY}px ${dens.pageX}px;">
      ${bodyHeaderClean(resume, t)}
      ${summaryBlock(resume.summary, opts)}
      ${resume.experience.length ? `
        <section class="rb-section">
          ${sectionTitle('Experience', opts)}
          <div class="rb-timeline">
            ${resume.experience
              .map(
                (exp) => `
              <div class="rb-item">
                <div class="rb-item-row">
                  <span class="rb-item-title">${esc(exp.title)}</span>
                  <span class="rb-item-date">${dateRange(exp.startDate, exp.endDate, exp.isCurrentRole)}</span>
                </div>
                <div class="rb-item-meta"><span class="rb-item-org">${esc(exp.company)}</span>${exp.location ? ` · <span class="rb-item-loc">${esc(exp.location)}</span>` : ''}</div>
                ${renderBullets(exp.description, exp.bullets)}
              </div>
            `,
              )
              .join('')}
          </div>
        </section>
      ` : ''}
      ${educationBlock(resume.education, opts)}
      ${projectsBlock(resume.projects || [], opts)}
      ${skillsBlock(resume.skills, opts)}
      ${certificationsBlock(resume.certifications || [], opts)}
      ${languagesBlock(resume.languages || [], opts)}
      ${awardsBlock(resume.awards || [], opts)}
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

export function generatePremiumHTML(
  resume: Resume,
  template: ResumeTemplate,
  opts: PremiumHtmlOptions = {},
): string {
  const t = deriveTheme(template);
  const paper = opts.paperSize ?? 'letter';
  let body = '';
  switch (t.layout) {
    case 'single-clean':
      body = renderSingle(resume, t, 'clean');
      break;
    case 'single-accent':
      body = renderSingle(resume, t, 'leftbar');
      break;
    case 'sidebar-left':
      body = renderSidebar(resume, t, 'left');
      break;
    case 'sidebar-right':
      body = renderSidebar(resume, t, 'right');
      break;
    case 'banner':
      body = renderBanner(resume, t);
      break;
    case 'split-header':
      body = renderSplit(resume, t);
      break;
    case 'two-column':
      body = renderTwoColumn(resume, t);
      break;
    case 'timeline':
      body = renderTimeline(resume, t);
      break;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${esc(resume.header.fullName || 'Resume')}</title>
<style>${baseStyles(t, paper)}</style>
</head>
<body>
<div class="rb-page">
${body}
</div>
</body>
</html>`;
}

export default generatePremiumHTML;
