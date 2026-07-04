/**
 * Semantic color tokens. Every token carries a light/dark pair
 * (frontend-standard §4.1) — the CSS build emits the light value on `:root`
 * and the dark value under `[data-theme="dark"]`.
 */
export interface ColorToken {
  readonly light: string;
  readonly dark: string;
}

export const colors = {
  /** Page background. */
  background: { light: "#ffffff", dark: "#0b0e14" },
  /** Default surface (cards, panels). */
  surface: { light: "#f6f7f9", dark: "#151a23" },
  /** Raised surface (popovers, menus). */
  surfaceRaised: { light: "#ffffff", dark: "#1c2230" },
  /** Primary text. */
  text: { light: "#171b21", dark: "#e8eaf0" },
  /** Secondary / muted text. */
  textMuted: { light: "#5c6470", dark: "#9aa3b2" },
  /** Text on primary-colored surfaces. */
  textOnPrimary: { light: "#ffffff", dark: "#ffffff" },
  /** Brand / primary interactive color. */
  primary: { light: "#4657d9", dark: "#7c8cf8" },
  /** Primary hover state. */
  primaryHover: { light: "#3948b8", dark: "#98a5fa" },
  /** Subtle primary background (selected rows, badges). */
  primarySubtle: { light: "#eef0fd", dark: "#232b4d" },
  /** Default border. */
  border: { light: "#d9dde3", dark: "#2a3242" },
  /** Emphasised border (inputs on focus-within, table headers). */
  borderStrong: { light: "#aeb6c2", dark: "#3d4759" },
  /** Destructive actions and errors. */
  danger: { light: "#c93a3a", dark: "#f28b8b" },
  /** Subtle danger background. */
  dangerSubtle: { light: "#fdeeee", dark: "#3a2020" },
  /** Success states. */
  success: { light: "#1f7a4d", dark: "#6fd0a0" },
  /** Subtle success background. */
  successSubtle: { light: "#eaf7f0", dark: "#152e22" },
  /** Warnings. */
  warning: { light: "#9a6700", dark: "#e8b34b" },
  /** Subtle warning background. */
  warningSubtle: { light: "#fdf6e7", dark: "#33270f" },
  /** Informational accents. */
  info: { light: "#1168a7", dark: "#6cb8e8" },
  /** Subtle info background. */
  infoSubtle: { light: "#e9f4fb", dark: "#12293a" },
  /** Focus ring. */
  focusRing: { light: "#4657d9", dark: "#98a5fa" },
  /** Overlay scrim behind modals. */
  overlay: { light: "rgba(15, 18, 24, 0.45)", dark: "rgba(0, 0, 0, 0.6)" },
} as const;

// Constraint check (kept out of the public type surface for isolatedDeclarations).
const _colorsCheck: Record<string, ColorToken> = colors;
void _colorsCheck;

export type ColorTokenName = keyof typeof colors;
