/** First-login enforcement (org-program §C2) — forced change + MFA enroll. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ForcedPasswordChange, MfaEnrollGate } from "../src/index.js";
import {
  AuthDemoHarness,
  DemoActions,
  DemoButton,
  DemoCard,
  StepBadge,
} from "./_harness.js";

const DEMO_USER = {
  id: "u_1",
  username: "acme/pat",
  email: null,
  phone: null,
  auth_type: "login",
  is_email_verified: false,
  is_phone_verified: false,
  is_anonymous: false,
  is_staff: false,
  is_superuser: false,
  oauth_provider: null,
  created_at: "2026-01-01T00:00:00Z",
  last_login: null,
};

const AUTH_OK = {
  status: "LOGGED_IN",
  user: DEMO_USER,
  tokens: { access: "acc_1", refresh: "ref_1" },
};

function ForcedChangeDemo(): ReactElement {
  return (
    <AuthDemoHarness handlers={{ "/password/forced-change/": AUTH_OK }}>
      <ForcedPasswordChange challengeToken="demo-challenge">
        {(bag) => (
          <DemoCard heading="ForcedPasswordChange">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              <DemoButton
                run={() => bag.submit("s3cure-own-password")}
                labelKey="demo.action.submit"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </ForcedPasswordChange>
    </AuthDemoHarness>
  );
}

function MfaEnrollDemo(): ReactElement {
  return (
    <AuthDemoHarness
      handlers={{
        "/mfa/enroll/exchange/": {
          status: "MFA_ENROLL_SESSION",
          access: "enroll-access",
          expires_in: 3600,
        },
        "/me/": DEMO_USER,
      }}
    >
      <MfaEnrollGate challengeToken="demo-challenge">
        {(bag) => (
          <DemoCard heading="MfaEnrollGate">
            <StepBadge step={bag.state.step} />
            <DemoActions>
              {/* In a real host the wrapped TotpSetup / PasskeyRegistration
                  journey supplies the token pair; the demo completes with a
                  canned one to show the settle path. */}
              <DemoButton
                run={() => bag.complete({ access: "acc_1", refresh: "ref_1" })}
                labelKey="demo.action.submit"
              />
              <DemoButton run={() => bag.reset()} labelKey="demo.action.reset" />
            </DemoActions>
          </DemoCard>
        )}
      </MfaEnrollGate>
    </AuthDemoHarness>
  );
}

/**
 * Demonstrates the FIRST_LOGIN_REQUIRED branches an org-provisioned account
 * hits on its first password login: the forced password change (a rejected
 * password retries in place; success adopts the session — or chains into the
 * enroll challenge) and the MFA-enroll gate (challenge → limited enroll-only
 * session → TotpSetup/PasskeyRegistration against it → full-session tokens).
 */
export default defineDemo({
  id: "auth.first-login",
  title: "First login (forced change / MFA enroll)",
  description:
    "Headless first-login enforcement for org-provisioned accounts: ForcedPasswordChange submits the owed password change against the login intermediate's challenge token; MfaEnrollGate exchanges the mfa_enroll challenge for a limited enroll-only session, scopes the pair's TotpSetup/PasskeyRegistration to it, and commits the full session on completion.",
  component: ForcedPasswordChange,
  covers: ["MfaEnrollGate"],
  flow: "auth.first_login",
  tokens: ["card-bg", "button-primary-bg"],
  variants: {
    forcedChange: { render: () => <ForcedChangeDemo /> },
    mfaEnroll: { render: () => <MfaEnrollDemo /> },
  },
});
