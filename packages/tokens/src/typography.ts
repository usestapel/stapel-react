/** Typography scale. Sizes/line-heights in px, emitted as rem-friendly px CSS. */
export interface TypeStep {
  readonly fontSize: number;
  readonly lineHeight: number;
}

export const fontFamily = {
  sans: "'Inter', 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const;

export const fontSize = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 22, lineHeight: 30 },
  "2xl": { fontSize: 28, lineHeight: 36 },
  "3xl": { fontSize: 36, lineHeight: 44 },
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export interface Typography {
  readonly fontFamily: typeof fontFamily;
  readonly fontSize: typeof fontSize;
  readonly fontWeight: typeof fontWeight;
}

export const typography: Typography = {
  fontFamily: fontFamily,
  fontSize: fontSize,
  fontWeight: fontWeight,
};

export type FontSizeName = keyof typeof fontSize;
export type FontWeightName = keyof typeof fontWeight;
