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
import { interFontFaceCss } from './interFonts';

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
  /**
   * Render mode.
   *
   *   - 'pdf' (default): output the resume for `Print.printToFileAsync`.
   *     Single `.rb-page` div, no preview chrome, white body, content flows
   *     and the print engine paginates via the page-break-* CSS rules.
   *
   *   - 'preview': output for the WebView preview screen. Gray off-page
   *     background, white page card with shadow + rounded corner so the
   *     user sees their resume as an actual sheet of paper. Content is
   *     split into N visual page cards when it overflows one page, with
   *     a gap and "Page N" caption between them. The JS paginator at the
   *     bottom of the document handles the split client-side after layout.
   *
   * The same HTML is used either way — only the wrapper CSS + paginator
   * script differ. This guarantees preview = export.
   */
  mode?: 'pdf' | 'preview';
  /**
   * Preview-mode only: the WebView container's width in CSS px (i.e. the
   * RN-measured screen width minus horizontal padding). Used to compute
   * the initial zoom so the full 8.5in-wide page fits the screen instead
   * of rendering at 816px (zoomed-in, left-portion-only). Ignored in pdf
   * mode. Defaults to 360 (a conservative phone width) if not supplied.
   */
  previewWidthPx?: number;
  /**
   * Optional user-chosen accent color (hex like '#0F766E'). Overrides the
   * template's default primary/secondary/panel colors so a single template
   * can be re-colored — the per-template color picker. The text/background
   * neutrals are untouched so contrast + readability are preserved.
   */
  accentColor?: string;
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
  /** Header alignment for single-column layouts — a cheap, high-impact
   *  differentiator so the single-column family doesn't all look identical.
   *  'center' suits academic/minimal; 'left' is the standard. */
  headerAlign?: 'left' | 'center';
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
  /** How the Skills section renders. 'pills' (default) keeps the tag look;
   *  'bars' draws proficiency meters and 'dots' draws 5-dot ratings — both
   *  read as "premium" and are driven by Skill.level. The new pay-worthy
   *  templates opt into these; the original 22 keep their pill style. */
  skillStyle?: 'pills' | 'bars' | 'dots';
  /** Contact rows: 'plain' text (default) or 'icons' — small inline glyphs
   *  (mail / phone / location / linkedin / globe) before each line. */
  contactStyle?: 'plain' | 'icons';
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
/** Darken (amount<0) or lighten (amount>0) a #RRGGBB hex by a fraction. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const adj = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  r = adj(r); g = adj(g); b = adj(b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function deriveTheme(template: ResumeTemplate, accentColor?: string): PremiumTheme {
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

  const base: PremiumTheme = {
    layout: inferredLayout,
    density: override?.density ?? 'comfortable',
    displayFont: override?.displayFont ?? mapFont(f.heading, 'display'),
    bodyFont: override?.bodyFont ?? mapFont(f.body, 'body'),
    uppercaseSections: override?.uppercaseSections ?? true,
    showPhoto: styles.layout.showPhoto,
    accent: override?.accent ?? defaultAccent(inferredLayout),
    headerAlign: override?.headerAlign ?? 'left',
    panelBg: override?.panelBg ?? c.primary,
    panelText: override?.panelText ?? '#FFFFFF',
    panelTextMuted: override?.panelTextMuted ?? 'rgba(255,255,255,0.78)',
    skillStyle: override?.skillStyle,
    contactStyle: override?.contactStyle,
    primary: c.primary,
    secondary: c.secondary,
    text: c.text,
    textMuted: c.textLight,
    background: c.background,
    border: c.border,
  };

  // Per-template color picker: re-color the brand surfaces with the user's
  // chosen accent. Keep text/background neutral so contrast is preserved.
  // secondary derives a touch darker for the job-title/meta hierarchy;
  // panelBg uses the accent directly for sidebars/banners; border is a
  // pale tint so rules read against the page.
  if (accentColor && /^#?[0-9a-f]{6}$/i.test(accentColor)) {
    const a = accentColor.startsWith('#') ? accentColor : `#${accentColor}`;
    base.primary = a;
    base.secondary = shade(a, -0.18);
    // Only re-tint the panel if the template doesn't pin a custom panel.
    if (!override?.panelBg) base.panelBg = a;
    base.border = shade(a, 0.78); // pale version for hairlines
  }

  return base;
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
  // v1.9.0 part 3: Inter is bundled as base64 in the HTML head, so we can
  // safely list it first in every stack — even offline PDF rendering will
  // pick it up. Serif/mono templates keep their character (Georgia for
  // executive/academic, JetBrains Mono for engineer) but still fall back
  // to Inter so unknown weights or missing glyphs don't drop to system
  // sans-serif.
  if (lc.includes('georgia') || lc.includes('garamond') || lc.includes('serif')) {
    return role === 'display'
      ? `'Playfair Display', Georgia, 'Times New Roman', serif`
      : `Georgia, 'Times New Roman', serif`;
  }
  if (lc.includes('mono') || lc.includes('code') || lc.includes('courier')) {
    return `'JetBrains Mono', 'SF Mono', 'Roboto Mono', Consolas, monospace`;
  }
  // Default for body / display / arial / calibri / helvetica — Inter, the
  // resume-recommended sans-serif per our research synthesis (Figma,
  // Resume.io, Microsoft Word Blog 2026). Fallbacks cover the rare case
  // where the @font-face fails (e.g. base64 corruption mid-build).
  return `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
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
    | 'headerAlign'
    | 'panelBg'
    | 'panelText'
    | 'panelTextMuted'
    | 'skillStyle'
    | 'contactStyle'
  >
>;

const THEME_OVERRIDES: Record<string, ThemeOverride> = {
  // ---- Existing templates ----
  'ats-classic': { layout: 'single-clean', accent: 'underline' },
  'ats-professional': { layout: 'single-accent', accent: 'block' },
  'executive': {
    layout: 'single-clean',
    // Playfair display name + Inter body = the canonical modern-executive
    // pairing (research). Previously paired Playfair with a Georgia serif
    // body, which read dated/"old". Keep the elegant serif headline, modern
    // sans body for readability.
    displayFont: `'Playfair Display', Georgia, serif`,
    bodyFont: `'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`,
    accent: 'block',
    density: 'airy',
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
  // Minimal: centered header, hairline accents, lowercase section labels,
  // maximum whitespace. The "elegant, barely-there" template.
  'minimal-clean': {
    layout: 'single-clean',
    density: 'airy',
    accent: 'hairline',
    uppercaseSections: false,
    headerAlign: 'center',
  },
  // Swiss/International: left-aligned, ALL-CAPS section labels with wide
  // tracking, underline rules. Bold, gridded, typographic.
  'swiss-style': {
    layout: 'single-clean',
    density: 'comfortable',
    accent: 'underline',
    uppercaseSections: true,
  },

  // ---- New templates (defined later in templateStore) ----
  // Modern Pro: underline accents in the main column distinguish it from
  // corporate-blue (badge bars) — both are navy sidebars otherwise.
  'modern-pro': { layout: 'sidebar-left', accent: 'underline' },
  'modern-pro-right': { layout: 'sidebar-right', accent: 'badge' },
  'startup-bold': { layout: 'banner', accent: 'block' },
  'consultant': { layout: 'single-accent', accent: 'block' },
  'engineer-mono': {
    layout: 'sidebar-left',
    bodyFont: `'JetBrains Mono', 'SF Mono', Consolas, monospace`,
    accent: 'pill',
  },
  // Academic: centered traditional serif, full Georgia body (the one place
  // serif-everything is the right convention), airy. Distinct via centered
  // header + serif.
  'academic-serif': {
    layout: 'single-clean',
    displayFont: `'Playfair Display', Georgia, serif`,
    bodyFont: `Georgia, 'Times New Roman', serif`,
    accent: 'underline',
    density: 'airy',
    headerAlign: 'center',
  },
  'marketing-lead': { layout: 'split-header', accent: 'block' },
  'designer-grid': { layout: 'two-column', accent: 'pill' },
  'timeline-pro': { layout: 'timeline', accent: 'pill' },
  // Finance: navy + brass, modern Inter body (was inheriting Georgia
  // serif = dated). Conservative but not old.
  'finance-navy': {
    layout: 'single-accent',
    accent: 'block',
    bodyFont: `'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`,
  },
  'sales-energetic': { layout: 'banner', accent: 'pill' },
  'product-manager': { layout: 'sidebar-left', accent: 'badge' },

  // ---- v1.9.7 premium templates: skill bars / rating dots / icon contacts ----
  'aurora': {
    layout: 'sidebar-left',
    accent: 'badge',
    skillStyle: 'bars',
    contactStyle: 'icons',
  },
  'onyx': {
    // Pinned near-black panel + light panel text — the dark-tech look. The
    // panel is pinned so the color picker re-tints only the body accents.
    layout: 'sidebar-left',
    accent: 'pill',
    skillStyle: 'bars',
    contactStyle: 'icons',
    panelBg: '#0F172A',
    panelText: '#F1F5F9',
    panelTextMuted: 'rgba(241,245,249,0.72)',
  },
  'vivid': {
    layout: 'sidebar-right',
    accent: 'badge',
    skillStyle: 'dots',
    contactStyle: 'icons',
  },
  'luxe': {
    // Editorial: centered Playfair masthead, hairline rules, airy spacing.
    layout: 'single-clean',
    headerAlign: 'center',
    accent: 'hairline',
    density: 'airy',
    displayFont: `'Playfair Display', Georgia, serif`,
    bodyFont: `'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`,
  },
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

/* ---- Proficiency helpers (drive skill bars + rating dots) ---------------- */

// HONESTY: we never invent a proficiency the user didn't enter. An earlier
// version filled unrated skills with random-looking 80-96% bars so they
// "read as real" — that puts a claim on the user's actual resume that they
// never made. Unrated skills now fall back to a neutral full bar (the skill
// is simply listed, not scored).
const UNRATED_PCT = 100;
const UNRATED_DOTS = 5;
function levelToPct(level: Skill['level']): number {
  switch (level) {
    case 'expert': return 100;
    case 'advanced': return 85;
    case 'intermediate': return 66;
    case 'beginner': return 45;
    default: return UNRATED_PCT;
  }
}
function levelToDots(level: Skill['level']): number {
  switch (level) {
    case 'expert': return 5;
    case 'advanced': return 4;
    case 'intermediate': return 3;
    case 'beginner': return 2;
    default: return UNRATED_DOTS;
  }
}

/** True when at least one skill has a user-set level — otherwise a meter
 *  chart is meaningless and we render plain chips instead. */
function anyRated(items: Skill[]): boolean {
  return items.some((s) => !!s.level);
}
function profToDots(p: Language['proficiency']): number {
  switch (p) {
    case 'native': return 5;
    case 'professional': return 4;
    case 'conversational': return 3;
    case 'basic': return 2;
    default: return 4;
  }
}
function dotsHtml(on: number): string {
  let out = '';
  for (let i = 0; i < 5; i++) out += `<span class="rb-dot-pip${i < on ? ' on' : ''}"></span>`;
  return out;
}

function skillsBlock(items: Skill[], opts: BlockOpts): string {
  if (!items?.length) return '';
  const onPanel = opts.surface === 'panel';
  const style = opts.t.skillStyle;

  // Premium: horizontal proficiency bars. Only when the user actually rated
  // skills — otherwise every bar would be identical, which looks broken and
  // says nothing.
  if (style === 'bars' && anyRated(items)) {
    return `
      <section class="rb-section">
        ${sectionTitle('Skills', opts)}
        <div class="rb-skillbars">
          ${items
            .map(
              (s) =>
                `<div class="rb-skillbar"><span class="rb-skillbar-label">${esc(s.name)}</span><span class="rb-skillbar-track"><span class="rb-skillbar-fill" style="width:${levelToPct(s.level)}%"></span></span></div>`,
            )
            .join('')}
        </div>
      </section>
    `;
  }

  // Premium: 5-dot rating per skill (same rule as bars).
  if (style === 'dots' && anyRated(items)) {
    return `
      <section class="rb-section">
        ${sectionTitle('Skills', opts)}
        <div class="rb-ratings">
          ${items
            .map(
              (s) =>
                `<div class="rb-rating"><span class="rb-rating-label">${esc(s.name)}</span><span class="rb-rating-dots">${dotsHtml(levelToDots(s.level))}</span></div>`,
            )
            .join('')}
        </div>
      </section>
    `;
  }

  // Default — stacked list on a panel, pills on white. (Original behavior.)
  if (onPanel) {
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
  // Premium templates (skill bars/dots) get matching language proficiency
  // dots so the whole sidebar reads as one designed system.
  const premium = opts.t.skillStyle === 'dots' || opts.t.skillStyle === 'bars';
  if (premium) {
    return `
      <section class="rb-section">
        ${sectionTitle('Languages', opts)}
        <div class="rb-ratings">
          ${items
            .map(
              (l) =>
                `<div class="rb-rating"><span class="rb-rating-label">${esc(l.name)}</span><span class="rb-rating-dots">${dotsHtml(profToDots(l.proficiency))}</span></div>`,
            )
            .join('')}
        </div>
      </section>
    `;
  }
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

/** Tiny inline SVG glyphs for the icon-contact style. Stroke = currentColor
 *  so they take the surrounding text color (panel-light or body-dark). */
function contactGlyph(kind: 'mail' | 'phone' | 'pin' | 'link'): string {
  const paths: Record<typeof kind, string> = {
    mail: '<rect x="2" y="3.5" width="12" height="9" rx="1.3"/><path d="m2.6 4.6 5.4 4 5.4-4"/>',
    phone: '<path d="M5.6 2.5H3.4a1 1 0 0 0-1 1.1A10.5 10.5 0 0 0 12.4 13.6a1 1 0 0 0 1.1-1v-2L11 9.8l-1.1 1.2A8 8 0 0 1 5 6.1L6.2 5z"/>',
    pin: '<path d="M8 14s4.3-3.9 4.3-7.4A4.3 4.3 0 1 0 3.7 6.6C3.7 10.1 8 14 8 14z"/><circle cx="8" cy="6.4" r="1.5"/>',
    link: '<path d="M6.6 9.4 9.4 6.6M6.2 7 4.7 8.5a2.1 2.1 0 0 0 3 3L9.2 10M9.8 9l1.5-1.5a2.1 2.1 0 0 0-3-3L6.8 6"/>',
  };
  return `<svg class="rb-cicon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}

/** Contact rows with a leading glyph — the icon-contact style for premium
 *  sidebars. Falls back to the plain stacked rows via the caller. */
function contactStackedIcons(resume: Resume): string {
  const c = resume.header.contact ?? ({} as any);
  const row = (kind: 'mail' | 'phone' | 'pin' | 'link', val: string) =>
    `<div class="rb-cic-row">${contactGlyph(kind)}<span>${esc(val)}</span></div>`;
  const rows: string[] = [];
  if (c.email) rows.push(row('mail', c.email));
  if (c.phone) rows.push(row('phone', c.phone));
  if (c.location) rows.push(row('pin', c.location));
  if (c.linkedin) rows.push(row('link', c.linkedin));
  if (c.website) rows.push(row('link', c.website));
  return rows.join('');
}

function bodyHeaderClean(resume: Resume, t: PremiumTheme): string {
  const alignClass = t.headerAlign === 'center' ? ' rb-header-center' : '';
  return `
    <header class="rb-header rb-header-clean${alignClass}">
      <h1 class="rb-name">${esc(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="rb-title">${esc(resume.header.jobTitle)}</div>` : ''}
      <div class="rb-contact">${contactInline(resume)}</div>
    </header>
  `;
}

/** Circular header photo (banner/split) — white ring on the colored band.
 *  Only rendered when the user has set a photo. */
function headerPhoto(resume: Resume): string {
  return resume.header.photo
    ? `<img class="rb-header-photo" src="${esc(resume.header.photo)}" alt="" />`
    : '';
}

function bodyHeaderBanner(resume: Resume, t: PremiumTheme): string {
  const photo = headerPhoto(resume);
  return `
    <header class="rb-header rb-header-banner${photo ? ' rb-header-banner-photo' : ''}">
      ${photo}
      <div class="rb-header-banner-inner">
        <h1 class="rb-name">${esc(resume.header.fullName || 'Your Name')}</h1>
        ${resume.header.jobTitle ? `<div class="rb-title">${esc(resume.header.jobTitle)}</div>` : ''}
        <div class="rb-contact">${contactInline(resume)}</div>
      </div>
    </header>
  `;
}

function bodyHeaderSplit(resume: Resume, t: PremiumTheme): string {
  const photo = headerPhoto(resume);
  return `
    <header class="rb-header rb-header-split">
      <div class="rb-header-split-color">
        ${photo}
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
  // Show the user's photo whenever they've set one — the sidebar avatar
  // slot always renders something, so initials are just the fallback. We
  // no longer gate on t.showPhoto: if a user uploads a photo they expect
  // to see it in any sidebar template.
  const photo = resume.header.photo
    ? `<img class="rb-photo" src="${esc(resume.header.photo)}" alt="" />`
    : `<div class="rb-initials">${initialsOf(resume.header.fullName)}</div>`;

  return `
    <aside class="rb-sidebar">
      ${photo}
      <h1 class="rb-name rb-on-panel">${esc(resume.header.fullName || 'Your Name')}</h1>
      ${resume.header.jobTitle ? `<div class="rb-title rb-on-panel">${esc(resume.header.jobTitle)}</div>` : ''}

      <section class="rb-section">
        ${sectionTitle('Contact', opts)}
        <div class="rb-contact-stack">${t.contactStyle === 'icons' ? contactStackedIcons(resume) : contactStacked(resume)}</div>
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

function baseStyles(t: PremiumTheme, paper: EnginePaperSize, mode: 'pdf' | 'preview' = 'pdf'): string {
  const dens = densityScale(t.density);
  const dim = PAPER_DIMENSIONS[paper];
  // v1.9.0 part 3: bundle the Inter font face inline so PDF AND preview
  // both render with the same typography. Adds ~1.3MB to every HTML doc
  // (3 weights × ~450KB base64) but eliminates network requests at PDF
  // render time and guarantees preview = export.
  const inter = interFontFaceCss();
  // Preview-mode chrome: gray off-page background + white page card with
  // shadow + gap between pages. Each .rb-page card looks like a sheet of
  // paper on a desk. JS paginator below splits long content into multiple
  // .rb-page cards so the user can see "this is page 2" visually.
  const previewChrome = mode === 'preview' ? `
    html, body { background: #E5E7EB; }
    body { padding: 16px 0 32px; }
    .rb-page {
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
      border-radius: 4px;
      margin-bottom: 24px;
      min-height: ${dim.hIn}in;
      position: relative;
      overflow: hidden;
    }
    .rb-page::after {
      content: 'Page ' attr(data-page-number) ' of ' attr(data-page-total);
      position: absolute;
      bottom: -22px;
      right: 0;
      font-size: 10px;
      color: #6B7280;
      letter-spacing: 0.5px;
    }
    /* Hide page caption when there's only one page — clean for the 1-page case. */
    .rb-page[data-page-total='1']::after { display: none; }
  ` : '';
  return `
    ${inter}
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
    ${previewChrome}
    /* The page container: width follows the paper, height is allowed to
       grow naturally so short resumes don't have weird trailing whitespace
       and long resumes paginate via the print engine. */
    .rb-page {
      width: ${dim.wIn}in;
      max-width: 100%;
      margin: 0 auto;
      background: ${t.background};
    }
    /* Page-break controls — the granularity matters. The v1.9.2 cut-off
       bug was caused by putting page-break-inside:avoid on .rb-section:
       a multi-job Experience section taller than one page can't be kept
       together, so Chromium CLIPPED it (content vanished between
       paragraphs). The fix: let SECTIONS flow across pages, breaking
       cleanly BETWEEN items, but keep each individual ITEM (one job, one
       degree) intact. Section titles never get orphaned at a page bottom. */
    .rb-section { /* intentionally breakable across pages */ }
    .rb-item    { page-break-inside: avoid; break-inside: avoid; }
    .rb-header  { page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
    .rb-section-title {
      page-break-after: avoid; break-after: avoid;
      /* Keep a title with at least the first item beneath it. */
      page-break-inside: avoid; break-inside: avoid;
    }
    .rb-list { page-break-inside: auto; break-inside: auto; }
    .rb-list li { page-break-inside: avoid; break-inside: avoid; }
    /* A very long single item (e.g. 12 bullets) must still be allowed to
       split across a page boundary rather than clip. Override the item
       rule for items the engine flags as oversized via .rb-item-long. */
    .rb-item-long { page-break-inside: auto; break-inside: auto; }

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
    /* Auto-fit, NOT a hard 1fr 1fr: a fixed two-column grid collapses inside
       narrow containers (the 36% column of the two-column layouts, and any
       sidebar), which ran the name into the proficiency — "MandarinProfessional".
       auto-fit drops to a single column whenever the container is too narrow,
       so this is correct in every layout. */
    .rb-pairs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px 16px; }
    .rb-pair { display: flex; justify-content: space-between; gap: 4px 10px; flex-wrap: wrap; font-size: ${dens.meta}pt; }
    .rb-pair-k { color: ${t.text}; font-weight: 600; }
    .rb-pair-v { color: ${t.textMuted}; }

    /* Skill proficiency bars (premium templates) */
    .rb-skillbars { display: flex; flex-direction: column; gap: 7px; }
    .rb-skillbar-label { display: block; font-size: ${dens.meta}pt; color: ${t.text}; font-weight: 500; margin-bottom: 3px; }
    .rb-skillbar-track { display: block; height: 5px; border-radius: 3px; background: ${withAlpha(t.primary, 0.14)}; overflow: hidden; }
    .rb-skillbar-fill { display: block; height: 100%; border-radius: 3px; background: ${t.primary}; }

    /* 5-dot ratings (skills + languages, premium templates) */
    .rb-ratings { display: flex; flex-direction: column; gap: 6px; }
    .rb-rating { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .rb-rating-label { font-size: ${dens.meta}pt; color: ${t.text}; }
    .rb-rating-dots { display: inline-flex; gap: 3px; flex-shrink: 0; }
    .rb-dot-pip { width: 6px; height: 6px; border-radius: 50%; background: ${withAlpha(t.primary, 0.22)}; }
    .rb-dot-pip.on { background: ${t.primary}; }

    /* Icon contact rows (premium templates) */
    .rb-cic-row { display: flex; align-items: center; gap: 7px; font-size: ${dens.meta}pt; color: ${t.textMuted}; margin-bottom: 5px; }
    .rb-cicon { width: 12px; height: 12px; flex-shrink: 0; color: ${t.primary}; }

    /* Sidebar specifics */
    .rb-sidebar {
      background: ${t.panelBg};
      color: ${t.panelText};
      padding: 36px 26px;
    }
    .rb-sidebar .rb-section-title { color: ${t.panelText}; }
    /* CRITICAL contrast fix: any item/pair/date/meta text rendered INSIDE
       the colored sidebar must use the light panel palette. Without these
       overrides they inherit the dark body colors (t.textMuted / t.secondary)
       and become invisible on a navy/dark sidebar — e.g. Languages
       proficiency and Certifications dates were unreadable. */
    .rb-sidebar .rb-item-title,
    .rb-sidebar .rb-item-org,
    .rb-sidebar .rb-pair-k { color: ${t.panelText}; }
    .rb-sidebar .rb-item-date,
    .rb-sidebar .rb-item-meta,
    .rb-sidebar .rb-item-loc,
    .rb-sidebar .rb-pair-v,
    .rb-sidebar .rb-desc,
    .rb-sidebar .rb-summary { color: ${t.panelTextMuted}; }
    .rb-sidebar .rb-list li,
    .rb-sidebar .rb-list li::marker { color: ${t.panelTextMuted}; }
    /* Narrow sidebar fix: the default 2-column pair grid squeezes each
       Languages row so tight that the name and proficiency collide
       ("MandarinProfessional"). Give each language the full sidebar width,
       and let a long proficiency wrap to the next line instead of overlapping. */
    .rb-sidebar .rb-pairs { grid-template-columns: 1fr; gap: 4px 0; }
    .rb-sidebar .rb-pair { gap: 6px 10px; flex-wrap: wrap; }
    /* Premium components on the colored panel: light fills + light text. */
    .rb-sidebar .rb-skillbar-label { color: ${t.panelText}; }
    .rb-sidebar .rb-skillbar-track { background: rgba(255,255,255,0.20); }
    .rb-sidebar .rb-skillbar-fill { background: ${t.panelText}; }
    .rb-sidebar .rb-rating-label { color: ${t.panelText}; }
    .rb-sidebar .rb-dot-pip { background: rgba(255,255,255,0.28); }
    .rb-sidebar .rb-dot-pip.on { background: ${t.panelText}; }
    .rb-sidebar .rb-cic-row { color: ${t.panelTextMuted}; }
    .rb-sidebar .rb-cicon { color: ${t.panelText}; }
    .rb-sidebar .rb-skill {
      background: ${withAlpha('#FFFFFF', 0.16)};
      color: ${t.panelText};
      border-color: ${withAlpha('#FFFFFF', 0.28)};
    }
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
    /* Clean header: a 2px primary rule (not flat gray) gives even the
       minimal ATS templates an intentional, designed feel rather than
       looking like an unstyled Word doc. */
    .rb-header-clean { margin-bottom: ${dens.sectionGap}px; padding-bottom: 14px; border-bottom: 2px solid ${t.primary}; }
    .rb-header-clean .rb-name { color: ${t.text}; }
    /* Centered header variant (academic / minimal) — name + title + contact
       all centered, with the rule centered too. A strong, immediate visual
       difference from the left-aligned standard. */
    .rb-header-center { text-align: center; }
    .rb-header-center .rb-contact { justify-content: center; }
    .rb-header-banner {
      background: ${t.panelBg};
      color: ${t.panelText};
      padding: 36px ${dens.pageX}px 28px;
    }
    /* With a photo, lay the headshot beside the name as a profile card. */
    .rb-header-banner-photo { display: flex; align-items: center; gap: 22px; }
    .rb-header-banner .rb-name { color: ${t.panelText}; }
    .rb-header-banner .rb-title { color: ${t.panelTextMuted}; }
    .rb-header-banner .rb-contact { color: ${t.panelTextMuted}; }
    /* Circular header photo on the colored band (banner + split). White
       ring lifts it off the color; object-fit keeps the crop centered. */
    .rb-header-photo {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 3px solid ${withAlpha('#FFFFFF', 0.55)};
    }
    .rb-header-split-color .rb-header-photo { margin-bottom: 14px; }
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
      // Bold full-color rule under the whole title — strong, editorial.
      return `padding-bottom: 5px; border-bottom: 2px solid ${t.primary}; display: block;`;
    case 'hairline':
      // Title sits left, a thin rule extends to the right edge (handled by
      // the section-title::after below). Here just the baseline gap.
      return `padding-bottom: 6px; border-bottom: 1px solid ${withAlpha(t.primary, 0.45)};`;
    case 'block':
      // Filled accent block — bold, modern. Title text gets the panel feel.
      return `padding: 5px 12px; background: ${withAlpha(t.primary, 0.12)}; border-left: 4px solid ${t.primary}; display: inline-block;`;
    case 'badge':
      // Colored leading bar before the text via a thick left border on an
      // inline-block — gives badge templates a real visual signature
      // (previously badge rendered NOTHING, making them look unfinished).
      return `padding-left: 12px; border-left: 4px solid ${t.primary}; line-height: 1.1; display: inline-block;`;
    case 'pill':
      // Solid filled pill — playful, creative-tier.
      return `display: inline-block; padding: 4px 14px; border-radius: 999px; background: ${t.primary}; color: #FFFFFF;`;
  }
}

function accentCssPanel(t: PremiumTheme): string {
  switch (t.accent) {
    case 'underline':
      return `padding-bottom: 5px; border-bottom: 2px solid ${withAlpha('#FFFFFF', 0.55)}; display: block;`;
    case 'hairline':
      return `padding-bottom: 6px; border-bottom: 1px solid ${withAlpha('#FFFFFF', 0.30)};`;
    case 'block':
      return `padding: 5px 12px; background: ${withAlpha('#FFFFFF', 0.14)}; border-left: 4px solid ${withAlpha('#FFFFFF', 0.75)}; display: inline-block;`;
    case 'pill':
      return `display: inline-block; padding: 4px 14px; border-radius: 999px; background: ${withAlpha('#FFFFFF', 0.20)};`;
    case 'badge':
      return `padding-left: 12px; border-left: 4px solid ${withAlpha('#FFFFFF', 0.75)}; line-height: 1.1; display: inline-block;`;
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
  const t = deriveTheme(template, opts.accentColor);
  const paper = opts.paperSize ?? 'letter';
  const mode = opts.mode ?? 'pdf';
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

  // Viewport meta — only matters in WebView preview mode (Chromium PDF
  // engine ignores it). For preview we declare the layout width as the
  // paper width (816px for Letter @96dpi) and set initial-scale to
  // (screenWidth / paperWidth) so the FULL page fits the screen on open
  // instead of rendering at 1:1 (zoomed-in, showing only the left
  // portion — the v1.9.0 bug). User can still pinch to zoom in.
  const paperWidthPx = Math.round(PAPER_DIMENSIONS[paper].wIn * 96);
  const previewWidth = opts.previewWidthPx ?? 360;
  const fitScale = Math.min(1, previewWidth / paperWidthPx);
  const viewport = mode === 'preview'
    ? `<meta name="viewport" content="width=${paperWidthPx}, initial-scale=${fitScale.toFixed(4)}, minimum-scale=${fitScale.toFixed(4)}, maximum-scale=3.0, user-scalable=yes">`
    : `<meta name="viewport" content="width=${paperWidthPx}, initial-scale=1, user-scalable=yes">`;

  // Preview-mode JS paginator — splits one tall .rb-page into N paper-
  // sheet cards client-side after layout. PDF mode doesn't need it because
  // Chromium's print engine paginates via the @page + page-break-* CSS.
  const paginator = mode === 'preview' ? buildPaginatorScript(paper) : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
${viewport}
<title>${esc(resume.header.fullName || 'Resume')}</title>
<style>${baseStyles(t, paper, mode)}</style>
</head>
<body>
<div class="rb-page" data-page-number="1" data-page-total="1">
${body}
</div>
${paginator}
</body>
</html>`;
}

/**
 * Build the client-side JS paginator that splits a single overflowing
 * .rb-page into multiple paper-sheet cards. Runs once on DOMContentLoaded.
 *
 * Strategy:
 *   1. Find the .rb-page node.
 *   2. Walk its TOP-LEVEL children in order.
 *   3. As soon as adding the next child would push us past PAGE_HEIGHT,
 *      create a new .rb-page sibling and move the remaining children
 *      into it. Recurse for the new page.
 *   4. Update data-page-total on every page card so the "Page N of M"
 *      caption is accurate.
 *
 * Critical: we never split a child mid-way. If a single .rb-section is
 * taller than one page (a long Experience block with 10 bullets), it stays
 * on its own page and overflows the bottom — matching what the PDF print
 * engine does. Splitting individual sections would need a much more
 * complex layout pass that this Tier-1 paginator deliberately skips.
 */
function buildPaginatorScript(paper: EnginePaperSize): string {
  // CSS px @ 96dpi (the WebView's default zoom level).
  const pageHeightPx = Math.round(PAPER_DIMENSIONS[paper].hIn * 96);
  return `
<script>
(function () {
  var PAGE_H = ${pageHeightPx};
  function paginate() {
    var pages = document.querySelectorAll('.rb-page');
    // Start from the FIRST page each pass — we may have to split repeatedly.
    var page = pages[0];
    if (!page) return;
    // Only run if the first page actually overflows. Otherwise the resume
    // fits on one sheet and we leave the data-page-total='1' in place.
    if (page.scrollHeight <= PAGE_H + 4) {
      page.setAttribute('data-page-number', '1');
      page.setAttribute('data-page-total', '1');
      return;
    }
    // Walk the first page's children until we cross the boundary, then
    // move the overflow into a new page sibling.
    var children = Array.prototype.slice.call(page.children);
    var keep = [];
    var spill = [];
    var heightSoFar = 0;
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      var h = c.offsetHeight + parseFloat(getComputedStyle(c).marginBottom || '0');
      // If a single child is taller than the page (e.g. a long experience),
      // keep it on its current page rather than orphaning it on an empty
      // page above. The PDF engine handles its overflow.
      if (keep.length === 0 || heightSoFar + h <= PAGE_H) {
        keep.push(c);
        heightSoFar += h;
      } else {
        spill.push(c);
      }
    }
    if (spill.length === 0) return; // nothing actually overflowed
    // Build the next page and move spill into it.
    var next = document.createElement('div');
    next.className = page.className;
    // copy the per-layout class if present (e.g. rb-page-sidebar) — done
    // by className copy above. Append to body so it's a sibling.
    page.parentNode.insertBefore(next, page.nextSibling);
    for (var j = 0; j < spill.length; j++) {
      next.appendChild(spill[j]);
    }
    // Recurse: if 'next' itself overflows, the next paginate() pass splits
    // it. We avoid stack overflow with a hard cap of 8 pages (a 9-page
    // resume is broken anyway and we'd rather just truncate the loop).
    if (next.scrollHeight > PAGE_H + 4) {
      paginate();
    }
    // Number the pages.
    var allPages = document.querySelectorAll('.rb-page');
    for (var k = 0; k < allPages.length; k++) {
      allPages[k].setAttribute('data-page-number', String(k + 1));
      allPages[k].setAttribute('data-page-total', String(allPages.length));
    }
  }
  // Fonts must be loaded BEFORE we measure heights — Inter's metrics
  // differ from the system fallback enough to throw off the page split.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(paginate);
  } else if (document.readyState === 'complete') {
    paginate();
  } else {
    window.addEventListener('load', paginate);
  }
})();
</script>`.trim();
}

export default generatePremiumHTML;
