export const colors = {
  light: {
    primary: '#0891B2',
    primaryLight: '#06B6D4',
    primaryDark: '#0E7490',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceSecondary: '#F3F4F6',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    primary: '#06B6D4',
    primaryLight: '#22D3EE',
    primaryDark: '#0891B2',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    borderLight: '#1E293B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

// Brand gradient colors (teal to blue)
export const gradientColors = {
  // Main gradient: teal → cyan → blue
  primary: ['#14B8A6', '#0EA5E9', '#2563EB'] as const,
  // Lighter variant
  light: ['#5EEAD4', '#67E8F9', '#93C5FD'] as const,
  // Darker variant
  dark: ['#0D9488', '#0891B2', '#1D4ED8'] as const,
  // Glass card background
  glass: 'rgba(255, 255, 255, 0.15)',
  glassBorder: 'rgba(255, 255, 255, 0.25)',
  glassLight: 'rgba(255, 255, 255, 0.9)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
