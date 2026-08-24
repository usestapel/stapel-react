/** Device registration — the headless bag behind the push switch. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { DeviceRegistration } from "../src/index.js";
import type { DeviceListItem } from "../src/index.js";
import {
  NotificationsDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";
import { DEMO_OLD_PHONE, DEMO_THIS_DEVICE, demoHeldToken, demoMintToken } from "./fixtures.js";

/**
 * The bag, printed. This is the SUPPLEMENTARY story — the product face is
 * `notifications.push_settings`, which renders the shipped skin. What this one
 * documents is the state machine: `state` is derived from the device list plus
 * this device's fingerprint, so there is no boolean to set and no position to
 * guess.
 */
function DeviceBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="DeviceRegistration">
      <DeviceRegistration getToken={demoMintToken} currentToken={demoHeldToken}>
        {({ state, thisDevice, devices, enable, disable, busy }) => (
          <>
            <StepBadge step={busy ? `${state}…` : state} />
            <span style={{ color: cssVar("text-muted") }}>
              {t(
                state === "on"
                  ? "notifications.push.on"
                  : state === "unknown"
                    ? "notifications.push.unknown"
                    : "notifications.push.off"
              )}
            </span>
            <span style={{ color: cssVar("text-muted") }}>
              {devices.status === "ready"
                ? `${devices.data.map((d) => d.platform).join(", ")} · ${String(
                    thisDevice?.id ?? "—"
                  )}`
                : devices.status}
            </span>
            <DemoActions>
              <DemoButton run={enable} labelKey="notifications.push.on" />
              <DemoButton run={disable} labelKey="notifications.push.off" />
            </DemoActions>
          </>
        )}
      </DeviceRegistration>
    </DemoCard>
  );
}

function DeviceRegistrationDemo(props: {
  devices: readonly DeviceListItem[];
}): ReactElement {
  return (
    <NotificationsDemoHarness seed={{ devices: props.devices }}>
      <DeviceBody />
    </NotificationsDemoHarness>
  );
}

export default defineDemo({
  id: "notifications.device_registration",
  title: "Device registration",
  description:
    "The headless DeviceRegistration derives one PushState from GET /devices/ and SHA-256 of the token this device holds — on, off, inactive, unknown, denied, unsupported. Bring your own switch; the bag has no boolean to flip.",
  component: DeviceRegistration,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: {
      description: "This device is registered and active.",
      viewport: "phone",
      step: "on",
      render: () => <DeviceRegistrationDemo devices={[DEMO_THIS_DEVICE]} />,
    },
    "not-registered": {
      description: "The account has a device, but not this one.",
      viewport: "phone",
      step: "off",
      render: () => <DeviceRegistrationDemo devices={[DEMO_OLD_PHONE]} />,
    },
  },
});
