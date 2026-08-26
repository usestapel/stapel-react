/** Three states, and the one that is not a colour. */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, fontSize, spacing } from "@stapel/tokens";
import { ThemeModeControl } from "../src/theme/index.js";
import type { ThemePreference } from "../src/theme/index.js";
import { SHELL_I18N_KEYS, registerShellI18n } from "../src/i18n/keys.js";

/** The control as a host actually mounts it: inside an appearance setting,
 * with its group label visible and its copy coming from the host's engine
 * rather than from the English floor the component ships as a fallback. */
function Setting(props: { initial: ThemePreference }): ReactElement {
  const t = useT();
  const [preference, setPreference] = useState<ThemePreference>(props.initial);
  return (
    <div style={{ padding: spacing[4], display: "grid", gap: spacing[2] }}>
      <span
        style={{
          fontSize: fontSize.sm.fontSize,
          fontWeight: 600,
          color: cssVar("text-muted"),
        }}
      >
        {t(SHELL_I18N_KEYS.themeGroup)}
      </span>
      <ThemeModeControl
        value={preference}
        onChange={setPreference}
        labels={{
          group: t(SHELL_I18N_KEYS.themeGroup),
          light: t(SHELL_I18N_KEYS.themeLight),
          dark: t(SHELL_I18N_KEYS.themeDark),
          system: t(SHELL_I18N_KEYS.themeSystem),
        }}
        data-testid="theme-mode-control"
      />
    </div>
  );
}

function Control(props: { initial: ThemePreference }): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerShellI18n(engine);
  return (
    <I18nProvider i18n={engine}>
      <Setting initial={props.initial} />
    </I18nProvider>
  );
}

export default defineDemo({
  id: "shell.theme-mode",
  title: "Theme mode control",
  description:
    "Sun, moon, half-disc — three NAMED segments in one track, the chosen one filled, each at least 44px tall: a control whose current value can be read at a glance, which three bare 24px glyphs with no selected state could not. Under it a real ARIA radio group: one tab stop, arrow keys move the choice, and no tooltip anywhere (the accessible name carries what the icon means, and hover does not exist on a phone). `system` is a RULE, not a colour: it resolves to light or dark and keeps resolving, so the distinction lives in WHICH segment is marked, and — for a reader who cannot see the mark — in the half-disc's name, which appends what it currently resolves to. Plain DOM and inline currentColor SVG, sized in em: the fleet's two consumers render nothing alike.",
  component: ThemeModeControl,
  tokens: ["text", "text-muted", "surface", "surface-sunken", "border", "brand"],
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
