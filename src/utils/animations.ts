/**
 * Animation Utilities
 * Shared animation configurations and helpers for consistent animations
 */

import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/**
 * Spring configurations for different animation types
 */
export const SPRING_CONFIGS = {
  /** Snappy spring for quick interactions */
  snappy: {
    damping: 15,
    stiffness: 300,
    mass: 0.8,
  } as WithSpringConfig,

  /** Gentle spring for smooth transitions */
  gentle: {
    damping: 20,
    stiffness: 150,
    mass: 1,
  } as WithSpringConfig,

  /** Bouncy spring for playful animations */
  bouncy: {
    damping: 10,
    stiffness: 200,
    mass: 0.6,
  } as WithSpringConfig,

  /** Stiff spring for precise movements */
  stiff: {
    damping: 25,
    stiffness: 400,
    mass: 0.5,
  } as WithSpringConfig,

  /** Default spring for general use */
  default: {
    damping: 18,
    stiffness: 250,
    mass: 0.9,
  } as WithSpringConfig,
};

/**
 * Timing configurations for different animation types
 */
export const TIMING_CONFIGS = {
  /** Fast timing for quick feedback */
  fast: {
    duration: 150,
    easing: Easing.out(Easing.quad),
  } as WithTimingConfig,

  /** Medium timing for standard animations */
  medium: {
    duration: 300,
    easing: Easing.inOut(Easing.quad),
  } as WithTimingConfig,

  /** Slow timing for deliberate transitions */
  slow: {
    duration: 500,
    easing: Easing.inOut(Easing.cubic),
  } as WithTimingConfig,

  /** Enter timing for elements appearing */
  enter: {
    duration: 400,
    easing: Easing.out(Easing.back(1.5)),
  } as WithTimingConfig,

  /** Exit timing for elements disappearing */
  exit: {
    duration: 250,
    easing: Easing.in(Easing.quad),
  } as WithTimingConfig,
};

/**
 * Standard delays for staggered animations
 */
export const STAGGER_DELAYS = {
  fast: 50,
  medium: 100,
  slow: 150,
};

/**
 * Calculate staggered delay for list items
 */
export function getStaggerDelay(index: number, baseDelay = 100, maxDelay = 600): number {
  return Math.min(index * baseDelay, maxDelay);
}

/**
 * Animation durations in milliseconds
 */
export const DURATIONS = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 800,
};

/**
 * Common entering animation delays
 */
export const ENTERING_DELAYS = {
  header: 0,
  content: 100,
  features: 200,
  actions: 300,
  footer: 400,
};

/**
 * Confetti particle configuration
 */
export interface ConfettiConfig {
  count: number;
  colors: string[];
  duration: number;
  spread: number;
}

export const DEFAULT_CONFETTI_CONFIG: ConfettiConfig = {
  count: 50,
  colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'],
  duration: 3000,
  spread: 360,
};

/**
 * Page transition configurations
 */
export const PAGE_TRANSITIONS = {
  fadeSlide: {
    entering: {
      opacity: { from: 0, to: 1 },
      translateX: { from: 20, to: 0 },
    },
    exiting: {
      opacity: { from: 1, to: 0 },
      translateX: { from: 0, to: -20 },
    },
    duration: 300,
  },
  scale: {
    entering: {
      opacity: { from: 0, to: 1 },
      scale: { from: 0.95, to: 1 },
    },
    exiting: {
      opacity: { from: 1, to: 0 },
      scale: { from: 1, to: 0.95 },
    },
    duration: 250,
  },
};
