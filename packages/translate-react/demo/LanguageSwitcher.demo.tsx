/**
 * The DEFAULT SKIN in the viewer — because the default skin is what a host
 * actually ships.
 *
 * The `phone` variant is not decoration: the viewer offers 390/768/1280
 * (`showcase-viewer/.ladle/config.mjs`), and a language switcher is the one
 * control a person reaches for on a phone, in a language they cannot read.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { LanguageSwitcher } from "../src/default/LanguageSwitcher.js";
import { TranslateDemoHarness, demoStatus } from "./_harness.js";
import type { RemoteLocaleStatus } from "../src/index.js";

function SwitcherDemo(props: {
  compact?: boolean;
  status?: RemoteLocaleStatus;
}): ReactElement {
  return (
    <TranslateDemoHarness
      locale="en"
      {...(props.status !== undefined ? { status: props.status } : {})}
    >
      <LanguageSwitcher {...(props.compact === true ? { compact: true } : {})} />
    </TranslateDemoHarness>
  );
}

export default defineDemo({
  id: "translate.language-switcher",
  title: "Language switcher (default skin)",
  description:
    "The control this pair exists to put on screen: a searchable select on desktop, a bottom sheet on a phone, and a compact globe for the app header. When the bundle could not be downloaded it says so beside itself instead of pretending the switch was complete.",
  component: LanguageSwitcher,
  tokens: ["surface-raised"],
  variants: {
    default: {
      description: "Desktop: a searchable select over the deployment's languages.",
      viewport: "desktop",
      step: "ready",
      render: () => <SwitcherDemo status={demoStatus({ locale: "en" })} />,
    },
    compact: {
      description:
        "The header form at 390px — a globe and the current code, opening a bottom sheet.",
      viewport: "phone",
      step: "sheet",
      render: () => <SwitcherDemo compact status={demoStatus({ locale: "en" })} />,
    },
    partial: {
      description:
        "The bundle could not be downloaded: the switch applied, and the control says some texts will read in English.",
      viewport: "phone",
      step: "partial",
      render: () => (
        <SwitcherDemo
          status={demoStatus({
            locale: "en",
            source: "fallback",
            revision: null,
            keys: 0,
            failed: true,
            error: new Error("offline"),
          })}
        />
      ),
    },
  },
});
