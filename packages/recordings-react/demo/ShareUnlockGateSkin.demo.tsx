/** A locked link is a STATE of the page, not an error on it. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ShareUnlockGate } from "../src/default/index.js";
import { SkinDemo } from "./_fixtures.js";

function noop(): void {
  // The demo does not exchange a passcode; the gate's own states are the subject.
}

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <ShareUnlockGate onUnlock={noop} isUnlocking={false} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <ShareUnlockGate onUnlock={noop} isUnlocking={false} throttled />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.share-unlock-skin",
  title: "Passcode gate",
  description:
    "401 share_passcode_required renders as a gate; 429 share_unlock_throttled is a named lockout, not a generic failure.",
  component: ShareUnlockGate,
  variants: {
    default: {
      description: "Waiting for the passcode.",
      viewport: "desktop",
      step: "locked",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "Locked out after too many attempts, at 390px.",
      viewport: "phone",
      step: "throttled",
      render: () => <PhoneVariant />,
    },
  },
});
