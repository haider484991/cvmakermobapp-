/**
 * Design system (v1.11).
 *
 * The app had grown 17 distinct border radii, 3 screen-edge paddings, and 7
 * different screen-title size/weight combos — every screen re-invented its own
 * look. These tokens are the single source of truth; new UI should use them
 * (and the shared components in `@/components/ui`) rather than hand-rolled
 * numbers, so the product reads as one branded, coherent app.
 *
 * NOTE: theme.ts also exports `spacing`/`borderRadius`/`fontSize` scales that
 * nothing ever imported. These supersede them and reflect what the UI actually
 * needs.
 */

/** Corner radii — 5 steps, one purpose each. */
export const radius = {
  /** chips, tags, small badges */
  sm: 10,
  /** buttons, inputs, icon tiles */
  md: 14,
  /** cards, panels */
  lg: 18,
  /** bottom sheets, hero surfaces */
  xl: 24,
  /** fully rounded pills */
  pill: 100,
} as const;

/** Spacing scale (4pt grid). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Horizontal padding for screen content. One value, every screen. */
export const SCREEN_PADDING = 20;

/** Bottom padding for scroll views so content clears the tab bar / CTAs. */
export const SCROLL_BOTTOM = 32;
/** Bottom padding for scroll views that sit under a fixed bottom CTA bar. */
export const SCROLL_BOTTOM_WITH_CTA = 120;

/**
 * Type scale. Pair a size with its intended weight — mixing them is what
 * produced 7 different "screen title" treatments.
 */
export const type = {
  /** Onboarding / marketing hero */
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  /** Screen titles (tab headers) */
  title: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  /** Sub-screen / modal titles */
  titleSm: { fontSize: 18, fontWeight: '700' as const },
  /** Card + list-item titles */
  heading: { fontSize: 16, fontWeight: '700' as const },
  /** Emphasised body, button labels */
  strong: { fontSize: 15, fontWeight: '600' as const },
  /** Default body copy */
  body: { fontSize: 14, fontWeight: '400' as const },
  /** Secondary/supporting copy */
  caption: { fontSize: 13, fontWeight: '400' as const },
  /** Meta text, timestamps */
  meta: { fontSize: 12, fontWeight: '500' as const },
  /** Section labels — pair with textMuted + uppercase */
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1 },
} as const;

/** Consistent elevation for raised cards (subtle — we're not a game). */
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

/**
 * Standard alpha suffixes for tinting `colors.primary` (the codebase had 8
 * ad-hoc values from '08' to '40'). Append to a hex color.
 */
export const tint = {
  /** faint background wash */
  subtle: '12',
  /** icon tile / chip background */
  soft: '18',
  /** border on a tinted surface */
  border: '35',
} as const;

/** Minimum touch target (accessibility). */
export const MIN_TOUCH = 44;
