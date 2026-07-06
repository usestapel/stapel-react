// Ladle global Provider (frontend-guardrails §4.1, §1.1). Two jobs:
//   1. load the generated token stylesheet so every demo's cssVar() resolves;
//   2. mirror Ladle's theme toggle onto <html data-theme>, which is exactly how
//      @stapel/tokens switches light/dark — the demos re-theme for free, with no
//      JS in the token layer.
import { useEffect } from "react";
import type { GlobalProvider } from "@ladle/react";
import "@stapel/tokens/tokens.css";
import "./showcase.css";

export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    const theme = globalState.theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, [globalState.theme]);
  return <div className="stapel-showcase-root">{children}</div>;
};
