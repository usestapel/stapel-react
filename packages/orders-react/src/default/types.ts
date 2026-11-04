/**
 * Props every skin component in this package shares.
 *
 * `mode` is OPTIONAL with no default: the shared `SkinTheme` follows the
 * host's theme when nobody overrides it.
 */
export interface ThemeModeProp {
  readonly mode?: "light" | "dark";
}

/** Client-side navigation seam: without it, links are plain anchors. */
export interface NavigateProp {
  readonly onNavigate?: (href: string) => void;
}
