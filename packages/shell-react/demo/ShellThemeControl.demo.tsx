/** The theme switch as chrome: it reads its own state, applies it, keeps it. */
import type { ReactElement, ReactNode } from "react";
import { defineDemo } from "@stapel/showcase";
import { I18nProvider, createI18n, useT } from "@stapel/core";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { ShellThemeControl } from "../src/default/index.js";
import type { ThemeModeControlVariant } from "../src/theme/index.js";
import { registerShellI18n } from "../src/i18n/keys.js";

/** Demo-local copy in the unmanaged `demo.*` namespace (same convention as
 * `_harness.tsx`), so `i18n-key-exists` reads it as app-local. */
const demoBundleEn: Record<string, string> = {
  "demo.theme.settings_title": "Appearance",
  "demo.theme.settings_lead":
    "Applies to this device. “Match system” keeps following it.",
  "demo.theme.sheet_title": "Northgate",
  "demo.theme.sheet_menu_one": "Search",
  "demo.theme.sheet_menu_two": "Post an ad",
  "demo.theme.sheet_menu_three": "Chat",
};

function Frame(props: { children: ReactNode }): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerShellI18n(engine);
  engine.registerBundle("en", demoBundleEn);
  return <I18nProvider i18n={engine}>{props.children}</I18nProvider>;
}

/**
 * Desktop placement: the last row of the account area / of a settings card —
 * the switch beside the sentence that says what it governs, which is how it
 * reads in `PublicShell`'s header and `AppShell`'s `Sider` foot.
 */
function SettingsCard(props: { variant?: ThemeModeControlVariant }): ReactElement {
  const t = useT();
  return (
    <div
      style={{
        display: "grid",
        gap: spacing[2],
        padding: spacing[4],
        maxWidth: 420,
        background: cssVar("surface"),
        border: `1px solid ${cssVar("border")}`,
        borderRadius: radii.lg,
      }}
    >
      <span style={{ fontWeight: 600, color: cssVar("text") }}>
        {t("demo.theme.settings_title")}
      </span>
      <span
        style={{ fontSize: fontSize.sm.fontSize, color: cssVar("text-muted") }}
      >
        {t("demo.theme.settings_lead")}
      </span>
      <ShellThemeControl
        {...(props.variant !== undefined ? { variant: props.variant } : {})}
      />
    </div>
  );
}

/**
 * Phone placement: the foot of the nav sheet, under the destinations. A
 * setting inline with the destinations reads as a destination, so it sits
 * below them behind a rule — the exact frame both shells draw.
 */
function SheetFooter(): ReactElement {
  const t = useT();
  const items = [
    "demo.theme.sheet_menu_one",
    "demo.theme.sheet_menu_two",
    "demo.theme.sheet_menu_three",
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
        width: "100%",
        background: cssVar("surface"),
        border: `1px solid ${cssVar("border")}`,
        borderRadius: radii.lg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: spacing[4],
          fontWeight: 600,
          color: cssVar("text"),
          borderBlockEnd: `1px solid ${cssVar("border")}`,
        }}
      >
        {t("demo.theme.sheet_title")}
      </div>
      <div style={{ display: "grid", gap: spacing[3], padding: spacing[4] }}>
        {items.map((key) => (
          <span key={key} style={{ color: cssVar("text") }}>
            {t(key)}
          </span>
        ))}
      </div>
      <div
        style={{
          marginBlockStart: "auto",
          padding: spacing[3],
          borderBlockStart: `1px solid ${cssVar("border")}`,
        }}
      >
        <ShellThemeControl />
      </div>
    </div>
  );
}

export default defineDemo({
  id: "shell.theme-control",
  title: "Shell theme control",
  description:
    "The theme switch the default chrome renders, and the reason a dark theme that shipped in every token file was unreachable: the mechanism had no place. Unlike the bare ThemeModeControl — prop-driven on purpose, for hosts that keep the preference in a profile field — this one owns its own state: it reads the cached preference, applies it, follows the OS while the choice is “match system”, and writes the choice back. It applies NOTHING until that read resolves, so it never re-stamps the document a frame after a pre-paint boot script stamped it correctly; until then it simply marks the mode the page is already in. AppShell and PublicShell mount it by default (themeControl={false} opts out): at the foot of the Sider and the end of the header account area on a desktop, in the foot of the nav sheet on a phone. Since 0.14.0 the shape it mounts is the COMPACT icon button — the three-label track it used to be is a setting, and it stood in the first row of every desktop page; the placements are unchanged, and variant=\"settings\" brings the old control back where a host wants it.",
  component: ShellThemeControl,
  tokens: ["text", "text-muted", "surface", "surface-sunken", "border", "brand"],
  variants: {
    default: {
      description:
        "Desktop, the default: one icon button under the sentence that says what it governs.",
      viewport: "desktop",
      step: "settings",
      render: () => (
        <Frame>
          <SettingsCard />
        </Frame>
      ),
    },
    phone: {
      description:
        "Phone: the foot of the nav sheet, below the destinations and behind a rule.",
      viewport: "phone",
      step: "sheet-footer",
      render: () => (
        <Frame>
          <SheetFooter />
        </Frame>
      ),
    },
    settings: {
      description:
        "The opt-in: variant=\"settings\" puts the three-label track back, for a host whose own appearance screen wants every state named.",
      viewport: "desktop",
      step: "settings-variant",
      render: () => (
        <Frame>
          <SettingsCard variant="settings" />
        </Frame>
      ),
    },
  },
});
