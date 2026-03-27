/**
 * Spacing scale and layout constants.
 * Minimum touch target: 48px (accessibility requirement).
 */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48, // Minimum touch target
  16: 64, // Primary button height
  20: 80,
  24: 96,
} as const;

export const borderRadius = {
  sm: 4,   // 0.25rem
  md: 8,   // 0.5rem
  lg: 12,  // 0.75rem
  xl: 24,  // 1.5rem — primary buttons
  full: 9999,
} as const;

export const MIN_TOUCH_TARGET = 48;
export const PRIMARY_BUTTON_HEIGHT = 64;
