/**
 * QR login — pilot demo (auth-sa.md §8). start() generates a QR key + scan URL
 * and begins background polling; render the `awaitingScan` state's scanUrl as a
 * QR image. The mock keeps the status `pending`, so the demo stays on
 * `awaitingScan` to show the polling state and the scan URL.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { QrLogin } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
  type DemoHandlers,
} from "./_harness.js";

const handlers: DemoHandlers = {
  "/qr/generate/": {
    key: "qr_1",
    scan_url: "https://auth.demo.stapel.dev/auth/api/qr/qr_1/scan/",
    expires_at: "2026-01-01T00:05:00Z",
  },
  "/status/": { status: "pending" },
};

function QrDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <QrLogin pollIntervalMs={100000}>
        {(bag) => (
          <DemoCard heading="QrLogin">
            <StepBadge step={bag.state.step} />
            {bag.state.step === "awaitingScan" ? (
              <code
                style={{
                  background: cssVar("surface-sunken"),
                  color: cssVar("text-muted"),
                  borderRadius: radii.sm,
                  padding: spacing["2"],
                  wordBreak: "break-all",
                }}
              >
                {bag.state.scanUrl}
              </code>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => bag.start("login_request", "/app")}
                labelKey="demo.action.start"
              />
              <DemoButton
                run={() => bag.dispose()}
                labelKey="demo.action.dispose"
              />
            </DemoActions>
          </DemoCard>
        )}
      </QrLogin>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.qr-login",
  title: "QR login (cross-device)",
  description:
    "Headless QR authentication with background polling: start() yields a scanUrl to render as a QR image; delivered tokens adopt into the session.",
  component: QrLogin,
  flow: "auth.qr_login",
  tokens: ["card-bg", "background-secondary", "button-primary-bg"],
  variants: {
    default: {
      description: "Generate a QR and poll; parks at awaitingScan (pending).",
      render: () => <QrDemo />,
    },
  },
});
