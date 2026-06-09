import { create } from 'zustand';
import { ResumeTemplate, TemplateCategory, TemplateStyles } from '@/types/template';

/**
 * 10 Professional Resume Templates
 */
const TEMPLATES: ResumeTemplate[] = [
  // ATS-Optimized Templates
  {
    id: 'ats-classic',
    name: 'ATS Classic',
    description: 'Maximum ATS compatibility with clean formatting',
    category: 'ats-optimized',
    atsScore: 100,
    isPremium: false,
    thumbnail: '',
    previewColor: '#1F2937',
    tags: ['ats-friendly', 'simple', 'corporate'],
    styles: {
      colors: {
        primary: '#1F2937',
        secondary: '#374151',
        accent: '#1F2937',
        text: '#1F2937',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#D1D5DB',
      },
      fonts: {
        heading: 'Arial',
        body: 'Arial',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 18,
        itemGap: 10,
        margins: 48,
        headerPadding: 20,
      },
      layout: {
        headerStyle: 'left-aligned',
        sectionStyle: 'underlined',
        columns: 1,
        showPhoto: false,
        iconStyle: 'none',
      },
    },
  },
  {
    id: 'ats-professional',
    name: 'ATS Professional',
    description: 'Professional look with perfect ATS parsing',
    category: 'ats-optimized',
    atsScore: 98,
    isPremium: false,
    thumbnail: '',
    previewColor: '#1E3A5F',
    tags: ['ats-friendly', 'professional', 'steel-blue'],
    styles: {
      // PALETTE: Refined steel blue, deliberately darker than the generic
      // Bootstrap #2563EB. Mono ink-charcoal body keeps the resume
      // legible at print size; #475569 slate-grey textLight reads with
      // more authority than the default #6B7280. Hairline border in
      // pale slate, not blue-washed, so the page reads "professional"
      // not "branded".
      colors: {
        primary: '#1E3A5F',
        secondary: '#334155',
        accent: '#3B82F6',
        text: '#0F172A',
        textLight: '#475569',
        background: '#FFFFFF',
        border: '#E2E8F0',
      },
      fonts: {
        heading: 'Georgia',
        body: 'Arial',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 20,
        itemGap: 12,
        margins: 44,
        headerPadding: 24,
      },
      layout: {
        headerStyle: 'centered',
        sectionStyle: 'underlined',
        columns: 1,
        showPhoto: false,
        iconStyle: 'none',
      },
    },
  },

  // Professional Templates
  {
    id: 'executive',
    name: 'Executive',
    description: 'Sophisticated design for senior positions',
    category: 'professional',
    atsScore: 95,
    isPremium: false,
    thumbnail: '',
    previewColor: '#0F172A',
    tags: ['executive', 'senior', 'corporate'],
    styles: {
      colors: {
        primary: '#0F172A',
        secondary: '#1E293B',
        accent: '#334155',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#CBD5E1',
      },
      fonts: {
        heading: 'Georgia',
        body: 'Garamond',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 24,
        itemGap: 14,
        margins: 50,
        headerPadding: 28,
      },
      layout: {
        headerStyle: 'centered',
        sectionStyle: 'simple',
        columns: 1,
        showPhoto: false,
        iconStyle: 'none',
      },
    },
  },
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Traditional corporate style with navy accents',
    category: 'professional',
    atsScore: 94,
    isPremium: false,
    thumbnail: '',
    previewColor: '#1E3A5F',
    tags: ['corporate', 'traditional', 'navy'],
    styles: {
      colors: {
        primary: '#1E3A5F',
        secondary: '#2D4A6F',
        accent: '#3D5A80',
        text: '#1E3A5F',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#B8C5D6',
      },
      fonts: {
        heading: 'Calibri',
        body: 'Calibri',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 20,
        itemGap: 12,
        margins: 44,
        headerPadding: 24,
      },
      layout: {
        headerStyle: 'banner',
        sectionStyle: 'underlined',
        columns: 1,
        showPhoto: false,
        iconStyle: 'minimal',
      },
    },
  },

  // Modern Templates
  {
    id: 'modern-tech',
    name: 'Modern Tech',
    description: 'Clean design perfect for tech industry',
    category: 'modern',
    atsScore: 92,
    isPremium: true,
    thumbnail: '',
    previewColor: '#7C3AED',
    tags: ['tech', 'modern', 'purple'],
    styles: {
      colors: {
        primary: '#7C3AED',
        secondary: '#6D28D9',
        accent: '#8B5CF6',
        text: '#1F2937',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#E9D5FF',
      },
      fonts: {
        heading: 'Helvetica',
        body: 'Helvetica',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 22,
        itemGap: 12,
        margins: 40,
        headerPadding: 24,
      },
      layout: {
        headerStyle: 'left-aligned',
        sectionStyle: 'boxed',
        columns: 1,
        showPhoto: false,
        iconStyle: 'filled',
      },
    },
  },
  {
    id: 'sleek-gradient',
    name: 'Sleek',
    description: 'Contemporary style with subtle gradients',
    category: 'modern',
    atsScore: 88,
    isPremium: true,
    thumbnail: '',
    previewColor: '#0891B2',
    tags: ['modern', 'gradient', 'teal'],
    styles: {
      colors: {
        primary: '#0891B2',
        secondary: '#0E7490',
        accent: '#06B6D4',
        text: '#1F2937',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#CFFAFE',
      },
      fonts: {
        heading: 'Arial',
        body: 'Arial',
        headingWeight: '600',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 20,
        itemGap: 10,
        margins: 36,
        headerPadding: 20,
      },
      layout: {
        headerStyle: 'split',
        sectionStyle: 'simple',
        columns: 1,
        showPhoto: true,
        iconStyle: 'minimal',
      },
    },
  },

  // Creative Templates
  {
    id: 'creative-bold',
    name: 'Creative Bold',
    description: 'Stand out with bold colors and layout',
    category: 'creative',
    atsScore: 75,
    isPremium: true,
    thumbnail: '',
    previewColor: '#DC2626',
    tags: ['creative', 'bold', 'red'],
    styles: {
      colors: {
        primary: '#DC2626',
        secondary: '#B91C1C',
        accent: '#EF4444',
        text: '#1F2937',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#FECACA',
      },
      fonts: {
        heading: 'Helvetica',
        body: 'Helvetica',
        headingWeight: '800',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 24,
        itemGap: 14,
        margins: 36,
        headerPadding: 28,
      },
      layout: {
        headerStyle: 'banner',
        sectionStyle: 'boxed',
        columns: 2,
        showPhoto: true,
        iconStyle: 'filled',
      },
    },
  },
  {
    id: 'designer-pink',
    name: 'Designer',
    description: 'Perfect for designers and creatives',
    category: 'creative',
    atsScore: 70,
    isPremium: true,
    thumbnail: '',
    previewColor: '#DB2777',
    tags: ['designer', 'creative', 'pink'],
    styles: {
      colors: {
        primary: '#DB2777',
        secondary: '#BE185D',
        accent: '#EC4899',
        text: '#1F2937',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#FBCFE8',
      },
      fonts: {
        heading: 'Georgia',
        body: 'Arial',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 20,
        itemGap: 12,
        margins: 40,
        headerPadding: 24,
      },
      layout: {
        headerStyle: 'split',
        sectionStyle: 'simple',
        columns: 2,
        showPhoto: true,
        iconStyle: 'minimal',
      },
    },
  },

  // Minimal Templates
  {
    id: 'minimal-clean',
    name: 'Minimal Clean',
    description: 'Elegant simplicity with focus on content',
    category: 'minimal',
    atsScore: 96,
    isPremium: false,
    thumbnail: '',
    previewColor: '#374151',
    tags: ['minimal', 'clean', 'simple'],
    styles: {
      colors: {
        primary: '#374151',
        secondary: '#4B5563',
        accent: '#6B7280',
        text: '#1F2937',
        textLight: '#9CA3AF',
        background: '#FFFFFF',
        border: '#E5E7EB',
      },
      fonts: {
        heading: 'Helvetica',
        body: 'Helvetica',
        headingWeight: '600',
        bodyWeight: '300',
      },
      spacing: {
        sectionGap: 24,
        itemGap: 14,
        margins: 52,
        headerPadding: 20,
      },
      layout: {
        headerStyle: 'left-aligned',
        sectionStyle: 'simple',
        columns: 1,
        showPhoto: false,
        iconStyle: 'none',
      },
    },
  },
  {
    id: 'swiss-style',
    name: 'Swiss Style',
    description: 'Inspired by Swiss design principles',
    category: 'minimal',
    atsScore: 94,
    isPremium: false,
    thumbnail: '',
    previewColor: '#18181B',
    tags: ['swiss', 'minimal', 'typography'],
    styles: {
      colors: {
        primary: '#18181B',
        secondary: '#27272A',
        accent: '#3F3F46',
        text: '#18181B',
        textLight: '#71717A',
        background: '#FFFFFF',
        border: '#E4E4E7',
      },
      fonts: {
        heading: 'Helvetica',
        body: 'Helvetica',
        headingWeight: '700',
        bodyWeight: '400',
      },
      spacing: {
        sectionGap: 28,
        itemGap: 16,
        margins: 56,
        headerPadding: 24,
      },
      layout: {
        headerStyle: 'left-aligned',
        sectionStyle: 'underlined',
        columns: 1,
        showPhoto: false,
        iconStyle: 'none',
      },
    },
  },

  /* ------------------------------------------------------------------------
   * v1.3 — Premium template additions
   *
   * Each entry below maps to a distinct layout in `premiumHtmlEngine`'s
   * THEME_OVERRIDES (matched by `id`). They are NOT color-swap clones —
   * the engine routes them to different layout renderers (sidebar, banner,
   * timeline, two-column, etc.) with deliberate typographic pairings.
   * ------------------------------------------------------------------------ */

  // ---- PROFESSIONAL ----
  {
    id: 'modern-pro',
    name: 'Modern Pro',
    description: 'Dark left sidebar with photo, polished navy accents',
    category: 'professional',
    atsScore: 90,
    isPremium: false,
    thumbnail: '',
    previewColor: '#0F2A4A',
    tags: ['sidebar', 'photo', 'professional', 'navy'],
    styles: {
      colors: {
        primary: '#0F2A4A',
        secondary: '#1E3A5F',
        accent: '#2563EB',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#E2E8F0',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: true, iconStyle: 'minimal' },
    },
  },
  {
    id: 'modern-pro-right',
    name: 'Modern Pro · Right',
    description: 'Mirror sidebar on the right — content-led with contact rail',
    category: 'professional',
    atsScore: 89,
    isPremium: false,
    thumbnail: '',
    previewColor: '#14532D',
    tags: ['sidebar', 'photo', 'green', 'professional'],
    styles: {
      colors: {
        primary: '#14532D',
        secondary: '#166534',
        accent: '#22C55E',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#DCFCE7',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: true, iconStyle: 'minimal' },
    },
  },
  {
    id: 'consultant',
    name: 'Consultant',
    description: 'Boxed accent sections — board-room ready',
    category: 'professional',
    atsScore: 96,
    isPremium: false,
    thumbnail: '',
    previewColor: '#0C4A6E',
    tags: ['consulting', 'corporate', 'cyan'],
    styles: {
      colors: {
        primary: '#0C4A6E',
        secondary: '#075985',
        accent: '#0EA5E9',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#CBD5E1',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 22, itemGap: 14, margins: 48, headerPadding: 24 },
      layout: { headerStyle: 'left-aligned', sectionStyle: 'boxed', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },
  {
    id: 'finance-navy',
    name: 'Finance Navy',
    description: 'Conservative serif-and-block design for finance roles',
    category: 'professional',
    atsScore: 97,
    isPremium: false,
    thumbnail: '',
    previewColor: '#172554',
    tags: ['finance', 'banking', 'serif', 'navy', 'brass'],
    styles: {
      // PALETTE: Sophisticated bottle navy + brass accent. The hex is
      // pulled from the cover of Bloomberg Businessweek's archive issues
      // — it reads as "Wall Street" without being literal. Brass #B08D57
      // accent for section underlines + the date column adds the only
      // warmth on the page; everything else is mono. Pale champagne
      // border #E8E1D3 instead of the old icy lavender, which clashed
      // with the navy.
      colors: {
        primary: '#172554',
        secondary: '#1E3A8A',
        accent: '#B08D57',
        text: '#0F1729',
        textLight: '#475569',
        background: '#FFFFFF',
        border: '#E8E1D3',
      },
      fonts: { heading: 'Georgia', body: 'Georgia', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 22, itemGap: 12, margins: 48, headerPadding: 24 },
      layout: { headerStyle: 'left-aligned', sectionStyle: 'boxed', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },

  // ---- MODERN ----
  {
    id: 'startup-bold',
    name: 'Startup Bold',
    description: 'Full-width orange banner — for builders and operators',
    category: 'modern',
    atsScore: 88,
    isPremium: false,
    thumbnail: '',
    previewColor: '#EA580C',
    tags: ['startup', 'bold', 'orange'],
    styles: {
      colors: {
        primary: '#EA580C',
        secondary: '#C2410C',
        accent: '#FB923C',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#FED7AA',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'banner', sectionStyle: 'simple', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },
  {
    id: 'engineer-mono',
    name: 'Engineer · Mono',
    description: 'Monospace body, terminal-inspired sidebar — for engineers',
    category: 'modern',
    atsScore: 86,
    isPremium: true,
    thumbnail: '',
    previewColor: '#0F172A',
    tags: ['developer', 'engineer', 'monospace', 'tech'],
    styles: {
      colors: {
        primary: '#0F172A',
        secondary: '#1E293B',
        accent: '#10B981',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#E2E8F0',
      },
      fonts: { heading: 'Helvetica', body: 'Courier', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: false, iconStyle: 'none' },
    },
  },
  {
    id: 'sales-energetic',
    name: 'Sales Energetic',
    description: 'High-energy red banner — for sales and BD leaders',
    category: 'modern',
    atsScore: 87,
    isPremium: false,
    thumbnail: '',
    previewColor: '#B91C1C',
    tags: ['sales', 'energetic', 'red'],
    styles: {
      colors: {
        primary: '#B91C1C',
        secondary: '#991B1B',
        accent: '#EF4444',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#FECACA',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'banner', sectionStyle: 'simple', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },
  {
    id: 'product-manager',
    name: 'Product Manager',
    description: 'Indigo sidebar with photo, balanced sections — for PMs',
    category: 'modern',
    atsScore: 90,
    isPremium: true,
    thumbnail: '',
    previewColor: '#4338CA',
    tags: ['product', 'manager', 'indigo', 'sidebar'],
    styles: {
      colors: {
        primary: '#4338CA',
        secondary: '#3730A3',
        accent: '#6366F1',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#E0E7FF',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: true, iconStyle: 'minimal' },
    },
  },
  {
    id: 'marketing-lead',
    name: 'Marketing Lead',
    description: 'Magenta split header with bold display type',
    category: 'modern',
    atsScore: 86,
    isPremium: true,
    thumbnail: '',
    previewColor: '#A21CAF',
    tags: ['marketing', 'magenta', 'creative'],
    styles: {
      colors: {
        primary: '#A21CAF',
        secondary: '#86198F',
        accent: '#D946EF',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#F5D0FE',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'simple', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },

  // ---- CREATIVE ----
  {
    id: 'designer-grid',
    name: 'Designer Grid',
    description: 'Two-column layout with pill accents — for designers',
    category: 'creative',
    atsScore: 78,
    isPremium: true,
    thumbnail: '',
    previewColor: '#F59E0B',
    tags: ['designer', 'creative', 'two-column', 'amber'],
    styles: {
      colors: {
        primary: '#B45309',
        secondary: '#92400E',
        accent: '#F59E0B',
        text: '#0F172A',
        textLight: '#64748B',
        background: '#FFFFFF',
        border: '#FDE68A',
      },
      fonts: { heading: 'Georgia', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 18, itemGap: 12, margins: 44, headerPadding: 20 },
      layout: { headerStyle: 'left-aligned', sectionStyle: 'simple', columns: 2, showPhoto: false, iconStyle: 'minimal' },
    },
  },
  {
    id: 'timeline-pro',
    name: 'Timeline Pro',
    description: 'Vertical timeline rail through experience and education',
    category: 'creative',
    atsScore: 82,
    isPremium: true,
    thumbnail: '',
    previewColor: '#6D28D9',
    tags: ['timeline', 'creative', 'plum'],
    styles: {
      // PALETTE: Muted plum, not bright purple. The previous #9333EA was
      // saturated to the point of feeling juvenile; #6D28D9 reads as a
      // mature, considered color choice you'd see on Substack or
      // Notion's editorial pages. Secondary deepens to aubergine for
      // contrast on the timeline rail dots; accent softens slightly so
      // hover/secondary elements don't compete with the primary timeline.
      colors: {
        primary: '#6D28D9',
        secondary: '#4C1D95',
        accent: '#8B5CF6',
        text: '#1E1B29',
        textLight: '#5B4F6B',
        background: '#FFFFFF',
        border: '#EDE9FE',
      },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 14, margins: 48, headerPadding: 24 },
      layout: { headerStyle: 'left-aligned', sectionStyle: 'simple', columns: 1, showPhoto: false, iconStyle: 'minimal' },
    },
  },

  // ---- MINIMAL / ACADEMIC ----
  {
    id: 'academic-serif',
    name: 'Academic Serif',
    description: 'Traditional Playfair display + Georgia body — for academia',
    category: 'minimal',
    atsScore: 99,
    isPremium: false,
    thumbnail: '',
    previewColor: '#1F2937',
    tags: ['academic', 'serif', 'scholarly'],
    styles: {
      colors: {
        primary: '#1F2937',
        secondary: '#374151',
        accent: '#6B7280',
        text: '#111827',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#E5E7EB',
      },
      fonts: { heading: 'Georgia', body: 'Georgia', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 26, itemGap: 16, margins: 56, headerPadding: 24 },
      layout: { headerStyle: 'centered', sectionStyle: 'underlined', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },

  /* ------------------------------------------------------------------------
   * v1.9.7 — New premium templates designed to be "worth paying for": they
   * add the things the original 22 never had — visual skill PROFICIENCY BARS,
   * 5-dot RATINGS, and ICON contact rows. The premiumHtmlEngine renders these
   * via skillStyle / contactStyle set in THEME_OVERRIDES (keyed by id below).
   * ------------------------------------------------------------------------ */
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Indigo sidebar with photo, skill bars, and icon contacts',
    category: 'modern',
    atsScore: 88,
    isPremium: true,
    thumbnail: '',
    previewColor: '#4F46E5',
    tags: ['modern', 'infographic', 'skill-bars', 'indigo', 'photo'],
    styles: {
      colors: { primary: '#4F46E5', secondary: '#4338CA', accent: '#6366F1', text: '#0F172A', textLight: '#64748B', background: '#FFFFFF', border: '#E0E7FF' },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: true, iconStyle: 'minimal' },
    },
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Near-black sidebar, electric cyan accents, skill bars',
    category: 'modern',
    atsScore: 85,
    isPremium: true,
    thumbnail: '',
    previewColor: '#0F172A',
    tags: ['dark', 'tech', 'skill-bars', 'cyan', 'developer'],
    styles: {
      colors: { primary: '#0891B2', secondary: '#0E7490', accent: '#06B6D4', text: '#0F172A', textLight: '#64748B', background: '#FFFFFF', border: '#CFFAFE' },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: true, iconStyle: 'minimal' },
    },
  },
  {
    id: 'vivid',
    name: 'Vivid',
    description: 'Teal right sidebar with rating dots and icon contacts',
    category: 'creative',
    atsScore: 84,
    isPremium: true,
    thumbnail: '',
    previewColor: '#0D9488',
    tags: ['creative', 'teal', 'rating-dots', 'photo', 'sidebar-right'],
    styles: {
      colors: { primary: '#0D9488', secondary: '#0F766E', accent: '#14B8A6', text: '#0F172A', textLight: '#64748B', background: '#FFFFFF', border: '#CCFBF1' },
      fonts: { heading: 'Helvetica', body: 'Helvetica', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 20, itemGap: 12, margins: 0, headerPadding: 0 },
      layout: { headerStyle: 'split', sectionStyle: 'sidebar', columns: 2, showPhoto: true, iconStyle: 'minimal' },
    },
  },
  {
    id: 'luxe',
    name: 'Luxe',
    description: 'Editorial serif masthead with airy, refined spacing',
    category: 'professional',
    atsScore: 96,
    isPremium: true,
    thumbnail: '',
    previewColor: '#18181B',
    tags: ['editorial', 'serif', 'luxury', 'executive', 'minimal'],
    styles: {
      colors: { primary: '#18181B', secondary: '#3F3F46', accent: '#A1824A', text: '#18181B', textLight: '#6B7280', background: '#FFFFFF', border: '#E7E5E4' },
      fonts: { heading: 'Georgia', body: 'Georgia', headingWeight: '700', bodyWeight: '400' },
      spacing: { sectionGap: 26, itemGap: 16, margins: 54, headerPadding: 26 },
      layout: { headerStyle: 'centered', sectionStyle: 'underlined', columns: 1, showPhoto: false, iconStyle: 'none' },
    },
  },
];

interface TemplateState {
  templates: ResumeTemplate[];
  selectedTemplateId: string | null;
  filterCategory: TemplateCategory | 'all';

  // Actions
  setSelectedTemplate: (id: string | null) => void;
  setFilterCategory: (category: TemplateCategory | 'all') => void;

  // Getters
  getTemplate: (id: string) => ResumeTemplate | undefined;
  getTemplatesByCategory: (category: TemplateCategory | 'all') => ResumeTemplate[];
  getFreeTemplates: () => ResumeTemplate[];
  getPremiumTemplates: () => ResumeTemplate[];
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: TEMPLATES,
  selectedTemplateId: 'ats-classic',
  filterCategory: 'all',

  setSelectedTemplate: (id) => set({ selectedTemplateId: id }),
  setFilterCategory: (category) => set({ filterCategory: category }),

  getTemplate: (id) => get().templates.find((t) => t.id === id),

  getTemplatesByCategory: (category) => {
    const { templates } = get();
    if (category === 'all') return templates;
    return templates.filter((t) => t.category === category);
  },

  getFreeTemplates: () => get().templates.filter((t) => !t.isPremium),
  getPremiumTemplates: () => get().templates.filter((t) => t.isPremium),
}));

export { TEMPLATES };
