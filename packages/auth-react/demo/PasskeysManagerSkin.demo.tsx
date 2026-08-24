/**
 * The passkeys settings screen — the row the owner called nonsense, and what
 * it says now.
 *
 * It used to be a name and a green button whose label is the SIGN-IN button's
 * copy in every locale, shown to someone who is by definition already signed
 * in. A row about a stored credential has to answer four questions instead:
 * what is this, when did it arrive, is it in use, and what can I do to it.
 *
 * Two rows on purpose: one platform credential that has never been used (the
 * key somebody enrolled and then lost — invisible while the row printed only a
 * date) and one security key that has.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PasskeysManager } from "../src/default/security/PasskeysManager.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const PASSKEYS = {
  passkeys: [
    {
      id: "pk-1",
      device_name: "MacBook Touch ID",
      aaguid: "adce0002-35bc-c60a-648b-0b25f1f05503",
      transports: ["internal"],
      created_at: "2026-06-14T09:12:00Z",
      last_used_at: null,
    },
    {
      id: "pk-2",
      device_name: "YubiKey 5C",
      aaguid: "cb69481e-8ff7-4039-93ec-0a2729a154a8",
      transports: ["usb", "nfc"],
      created_at: "2026-02-02T18:40:00Z",
      last_used_at: "2026-08-21T07:05:00Z",
    },
  ],
};

const handlers: DemoHandlers = { "/passkey/": PASSKEYS };
const emptyHandlers: DemoHandlers = { "/passkey/": { passkeys: [] } };

function PasskeysManagerDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PasskeysManager />
      </div>
    </AuthDemoHarness>
  );
}

function PasskeysEmptyDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={emptyHandlers}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <PasskeysManager />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.passkeys-manager-skin",
  title: "Passkeys (default skin)",
  description:
    "Credential-management rows: what the passkey lives in (read from transports), when it was added, when it was last used — or that it never has been — plus remove and add another. Never a sign-in action, and Add is blocked with a printed reason where the browser cannot create passkeys.",
  component: PasskeysManager,
  variants: {
    default: {
      description: "A platform credential never used, and a security key that has been.",
      render: () => <PasskeysManagerDemo />,
    },
    empty: {
      description: "No passkeys yet — an empty state, not a failure.",
      render: () => <PasskeysEmptyDemo />,
    },
  },
});
