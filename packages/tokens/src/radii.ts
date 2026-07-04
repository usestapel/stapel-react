/** Border radii in px (`full` is a pill/circle sentinel). */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  full: 9999,
} as const;

export type RadiusName = keyof typeof radii;
