/** Subscription — headless status + cancel + customer-portal link. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { Subscription } from "../src/index.js";
import {
  BillingDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** The subscription the canned GET /subscription handler returns. */
const DEMO_SUBSCRIPTION = {
  plan: "pro",
  status: "active",
  stripe_subscription_id: "sub_demo",
  current_period_start: "2026-06-01T00:00:00Z",
  current_period_end: "2026-07-01T00:00:00Z",
  cancelled_at: null,
};

/** The portal link the canned GET /portal handler returns. */
const DEMO_PORTAL = {
  portal_url: "https://billing.stripe.test/portal/demo",
};

function SubscriptionBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="Subscription">
      <Subscription>
        {({ plan, status, isActive, isLoading, isCancelling, portalUrl, cancel, openPortal }) => (
          <>
            <StepBadge
              step={isLoading ? "loading" : `${plan ?? "—"} · ${status ?? "—"}`}
            />
            <span style={{ color: cssVar("color-text-secondary") }}>
              {t(isActive ? "billing.subscription.active" : "billing.subscription.inactive")}
            </span>
            {portalUrl ? (
              <span style={{ color: cssVar("color-text-secondary") }}>
                {portalUrl}
              </span>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => {
                  cancel();
                }}
                labelKey={
                  isCancelling
                    ? "billing.subscription.cancelling"
                    : "billing.subscription.cancel"
                }
              />
              <DemoButton
                run={() => {
                  openPortal();
                }}
                labelKey="billing.subscription.manage"
              />
            </DemoActions>
          </>
        )}
      </Subscription>
    </DemoCard>
  );
}

function SubscriptionDemo(): ReactElement {
  return (
    <BillingDemoHarness
      handlers={{ "/portal": DEMO_PORTAL, "/subscription": DEMO_SUBSCRIPTION }}
    >
      <SubscriptionBody />
    </BillingDemoHarness>
  );
}

/**
 * Demonstrates the headless subscription surface: the canned handler returns an
 * active subscription for GET /subscription and a portal link for GET /portal,
 * so the bag exposes live status plus cancel + manage-billing actions. Bring
 * your own status badge / buttons — the component is renderless.
 */
export default defineDemo({
  id: "billing.subscription",
  title: "Subscription",
  description:
    "The headless Subscription wraps the subscription read + cancel + customer-portal link and exposes plan / status / isActive / cancelling / portalUrl / error state. Bring your own UI — the component is renderless.",
  component: Subscription,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <SubscriptionDemo /> },
  },
});
