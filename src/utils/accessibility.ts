/**
 * Accessibility Utilities
 * Helpers for building accessible React Native components
 */

import { AccessibilityRole, AccessibilityState, Platform } from 'react-native';

/**
 * Common accessibility roles
 */
export const A11Y_ROLES = {
  button: 'button' as AccessibilityRole,
  link: 'link' as AccessibilityRole,
  header: 'header' as AccessibilityRole,
  text: 'text' as AccessibilityRole,
  image: 'image' as AccessibilityRole,
  search: 'search' as AccessibilityRole,
  checkbox: 'checkbox' as AccessibilityRole,
  radio: 'radiobutton' as AccessibilityRole,
  tab: 'tab' as AccessibilityRole,
  tablist: 'tablist' as AccessibilityRole,
  progressbar: 'progressbar' as AccessibilityRole,
  alert: 'alert' as AccessibilityRole,
  menu: 'menu' as AccessibilityRole,
  menuitem: 'menuitem' as AccessibilityRole,
  none: 'none' as AccessibilityRole,
};

/**
 * Generate accessibility props for a button
 */
export function getButtonA11yProps(
  label: string,
  options?: {
    hint?: string;
    disabled?: boolean;
    selected?: boolean;
    busy?: boolean;
  }
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
} {
  const props: {
    accessible: boolean;
    accessibilityRole: AccessibilityRole;
    accessibilityLabel: string;
    accessibilityHint?: string;
    accessibilityState?: AccessibilityState;
  } = {
    accessible: true,
    accessibilityRole: A11Y_ROLES.button,
    accessibilityLabel: label,
  };

  if (options?.hint) {
    props.accessibilityHint = options.hint;
  }

  if (options?.disabled !== undefined || options?.selected !== undefined || options?.busy !== undefined) {
    props.accessibilityState = {
      disabled: options?.disabled,
      selected: options?.selected,
      busy: options?.busy,
    };
  }

  return props;
}

/**
 * Generate accessibility props for a header
 */
export function getHeaderA11yProps(
  label: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 1
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
} {
  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.header,
    accessibilityLabel: label,
  };
}

/**
 * Generate accessibility props for an image
 */
export function getImageA11yProps(
  label: string,
  isDecorative = false
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
} | {
  accessible: boolean;
  accessibilityElementsHidden: boolean;
  importantForAccessibility: 'no-hide-descendants';
} {
  if (isDecorative) {
    return {
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants' as const,
    };
  }

  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.image,
    accessibilityLabel: label,
  };
}

/**
 * Generate accessibility props for a checkbox/toggle
 */
export function getCheckboxA11yProps(
  label: string,
  checked: boolean,
  hint?: string
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState: AccessibilityState;
} {
  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.checkbox,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityState: {
      checked,
    },
  };
}

/**
 * Generate accessibility props for a text input
 */
export function getInputA11yProps(
  label: string,
  options?: {
    hint?: string;
    error?: string;
    required?: boolean;
  }
): {
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
} {
  let accessibilityLabel = label;

  if (options?.required) {
    accessibilityLabel += ', required';
  }

  if (options?.error) {
    accessibilityLabel += `, error: ${options.error}`;
  }

  return {
    accessible: true,
    accessibilityLabel,
    accessibilityHint: options?.hint,
  };
}

/**
 * Generate accessibility props for a progress indicator
 */
export function getProgressA11yProps(
  label: string,
  current: number,
  max: number
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityValue: {
    now: number;
    min: number;
    max: number;
    text: string;
  };
} {
  const percentage = Math.round((current / max) * 100);

  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.progressbar,
    accessibilityLabel: label,
    accessibilityValue: {
      now: current,
      min: 0,
      max,
      text: `${percentage}% complete`,
    },
  };
}

/**
 * Generate accessibility props for a tab
 */
export function getTabA11yProps(
  label: string,
  selected: boolean,
  index: number,
  total: number
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityState: AccessibilityState;
} {
  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.tab,
    accessibilityLabel: `${label}, tab ${index + 1} of ${total}`,
    accessibilityState: {
      selected,
    },
  };
}

/**
 * Generate accessibility props for an alert/notification
 */
export function getAlertA11yProps(
  message: string,
  type: 'error' | 'warning' | 'success' | 'info' = 'info'
): {
  accessible: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  accessibilityLiveRegion: 'polite' | 'assertive' | 'none';
} {
  const prefix = {
    error: 'Error',
    warning: 'Warning',
    success: 'Success',
    info: 'Information',
  }[type];

  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.alert,
    accessibilityLabel: `${prefix}: ${message}`,
    accessibilityLiveRegion: type === 'error' ? 'assertive' : 'polite',
  };
}

/**
 * Generate accessibility props to hide decorative elements
 */
export function getDecorativeA11yProps(): {
  accessible: boolean;
  accessibilityElementsHidden: boolean;
  importantForAccessibility: 'no-hide-descendants';
} {
  return {
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };
}

/**
 * Format a number for screen readers
 */
export function formatNumberForA11y(value: number, unit?: string): string {
  const formatted = value.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format a date for screen readers
 */
export function formatDateForA11y(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Minimum touch target size (in dp)
 * WCAG recommends at least 44x44 points
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Check if a touch target meets minimum size requirements
 */
export function isValidTouchTarget(width: number, height: number): boolean {
  return width >= MIN_TOUCH_TARGET && height >= MIN_TOUCH_TARGET;
}

/**
 * Get platform-specific accessibility actions
 */
export function getA11yActions(actions: Array<{ name: string; label: string }>) {
  return Platform.select({
    ios: {
      accessibilityActions: actions,
    },
    android: {
      accessibilityActions: actions.map(a => ({
        name: a.name,
        label: a.label,
      })),
    },
    default: {},
  });
}
