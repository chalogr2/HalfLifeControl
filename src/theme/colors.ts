/**
 * Color tokens extracted from the Stitch design system (Material Design 3).
 * Source: docs/stitch_halflifecontrol_html/vitality_clear/DESIGN.md
 *
 * Tonal hierarchy for depth (no borders — use background shifts):
 *   Ground:  surface (#faf9fc)
 *   Level 1: surface-container-low (#f4f3f6)
 *   Level 2: surface-container-lowest (#ffffff)  — cards
 *   Level 3: surface-bright (#faf9fc) — active/pressed
 */

export const colors = {
  // Primary
  primary: '#004d64',
  primaryContainer: '#006684',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#a2e1ff',
  primaryFixed: '#bee9ff',
  primaryFixedDim: '#87d0f2',
  onPrimaryFixed: '#001f2a',
  onPrimaryFixedVariant: '#004d64',

  // Secondary
  secondary: '#016a60',
  secondaryContainer: '#9ff2e4',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#117166',
  secondaryFixed: '#9ff2e4',
  secondaryFixedDim: '#84d5c8',
  onSecondaryFixed: '#00201c',
  onSecondaryFixedVariant: '#005048',

  // Tertiary
  tertiary: '#6d3800',
  tertiaryContainer: '#904c00',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#ffcea9',
  tertiaryFixed: '#ffdcc3',
  tertiaryFixedDim: '#ffb77d',
  onTertiaryFixed: '#2f1500',
  onTertiaryFixedVariant: '#6e3900',

  // Error
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Surface hierarchy (tonal layering)
  surface: '#faf9fc',
  surfaceDim: '#dadadd',
  surfaceBright: '#faf9fc',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f4f3f6',
  surfaceContainer: '#eeedf1',
  surfaceContainerHigh: '#e8e8eb',
  surfaceContainerHighest: '#e2e2e5',
  surfaceTint: '#016684',
  surfaceVariant: '#e2e2e5',

  // On surface
  onSurface: '#1a1c1e',
  onSurfaceVariant: '#3f484d',
  onBackground: '#1a1c1e',
  background: '#faf9fc',

  // Outline
  outline: '#70787e',
  outlineVariant: '#bfc8cd',

  // Inverse
  inverseSurface: '#2f3033',
  inverseOnSurface: '#f1f0f4',
  inversePrimary: '#87d0f2',
} as const;

export type ColorToken = keyof typeof colors;
