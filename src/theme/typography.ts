/**
 * Typography scale from the Stitch design system.
 * Fonts: Lexend (headlines/display), Plus Jakarta Sans (body/labels).
 *
 * Scale follows "Soft Editorialism" — large, legible, breathable.
 * Minimum body text: 16px. No core UX text below this.
 *
 * IMPORTANT: React Native ignores fontWeight for custom fonts loaded via
 * expo-font. Each weight variant must use the exact font family name that
 * matches the file registered in useFonts (e.g. 'Lexend-Bold', not 'Lexend'
 * + fontWeight:'700'). fontWeight is omitted here to avoid platform confusion.
 */

export const typography = {
  // Display — countdown timers, large dosage numbers
  displayLg: {
    fontFamily: 'Lexend-Light',   // 300
    fontSize: 56,
    lineHeight: 64,
  },
  displayMd: {
    fontFamily: 'Lexend',         // 400
    fontSize: 45,
    lineHeight: 52,
  },
  displaySm: {
    fontFamily: 'Lexend',         // 400
    fontSize: 36,
    lineHeight: 44,
  },

  // Headlines — medication names, section titles
  headlineLg: {
    fontFamily: 'Lexend-SemiBold', // 600
    fontSize: 32,
    lineHeight: 40,
  },
  headlineMd: {
    fontFamily: 'Lexend-SemiBold', // 600
    fontSize: 28,
    lineHeight: 36,
  },
  headlineSm: {
    fontFamily: 'Lexend-Medium',   // 500
    fontSize: 24,
    lineHeight: 32,
  },

  // Title — button text, card titles, section headers
  // Stitch uses font-headline (Lexend) for all titles, not just headlines
  titleLg: {
    fontFamily: 'Lexend-SemiBold', // 600
    fontSize: 22,
    lineHeight: 28,
  },
  titleMd: {
    fontFamily: 'Lexend-SemiBold', // 600
    fontSize: 18,
    lineHeight: 24,
  },
  titleSm: {
    fontFamily: 'Lexend-Medium', // 500
    fontSize: 14,
    lineHeight: 20,
  },

  // Body — instructional text, descriptions
  bodyLg: {
    fontFamily: 'PlusJakartaSans', // 400
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'PlusJakartaSans', // 400
    fontSize: 14,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'PlusJakartaSans', // 400
    fontSize: 12,
    lineHeight: 16,
  },

  // Label — metadata, secondary info
  labelLg: {
    fontFamily: 'PlusJakartaSans-Medium', // 500
    fontSize: 14,
    lineHeight: 20,
  },
  labelMd: {
    fontFamily: 'PlusJakartaSans-Medium', // 500
    fontSize: 12,
    lineHeight: 16,
  },
  labelSm: {
    fontFamily: 'PlusJakartaSans-Medium', // 500
    fontSize: 11,
    lineHeight: 16,
  },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Kept for backwards-compat with index.ts re-export; use the named font strings directly. */
export const fontFamilies = {
  headline: 'Lexend',
  body: 'PlusJakartaSans',
  label: 'PlusJakartaSans',
} as const;
