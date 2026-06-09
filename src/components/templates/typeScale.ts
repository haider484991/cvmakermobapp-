/**
 * Resume typography scale — single source of truth for type sizes
 * across all 10 RN preview components and (eventually) the HTML/PDF engine.
 *
 * Design rationale (deep-research 2026-05-27, confirmed multi-source):
 *   - Body 10-12pt with 11pt the consensus sweet spot (Figma resource
 *     library, Resume.io, Microsoft Word Blog, Novoresume, Indeed, Jobseeker,
 *     ATSResumeAI, Piktochart)
 *   - Section headings 14-18pt
 *   - Name often pushed to 18-24pt (Microsoft Word Blog)
 *   - In-app preview should scale UP for digital readability: 16px body,
 *     1.5 line-height (Schweitzer Designs / WCAG SC 1.4.12 / learnui.design)
 *     while keeping the proportional hierarchy intact
 *
 * Two scales:
 *   - SCREEN: what the RN preview renders (px on phone screens)
 *   - PRINT: what the PDF/HTML engine should emit (pt for US Letter/A4)
 *
 * The ratio between them is roughly 1.45x — 11pt PDF body ≈ 16px screen
 * body, so SCREEN_BODY=16 and PRINT_BODY=11 are the anchors.
 *
 * NEVER hardcode fontSize in a template. Always reference SCREEN.*.
 */

export const PRINT = {
  /** Display name at the top of the resume (Sarah Mitchell) */
  NAME: 24,
  /** Job title under the name */
  TITLE: 13,
  /** Section headings (EXPERIENCE, EDUCATION, etc.) */
  HEADING: 12,
  /** Subheadings within sections (job title at a company, degree name) */
  SUBHEADING: 11,
  /** Body paragraphs, descriptions, bullets */
  BODY: 11,
  /** Secondary text — company name, dates, location */
  SMALL: 10,
  /** Microcopy — caption labels, metadata */
  MICRO: 9,
} as const;

export const SCREEN = {
  NAME: 26,
  TITLE: 14,
  HEADING: 12,
  SUBHEADING: 15,
  BODY: 14,
  SMALL: 12,
  MICRO: 11,
} as const;

/**
 * Line-height multipliers per role. Computed to land on the 4pt baseline
 * for most common font-size combinations (e.g. 14px text × 1.43 ≈ 20px,
 * a 4×5 multiple). Body uses 1.5 per WCAG SC 1.4.12.
 */
export const LINE_HEIGHT = {
  /** Headings — tight to avoid spacing-heavy section titles */
  HEADING: 1.2,
  /** Subheadings — slight breathing room */
  SUBHEADING: 1.3,
  /** Body — WCAG-friendly 1.5 */
  BODY: 1.5,
  /** Compact rows (contact, dates) — minimal vertical space */
  TIGHT: 1.25,
} as const;

/**
 * Letter-spacing values for the small-caps treatment we use on section
 * headings ("EXPERIENCE", "EDUCATION"). Tracking opens up uppercase so
 * it doesn't read as shouty. Values are in pixels for React Native (which
 * uses absolute letterSpacing in points, not em).
 */
export const TRACKING = {
  /** Section heading uppercase ("EDUCATION") — generous breath */
  HEADING_UPPERCASE: 1.4,
  /** Display name — slight tighten for big sizes */
  NAME_DISPLAY: -0.4,
  /** Body — neutral */
  BODY: 0,
} as const;

/**
 * Font weights as React Native fontWeight strings. RN supports "100" through
 * "900" plus "normal" / "bold". Using the named weights so consumers can
 * read them: REGULAR / MEDIUM / SEMIBOLD / BOLD / HEAVY.
 *
 * IMPORTANT: when we use Inter via @expo-google-fonts/inter, the family
 * names map to specific weights:
 *   Inter_400Regular  → fontWeight '400' / 'normal' / REGULAR
 *   Inter_500Medium   → fontWeight '500' / MEDIUM
 *   Inter_600SemiBold → fontWeight '600' / SEMIBOLD
 *   Inter_700Bold     → fontWeight '700' / 'bold' / BOLD
 *   Inter_800ExtraBold→ fontWeight '800' / HEAVY
 *
 * Use `fontFamily: FONTS.body` together with `fontWeight: WEIGHT.SEMIBOLD`
 * and RN will pick the right Inter variant (provided that variant is loaded
 * via useFonts).
 */
export const WEIGHT = {
  REGULAR: '400',
  MEDIUM: '500',
  SEMIBOLD: '600',
  BOLD: '700',
  HEAVY: '800',
} as const;

/**
 * Font family registry. Keys are roles, values are RN fontFamily strings.
 * For Inter (the primary body face), RN actually needs the per-weight
 * family name (Inter_700Bold) rather than fontWeight to render correctly
 * with loaded Google Fonts — fontWeight alone falls back to the system
 * face. So expose both styles below.
 */
export const FONTS = {
  /** Default sans-serif body face — Inter via @expo-google-fonts/inter */
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyHeavy: 'Inter_800ExtraBold',
} as const;

/**
 * Convenience presets — common combinations templates reach for. Use these
 * to avoid restating fontFamily + fontWeight together at every Text node.
 *
 * Example:
 *   <Text style={[T.heading, { color: colors.primary }]}>EXPERIENCE</Text>
 */
export const T = {
  name: {
    fontFamily: FONTS.bodyBold,
    fontSize: SCREEN.NAME,
    fontWeight: WEIGHT.BOLD as '700',
    letterSpacing: TRACKING.NAME_DISPLAY,
    lineHeight: SCREEN.NAME * LINE_HEIGHT.HEADING,
  },
  title: {
    fontFamily: FONTS.body,
    fontSize: SCREEN.TITLE,
    fontWeight: WEIGHT.REGULAR as '400',
    lineHeight: SCREEN.TITLE * LINE_HEIGHT.TIGHT,
  },
  heading: {
    fontFamily: FONTS.bodyBold,
    fontSize: SCREEN.HEADING,
    fontWeight: WEIGHT.BOLD as '700',
    textTransform: 'uppercase' as const,
    letterSpacing: TRACKING.HEADING_UPPERCASE,
    lineHeight: SCREEN.HEADING * LINE_HEIGHT.HEADING,
  },
  subheading: {
    fontFamily: FONTS.bodySemibold,
    fontSize: SCREEN.SUBHEADING,
    fontWeight: WEIGHT.SEMIBOLD as '600',
    lineHeight: SCREEN.SUBHEADING * LINE_HEIGHT.SUBHEADING,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: SCREEN.BODY,
    fontWeight: WEIGHT.REGULAR as '400',
    lineHeight: SCREEN.BODY * LINE_HEIGHT.BODY,
  },
  small: {
    fontFamily: FONTS.body,
    fontSize: SCREEN.SMALL,
    fontWeight: WEIGHT.REGULAR as '400',
    lineHeight: SCREEN.SMALL * LINE_HEIGHT.TIGHT,
  },
  smallMedium: {
    fontFamily: FONTS.bodyMedium,
    fontSize: SCREEN.SMALL,
    fontWeight: WEIGHT.MEDIUM as '500',
    lineHeight: SCREEN.SMALL * LINE_HEIGHT.TIGHT,
  },
  micro: {
    fontFamily: FONTS.body,
    fontSize: SCREEN.MICRO,
    fontWeight: WEIGHT.REGULAR as '400',
    lineHeight: SCREEN.MICRO * LINE_HEIGHT.TIGHT,
  },
} as const;

/**
 * Spacing scale — 4pt baseline aligned with the typography (Material 4dp
 * typography baseline grid). Use these instead of magic numbers in template
 * layouts.
 */
export const SPACE = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  XXL: 24,
  XXXL: 32,
} as const;
