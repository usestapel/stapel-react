/**
 * Signing another device in by QR, from the settings list.
 *
 * The row is a settings row: a title, what it does, and one trigger. The QR
 * itself lives in the fleet's dialog — a bottom sheet on a phone, a centred
 * modal above the tablet breakpoint — and nothing is generated or polled
 * until the dialog is actually opened, so a settings page does not sit there
 * minting single-use codes nobody asked for.
 */
import type { ReactElement } from "react";
import { useT } from "@stapel/core";
import { defineDemo } from "@stapel/showcase";
import { QrDeviceLinkPanel } from "../src/default/security/QrDeviceLinkPanel.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const HANDLERS: DemoHandlers = {
  "/qr/generate/": {
    key: "qr_demo",
    scan_url: "https://auth.demo.stapel.dev/auth/api/qr/qr_demo/scan/",
    expires_at: "2026-09-01T00:05:00Z",
  },
  "/status/": { status: "pending" },
};

function Panel(props: {
  redirectUrl?: string;
  title?: string;
  subtitle?: string;
}): ReactElement {
  return (
    <AuthDemoHarness handlers={HANDLERS}>
      <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
        <QrDeviceLinkPanel
          {...(props.redirectUrl !== undefined ? { redirectUrl: props.redirectUrl } : {})}
          {...(props.title !== undefined ? { title: props.title } : {})}
          {...(props.subtitle !== undefined ? { subtitle: props.subtitle } : {})}
        />
      </div>
    </AuthDemoHarness>
  );
}

/** The host-overridden copy, resolved INSIDE the harness's provider — a demo
 *  renders its strings through `t()` like the product does. */
function CustomLanding(): ReactElement {
  const t = useT();
  return (
    <div style={{ maxWidth: "35rem", margin: "0 auto" }}>
      <QrDeviceLinkPanel
        redirectUrl="/meetings/today"
        title={t("demo.qr.custom_title")}
        subtitle={t("demo.qr.custom_subtitle")}
      />
    </div>
  );
}

function CustomLandingPanel(): ReactElement {
  return (
    <AuthDemoHarness handlers={HANDLERS}>
      <CustomLanding />
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.qr-device-link-skin",
  title: "Sign in another device (default skin)",
  description:
    "A settings row that opens the QR journey in the fleet's dialog. Idle until triggered — no code is minted, and nothing is polled, until somebody opens it.",
  component: QrDeviceLinkPanel,
  covers: ["QrLogin"],
  variants: {
    default: {
      description: "The row at rest: what it does, and the one control that starts it.",
      step: "idle",
      viewport: "phone",
      render: () => <Panel />,
    },
    "custom-landing": {
      description:
        "The same row handing the scanning device off to a specific page rather than the app root — with the host's own heading and sentence, which is what a deployment actually mounts. A landing URL is invisible in a screenshot; the copy a host overrides is not.",
      step: "idle-custom",
      render: () => <CustomLandingPanel />,
    },
  },
});
