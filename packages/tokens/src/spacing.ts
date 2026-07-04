/** Spacing scale in px. Consume via TS or `--stapel-space-*` CSS vars. */
export const spacing = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 24,
  "6": 32,
  "7": 48,
  "8": 64,
} as const;

export type SpacingStep = keyof typeof spacing;
