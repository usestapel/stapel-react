/**
 * Where the copy on this screen came from — the chip an operator reads when a
 * translated page looks half-finished.
 *
 * Every variant is SEEDED with a loader status rather than waiting for a mocked
 * fetch: the states this component exists to document are exactly the ones a
 * synchronous shot would otherwise miss.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { TranslationStatus } from "../src/default/TranslationStatus.js";
import { TranslateDemoHarness, demoStatus } from "./_harness.js";
import type { RemoteLocaleStatus } from "../src/index.js";

function StatusDemo(props: { status?: RemoteLocaleStatus }): ReactElement {
  return (
    <TranslateDemoHarness
      locale="es"
      {...(props.status !== undefined ? { status: props.status } : {})}
    >
      <TranslationStatus />
    </TranslateDemoHarness>
  );
}

export default defineDemo({
  id: "translate.translation-status",
  title: "Translation status (default skin)",
  description:
    "The revision in effect and how many texts it carries — or which rung of the loader's fallback ladder answered. Small on purpose: a settings screen puts it under the switcher, a host may put it in a footer.",
  component: TranslationStatus,
  variants: {
    default: {
      description: "Downloaded from the server: revision and key count.",
      viewport: "desktop",
      step: "ready",
      render: () => <StatusDemo status={demoStatus()} />,
    },
    offline: {
      description:
        "The server could not be reached; the copy saved on this device is in effect and the chip names that.",
      viewport: "phone",
      step: "offline",
      render: () => (
        <StatusDemo
          status={demoStatus({
            source: "cache",
            revision: 408,
            stale: true,
            failed: true,
            error: new Error("offline"),
          })}
        />
      ),
    },
    loading: {
      description: "The switch is in flight — the chip says so, never a blank line.",
      viewport: "phone",
      step: "loading",
      render: () => <StatusDemo />,
    },
  },
});
