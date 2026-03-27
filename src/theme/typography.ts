/**
 * Typography scale from the Stitch design system.
 * Fonts: Lexend (headlines/display), Plus Jakarta Sans (body/labels).
 *
 * Scale follows "Soft Editorialism" — large, legible, breathable.
 * Minimum body text: 16px. No core UX text below this.
 */

export const fontFamilies = {
  headline: 'Lexend',
  body: 'PlusJakartaSans',
  label: 'PlusJakartaSans',
} as const;

export const typography = {
  // Display — countdown timers, large dosage numbers
  displayLg: {
    fontFamily: fontFamilies.headline,
    fontSize: 56, // 3.5rem
    fontWeight: '300' as const,
    lineHeight: 64,
  },
  displayMd: {
    fontFamily: fontFamilies.headline,
    fontSize: 45, // 2.8125rem
    fontWeight: '400' as const,
    lineHeight: 52,
  },
  displaySm: {
    fontFamily: fontFamilies.headline,
    fontSize: 36, // 2.25rem
    fontWeight: '400' as const,
    lineHeight: 44,
  },

  // Headlines — medication names, section titles
  headlineLg: {
    fontFamily: fontFamilies.headline,
    fontSize: 32, // 2rem
    fontWeight: '600' as const,
    lineHeight: 40,
  },
  headlineMd: {
    fontFamily: fontFamilies.headline,
    fontSize: 28, // 1.75rem
    fontWeight: '600' as const,
    lineHeight: 36,
  },
  headlineSm: {
    fontFamily: fontFamilies.headline,
    fontSize: 24, // 1.5rem
    fontWeight: '500' as const,
    lineHeight: 32,
  },

  // Title — button text, card titles
  titleLg: {
    fontFamily: fontFamilies.body,
    fontSize: 22, // 1.375rem
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  titleMd: {
    fontFamily: fontFamilies.body,
    fontSize: 18, // 1.125rem
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  titleSm: {
    fontFamily: fontFamilies.body,
    fontSize: 14, // 0.875rem
    fontWeight: '600' as const,
    lineHeight: 20,
  },

  // Body — instructional text, descriptions
  bodyLg: {
    fontFamily: fontFamilies.body,
    fontSize: 16, // 1rem — minimum for core UX
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: fontFamilies.body,
    fontSize: 14, // 0.875rem
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: fontFamilies.body,
    fontSize: 12, // 0.75rem
    fontWeight: '400' as const,
    lineHeight: 16,
  },

  // Label — metadata, secondary info
  labelLg: {
    fontFamily: fontFamilies.label,
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  labelMd: {
    fontFamily: fontFamilies.label,
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  labelSm: {
    fontFamily: fontFamilies.label,
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
