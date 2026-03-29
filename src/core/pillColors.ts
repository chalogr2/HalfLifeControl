/**
 * Predefined pill accent colors for visual identification.
 * Derived from the Material Design 3 tonal palette.
 */
export const PILL_COLORS = [
  '#004d64', // primary (teal-dark)
  '#016a60', // secondary (green)
  '#6d3800', // tertiary (amber)
  '#ba1a1a', // error (red)
  '#5b5d71', // neutral violet
  '#006b5e', // jade
  '#8b4513', // saddle brown
  '#2e7d32', // forest green
  '#1565c0', // blue
  '#6a1b9a', // purple
] as const;

export function getDefaultPillColor(index: number): string {
  return PILL_COLORS[index % PILL_COLORS.length];
}
