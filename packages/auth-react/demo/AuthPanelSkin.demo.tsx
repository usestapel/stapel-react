/**
 * The DEFAULT SKIN, in the viewer — because the default skin is the product.
 *
 * Until now this package's demos all documented the headless bags, which is
 * the layer a host replaces. The layer a host SHIPS had no entry here at all,
 * so the two things the owner found by opening a live product — a desktop
 * modal on a phone, and a passkey journey that put two of our screens in front
 * of the system prompt — were invisible to every introspection surface the
 * repo has.
 *
 * Drag the viewer's width control across 768px: the alt-method dialog is a
 * bottom sheet below it and a centred modal at or above it. That decision is
 * not in this file, and it is not in `AuthPanel` either — it is
 * `@stapel/tokens-antd/skin`'s, once, for the whole fleet.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AuthPanel } from "../src/default/index.js";
import { AuthDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

function method(
  id: string,
  placement: "main" | "bottom" | "overflow",
  order: number
): Record<string, unknown> {
  return {
    id,
    enabled: true,
    placement,
    order,
    interaction: placement === "main" ? "inline" : id === "oauth" ? "redirect" : "modal",
    icon_svg: "",
    can_login: true,
    can_register: id === "email",
  };
}

const CAPABILITIES = {
  registration: {
    phone: false,
    email: true,
    password: false,
    oauth: [],
    sso: false,
    anonymous: true,
  },
  login: {
    phone: true,
    email: true,
    password: true,
    oauth: [],
    sso: false,
    qr: true,
    passkey: true,
    magic_link: false,
  },
  methods: [
    method("email", "main", 0),
    method("phone", "main", 1),
    method("qr", "bottom", 0),
    method("passkey", "bottom", 1),
    method("password", "overflow", 0),
  ],
};

const handlers: DemoHandlers = {
  "/capabilities/": CAPABILITIES,
  // The passkey ceremony begins for real off the button; whether a prompt
  // appears is the browser's business, and in a viewer with no WebAuthn the
  // skin says so in the fallback sheet instead of spinning forever.
  "/passkey/authenticate/begin/": {
    session_key: "sess_demo",
    options: { challenge: "AQIDBA", rpId: "stapel.dev" },
  },
  "/otp/request/": { sent: true, retry_after: 30 },
};

function AuthPanelSkinDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <AuthPanel />
      </div>
    </AuthDemoHarness>
  );
}

/**
 * The screen as a person meets it after being signed out mid-session — the
 * zone-A notice is a PROP, so this closure genuinely starts in that state
 * rather than reaching it by a click a static shot never performs.
 */
function AuthPanelRevokedDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <AuthPanel
          notice={{ type: "warning", key: "error.401.refresh_revoked" }}
        />
      </div>
    </AuthDemoHarness>
  );
}

function AuthPanelRegisterDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={handlers}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <AuthPanel variant="register" />
      </div>
    </AuthDemoHarness>
  );
}

export default defineDemo({
  id: "auth.auth-panel-skin",
  title: "Sign-in screen (default skin)",
  description:
    "The shipped sign-in surface. Picking an alt method opens the fleet's dialog — a bottom sheet under 768px, a centred modal at or above it. Picking Passkey raises the system prompt immediately and opens nothing of ours unless the ceremony fails.",
  component: AuthPanel,
  covers: ["AuthProvider", "PasswordlessLogin", "PasswordLogin", "PasswordRegister", "PasskeyLogin", "MagicLink", "SsoDiscovery", "AnonymousSession"],
  variants: {
    default: {
      description:
        "Email/phone tabs, a bottom row (QR + passkey), and the overflow menu that opens the shared dialog.",
      step: "chooseMethod",
      render: () => <AuthPanelSkinDemo />,
    },
    register: {
      description: "The registration surface: only the channels that deanonymize.",
      step: "register",
      render: () => <AuthPanelRegisterDemo />,
    },
    "session-revoked": {
      description:
        "Phone width, arrived at from a session that ended: the reason is stated above the form instead of leaving a person to wonder why they are here.",
      step: "notice",
      viewport: "phone",
      render: () => <AuthPanelRevokedDemo />,
    },
  },
});
