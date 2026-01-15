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
    previewColor: '#2563EB',
    tags: ['ats-friendly', 'professional', 'blue'],
    styles: {
      colors: {
        primary: '#2563EB',
        secondary: '#1D4ED8',
        accent: '#3B82F6',
        text: '#1F2937',
        textLight: '#6B7280',
        background: '#FFFFFF',
        border: '#DBEAFE',
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
