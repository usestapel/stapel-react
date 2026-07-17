/** Device registration — headless push-token register / unregister. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { DeviceRegistration } from "../src/index.js";
import {
  NotificationsDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** A demo device token + the server echo the canned handler returns. */
const DEMO_TOKEN = "eHh4eHg6dG9rZW4-demo";
const DEVICE_ECHO: readonly [number, unknown] = [
  201,
  { token: DEMO_TOKEN, platform: "web" },
];

/** The registration body — mounted INSIDE the harness (providers available). */
function DeviceBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="DeviceRegistration">
      <DeviceRegistration>
        {({ register, unregister, isRegistering, registered }) => (
          <>
            <StepBadge
              step={
                registered ? registered.platform : isRegistering ? "…" : "idle"
              }
            />
            {registered ? (
              <span style={{ color: cssVar("text-muted") }}>
                {t("notifications.device.registered")}
              </span>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => {
                  register(DEMO_TOKEN, "web");
                }}
                labelKey={
                  isRegistering
                    ? "notifications.device.registering"
                    : "notifications.device.register"
                }
              />
              <DemoButton
                run={() => {
                  unregister(DEMO_TOKEN);
                }}
                labelKey="notifications.device.unregister"
              />
            </DemoActions>
          </>
        )}
      </DeviceRegistration>
    </DemoCard>
  );
}

function DeviceRegistrationDemo(): ReactElement {
  return (
    <NotificationsDemoHarness handlers={{ "/devices/": DEVICE_ECHO }}>
      <DeviceBody />
    </NotificationsDemoHarness>
  );
}

/**
 * Demonstrates the headless registration surface: the canned handler echoes a
 * 201 with the registered token, so pressing "enable" flips the bag into its
 * `registered` state. Unregister hits the same mock path (204 in production).
 */
export default defineDemo({
  id: "notifications.device_registration",
  title: "Device registration",
  description:
    "The headless DeviceRegistration wraps the register / unregister push-token mutations and exposes their pending / result / error state. Bring your own permission-prompt UI — the component is renderless.",
  component: DeviceRegistration,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <DeviceRegistrationDemo /> },
  },
});
