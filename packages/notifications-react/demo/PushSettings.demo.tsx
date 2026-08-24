/** Push settings — this device's switch, and the account's device registry. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import type { DeviceListItem } from "../src/index.js";
import {
  PushDeviceList,
  PushNotificationToggle,
  PushSettingsPane,
} from "../src/default/index.js";
import { NotificationsDemoHarness } from "./_harness.js";
import {
  DEMO_OLD_PHONE,
  DEMO_TABLET,
  DEMO_THIS_DEVICE,
  demoHeldToken,
  demoMintToken,
} from "./fixtures.js";

function PaneDemo(props: {
  devices: readonly DeviceListItem[];
  supported?: boolean;
}): ReactElement {
  return (
    <NotificationsDemoHarness seed={{ devices: props.devices }}>
      <PushSettingsPane
        getToken={demoMintToken}
        currentToken={demoHeldToken}
        {...(props.supported !== undefined ? { supported: props.supported } : {})}
      />
    </NotificationsDemoHarness>
  );
}

/**
 * The switch's position is the SERVER's answer: `GET /devices/` plus SHA-256 of
 * the token this device holds. There is no local boolean to flip, which is why
 * the states below are things that happened rather than things the skin
 * decided — a rejected token is `inactive`, a device with no token to match is
 * `unknown`, and a browser that cannot receive push says so instead of
 * offering a control that cannot succeed.
 */
export default defineDemo({
  id: "notifications.push_settings",
  title: "Push notification settings",
  description:
    "The push settings surface: a switch whose position comes from GET /devices/ matched on this device's token fingerprint, and the account's registry with an inactive device flagged and removal by row id behind a confirm sheet.",
  component: PushSettingsPane,
  covers: ["PushNotificationToggle", "PushDeviceList"],
  tokens: ["surface", "surface-raised", "text", "text-muted", "border-subtle"],
  variants: {
    default: {
      description:
        "This device plus an old phone the push provider rejected — listed and flagged, because hiding it would draw the account as smaller than it is.",
      viewport: "phone",
      step: "on",
      render: () => <PaneDemo devices={[DEMO_THIS_DEVICE, DEMO_OLD_PHONE]} />,
    },
    "no-devices": {
      description: "Nothing registered yet: a designed empty state with the door in it.",
      viewport: "phone",
      step: "off/empty",
      render: () => <PaneDemo devices={[]} />,
    },
    unsupported: {
      description:
        "An insecure origin or a browser without push. The reason sits beside the control and the switch is off-limits, rather than a dead grey rectangle.",
      viewport: "phone",
      step: "unsupported",
      render: () => <PaneDemo devices={[DEMO_THIS_DEVICE]} supported={false} />,
    },
    desktop: {
      description: "Three devices at desktop width, on a settings column measure.",
      viewport: "desktop",
      step: "on/many",
      render: () => (
        <PaneDemo devices={[DEMO_THIS_DEVICE, DEMO_TABLET, DEMO_OLD_PHONE]} />
      ),
    },
    "toggle-only": {
      description:
        "The switch on its own, for a host that puts the registry elsewhere.",
      viewport: "phone",
      step: "on/toggle",
      render: () => (
        <NotificationsDemoHarness seed={{ devices: [DEMO_THIS_DEVICE] }}>
          <PushNotificationToggle getToken={demoMintToken} currentToken={demoHeldToken} />
        </NotificationsDemoHarness>
      ),
    },
    "registry-only": {
      description: "The registry on its own — every device the account sends to.",
      viewport: "phone",
      step: "devices",
      render: () => (
        <NotificationsDemoHarness seed={{ devices: [DEMO_TABLET, DEMO_OLD_PHONE] }}>
          <PushDeviceList currentToken={demoHeldToken} />
        </NotificationsDemoHarness>
      ),
    },
  },
});
