/** Pricing table — headless catalogue + Stripe Checkout redirect. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { mapLoad, matchList, useT } from "@stapel/core";
import { cssVar } from "@stapel/tokens";
import { PricingTable } from "../src/index.js";
import {
  BillingDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** The catalogue the canned GET /products handler returns. */
const DEMO_CATALOG = {
  packages: [
    { slug: "starter", name: "Starter", credits: 500, price_cents: 500, currency: "USD" },
    { slug: "pro", name: "Pro", credits: 2000, price_cents: 1800, currency: "USD" },
  ],
  plans: [
    {
      slug: "team",
      name: "Team",
      price_cents: 2900,
      currency: "USD",
      monthly_credits_included: 5000,
      storage_limit_bytes: 10_737_418_240,
      description: "For small teams.",
    },
  ],
};

/** The session the canned POST /checkout handler returns. */
const DEMO_CHECKOUT = {
  checkout_url: "https://checkout.stripe.test/session/cs_demo",
  session_id: "cs_demo",
};

function PricingTableBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="PricingTable">
      <PricingTable>
        {({ state, isCheckingOut, checkoutUrl, checkout, refetch }) =>
          // One state, two lists: project the one this surface draws. Buying
          // lives in the `ready` arm — a slug is only worth sending once the
          // catalogue that names it actually answered.
          matchList(
            mapLoad(state, (catalog) => catalog.packages),
            {
              loading: () => <StepBadge step="loading" />,
              // The only branch that may claim the shop sells nothing.
              empty: () => <StepBadge step="0 packages" />,
              failed: () => (
                <>
                  <span style={{ color: cssVar("error") }}>
                    {t("billing.pricing.error")}
                  </span>
                  <DemoActions>
                    <DemoButton run={refetch} labelKey="billing.pricing.retry" />
                  </DemoActions>
                </>
              ),
              ready: (packages) => (
                <>
                  <StepBadge
                    step={checkoutUrl ? "redirect" : `${packages.length} packages`}
                  />
                  {checkoutUrl ? (
                    <span style={{ color: cssVar("text-muted") }}>
                      {checkoutUrl}
                    </span>
                  ) : null}
                  <DemoActions>
                    <DemoButton
                      run={() => {
                        checkout({ package: "pro" });
                      }}
                      labelKey={
                        isCheckingOut
                          ? "billing.pricing.checking_out"
                          : "billing.pricing.buy"
                      }
                    />
                  </DemoActions>
                </>
              ),
            }
          )
        }
      </PricingTable>
    </DemoCard>
  );
}

function PricingTableDemo(): ReactElement {
  return (
    <BillingDemoHarness
      handlers={{ "/checkout": DEMO_CHECKOUT, "/products": DEMO_CATALOG }}
    >
      <PricingTableBody />
    </BillingDemoHarness>
  );
}

/**
 * Demonstrates the headless pricing table: the canned handler returns the
 * catalogue for GET /products and a hosted Stripe session for POST /checkout, so
 * pressing "buy" resolves a `checkoutUrl` the host would redirect to. Payment is
 * server truth — the checkout mutation is never optimistic. Bring your own
 * cards — the component is renderless.
 */
export default defineDemo({
  id: "billing.pricing_table",
  title: "Pricing table",
  description:
    "The headless PricingTable wraps the catalogue read + Stripe Checkout mutation and exposes packages / plans / checking-out / checkoutUrl / error state. Bring your own pricing cards — the component is renderless.",
  component: PricingTable,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <PricingTableDemo /> },
  },
});
