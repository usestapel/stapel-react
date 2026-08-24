/** Three states, and the one that is not a colour. */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { I18nProvider, createI18n } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { ThemeModeControl } from "../src/theme/index.js";
import type { ThemePreference } from "../src/theme/index.js";
import { registerShellI18n } from "../src/i18n/keys.js";

function Control(props: { initial: ThemePreference }): ReactElement {
  const [preference, setPreference] = useState<ThemePreference>(props.initial);
  const engine = createI18n({ locale: "en" });
  registerShellI18n(engine);
  return (
    <I18nProvider i18n={engine}>
      <div style={{ padding: spacing["4"] }}>
        <ThemeModeControl
          value={preference}
          onChange={setPreference}
          data-testid="theme-mode-control"
        />
      </div>
    </I18nProvider>
  );
}

export default defineDemo({
  id: "shell.theme-mode",
  title: "Theme mode control",
  description:
    "Sun, moon, half-disc — a real ARIA radio group: one tab stop, arrow keys move the choice, and no tooltip anywhere (the accessible name carries what the icon means, and hover does not exist on a phone). `system` is a RULE, not a colour: it resolves to light or dark and keeps resolving, so the distinction lives in WHICH button is marked, and — for a reader who cannot see the mark — in the half-disc's name, which appends what it currently resolves to. Plain DOM and inline currentColor SVG, sized in em: the fleet's two consumers render nothing alike.",
  component: ThemeModeControl,
  tokens: ["text", "text-muted", "surface-overlay"],
  variants: {
    default: {
      description: "Following the device.",
      viewport: "desktop",
      step: "system",
      render: () => <Control initial="system" />,
    },
    pinned: {
      description: "Pinned to dark — the same colour as system-resolved-to-dark, a different mark.",
      viewport: "desktop",
      step: "dark",
      render: () => <Control initial="dark" />,
    },
    phone: {
      description: "At phone width, where the 44px target and the absent tooltip matter.",
      viewport: "phone",
      step: "light",
      render: () => <Control initial="light" />,
    },
  },
});
