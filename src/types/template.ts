/**
 * Template Types for FreeResume AI
 */

export type TemplateCategory =
  | 'ats-optimized'
  | 'professional'
  | 'modern'
  | 'creative'
  | 'minimal';

export interface TemplateColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textLight: string;
  background: string;
  border: string;
}

export interface TemplateFonts {
  heading: string;
  body: string;
  headingWeight: string;
  bodyWeight: string;
}

export interface TemplateSpacing {
  sectionGap: number;
  itemGap: number;
  margins: number;
  headerPadding: number;
}

export interface TemplateLayout {
  headerStyle: 'centered' | 'left-aligned' | 'split' | 'banner';
  sectionStyle: 'underlined' | 'boxed' | 'simple' | 'sidebar';
  columns: 1 | 2;
  showPhoto: boolean;
  iconStyle: 'none' | 'minimal' | 'filled';
}

export interface TemplateStyles {
  colors: TemplateColors;
  fonts: TemplateFonts;
  spacing: TemplateSpacing;
  layout: TemplateLayout;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  atsScore: number;
  isPremium: boolean;
  thumbnail: string;
  previewColor: string;
  styles: TemplateStyles;
  tags: string[];
}

// Default template configurations
export const DEFAULT_TEMPLATE_STYLES: TemplateStyles = {
  colors: {
    primary: '#2563EB',
    secondary: '#1E40AF',
    accent: '#3B82F6',
    text: '#1F2937',
    textLight: '#6B7280',
    background: '#FFFFFF',
    border: '#E5E7EB',
  },
  fonts: {
    heading: 'Arial',
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
    headerStyle: 'centered',
    sectionStyle: 'underlined',
    columns: 1,
    showPhoto: false,
    iconStyle: 'none',
  },
};

// Category metadata
export const TEMPLATE_CATEGORIES: Record<TemplateCategory, {
  label: string;
  description: string;
  icon: string;
}> = {
  'ats-optimized': {
    label: 'ATS-Optimized',
    description: 'Best for automated screening systems',
    icon: '🎯',
  },
  'professional': {
    label: 'Professional',
    description: 'Classic designs for corporate roles',
    icon: '💼',
  },
  'modern': {
    label: 'Modern',
    description: 'Contemporary layouts with clean lines',
    icon: '✨',
  },
  'creative': {
    label: 'Creative',
    description: 'Stand out with unique designs',
    icon: '🎨',
  },
  'minimal': {
    label: 'Minimal',
    description: 'Simple and elegant layouts',
    icon: '📄',
  },
};
