/** Three states, one control, two shapes — and the one state that is not a
 * colour. */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, fontSize, spacing } from "@stapel/tokens";
import { ThemeModeControl } from "../src/theme/index.js";
import type {
  ThemeModeControlVariant,
  ThemePreference,
} from "../src/theme/index.js";
import { SHELL_I18N_KEYS, registerShellI18n } from "../src/i18n/keys.js";

/** The control as a host actually mounts it, with its copy coming from the
 * host's engine rather than from the English floor the component ships as a
 * fallback. The `settings` variant gets the visible group label an appearance
 * screen gives it; the `compact` one does not — a header icon button has no
 * caption, which is the whole point of it. */
function Setting(props: {
  initial: ThemePreference;
  variant: ThemeModeControlVariant;
}): ReactElement {
  const t = useT();
  const [preference, setPreference] = useState<ThemePreference>(props.initial);
  return (
    <div style={{ padding: spacing[4], display: "grid", gap: spacing[2] }}>
      {props.variant === "settings" && (
        <span
          style={{
            fontSize: fontSize.sm.fontSize,
            fontWeight: 600,
            color: cssVar("text-muted"),
          }}
        >
          {t(SHELL_I18N_KEYS.themeGroup)}
        </span>
      )}
      <ThemeModeControl
        variant={props.variant}
        value={preference}
        onChange={setPreference}
        labels={{
          group: t(SHELL_I18N_KEYS.themeGroup),
          light: t(SHELL_I18N_KEYS.themeLight),
          dark: t(SHELL_I18N_KEYS.themeDark),
          system: t(SHELL_I18N_KEYS.themeSystem),
          cycle: t(SHELL_I18N_KEYS.themeCycle),
        }}
        data-testid="theme-mode-control"
      />
    </div>
  );
}

function Control(props: {
  initial: ThemePreference;
  variant?: ThemeModeControlVariant;
}): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerShellI18n(engine);
  return (
    <I18nProvider i18n={engine}>
      <Setting initial={props.initial} variant={props.variant ?? "compact"} />
    </I18nProvider>
  );
}

export default defineDemo({
  id: "shell.theme-mode",
  title: "Theme mode control",
  description:
    "Two shapes of one switch. The DEFAULT is `compact`: a single 36px icon button showing the state the page is in and cycling light → dark → system on click — the header idiom, and the shape the chrome mounts. Its accessible name is its whole readout, so it says both where the choice stands and where the next press lands (\"Appearance: Dark. Switch to Match system\"). `variant=\"settings\"` is the three-label segmented track for an appearance screen: named segments, 44px targets, a real ARIA radio group (one tab stop, arrow keys move the choice), no tooltip anywhere. `system` is a RULE, not a colour: it resolves to light or dark and keeps resolving, so the distinction lives in which state is MARKED and — for a reader who cannot see the mark — in the name, which appends what it currently resolves to. Plain DOM and inline currentColor SVG, sized in em: the fleet's two consumers render nothing alike.",
  component: ThemeModeControl,
  tokens: ["text", "text-muted", "surface", "surface-sunken", "border", "brand"],
  variants: {
    default: {
      description: "The default: one icon button, following the device.",
      viewport: "desktop",
      step: "system",
      render: () => <Control initial="system" />,
    },
    pinned: {
      description:
        "Compact, pinned to dark — the same colour as system-resolved-to-dark, a different name.",
      viewport: "desktop",
      step: "dark",
      render: () => <Control initial="dark" />,
    },
    phone: {
      description: "Compact at phone width, where the 36px target and the absent tooltip matter.",
      viewport: "phone",
      step: "light",
      render: () => <Control initial="light" />,
    },
    settings: {
      description:
        "`variant=\"settings\"` — the three-label track a host mounts on its own appearance screen. Unchanged; it is no longer the default.",
      viewport: "desktop",
      step: "system",
      render: () => <Control initial="system" variant="settings" />,
    },
  },
});
