// Ladle global Provider (frontend-guardrails §4.1, §1.1). Two jobs:
//   1. load the generated token stylesheet so every demo's cssVar() resolves;
//   2. mirror Ladle's theme toggle onto <html data-theme>, which is exactly how
//      @stapel/tokens switches light/dark — the demos re-theme for free, with no
//      JS in the token layer.
//
// The stamp is written SYNCHRONOUSLY, during the Provider's own render, before
// any story mounts. It used to be a `useEffect`, which runs after the story's
// first render — so every skin that read `resolveThemeMode()` rendered light
// first, and the ones that never subscribed stayed light: the showcase's dark
// toggle was a paper feature (audit CF-1). Writing an attribute during render
// is a side effect, but an idempotent one on a node React does not own, and it
// is the only point that is guaranteed to precede the children's first read.
// The layout effect below repeats it for the theme-change case under
// concurrent rendering, where a render may be thrown away.
import { useLayoutEffect } from "react";
import type { GlobalProvider } from "@ladle/react";
import "@stapel/tokens/tokens.css";
import "./showcase.css";
import { MaybeReskin } from "./reskin.js";

const THEME_ATTRIBUTE = "data-theme";

function stampTheme(theme: string | undefined): void {
  if (typeof document === "undefined") return;
  const mode = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  if (root.getAttribute(THEME_ATTRIBUTE) !== mode) root.setAttribute(THEME_ATTRIBUTE, mode);
  root.style.colorScheme = mode;
}

export const Provider: GlobalProvider = ({ children, globalState }) => {
  stampTheme(globalState.theme);
  useLayoutEffect(() => {
    stampTheme(globalState.theme);
  }, [globalState.theme]);
  return (
    <MaybeReskin>
      <div className="stapel-showcase-root">{children}</div>
    </MaybeReskin>
  );
};
