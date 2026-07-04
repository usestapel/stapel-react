/**
 * Elevation (box-shadow) levels. Light/dark pairs like colors: dark themes
 * need stronger shadows to read as raised.
 */
export interface ElevationToken {
  readonly light: string;
  readonly dark: string;
}

export const elevation = {
  none: { light: "none", dark: "none" },
  low: {
    light: "0 1px 2px rgba(15, 18, 24, 0.08)",
    dark: "0 1px 2px rgba(0, 0, 0, 0.4)",
  },
  medium: {
    light: "0 2px 8px rgba(15, 18, 24, 0.12)",
    dark: "0 2px 8px rgba(0, 0, 0, 0.5)",
  },
  high: {
    light: "0 8px 24px rgba(15, 18, 24, 0.16)",
    dark: "0 8px 24px rgba(0, 0, 0, 0.6)",
  },
} as const;

const _elevationCheck: Record<string, ElevationToken> = elevation;
void _elevationCheck;

export type ElevationName = keyof typeof elevation;
