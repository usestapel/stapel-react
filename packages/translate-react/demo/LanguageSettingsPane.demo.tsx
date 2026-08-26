/**
 * The account-level screen the nav entry mounts — the address a person is sent
 * to when they go looking for "where do I change the language?".
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { LanguageSettingsPane } from "../src/default/LanguageSettingsPane.js";
import { TranslateDemoHarness, demoStatus } from "./_harness.js";
import type { RemoteLocaleStatus } from "../src/index.js";

function PaneDemo(props: { status: RemoteLocaleStatus }): ReactElement {
  return (
    <TranslateDemoHarness locale="en" status={props.status}>
      <LanguageSettingsPane />
    </TranslateDemoHarness>
  );
}

export default defineDemo({
  id: "translate.language-settings",
  title: "Language settings (default skin)",
  description:
    "The switcher, one sentence saying what the choice affects, and the status line an operator needs when a translated screen looks wrong. Mounted by the `account.language` nav entry.",
  component: LanguageSettingsPane,
  covers: ["LanguageSwitcher", "TranslationStatus"],
  variants: {
    default: {
      description: "Desktop, translations downloaded.",
      viewport: "desktop",
      step: "ready",
      render: () => <PaneDemo status={demoStatus({ locale: "en" })} />,
    },
    offline: {
      description:
        "At 390px, with the copy saved on the device in effect — the screen says which, rather than looking identical to a healthy one.",
      viewport: "phone",
      step: "offline",
      render: () => (
        <PaneDemo
          status={demoStatus({
            locale: "en",
            source: "cache",
            revision: 408,
            stale: true,
            failed: true,
            error: new Error("offline"),
          })}
        />
      ),
    },
  },
});
