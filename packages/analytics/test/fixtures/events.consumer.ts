// Type-level consumer fixture (frontend-guardrails §3.1 — "a name can't be
// mistyped and a prop can't be invented"). Compiled by tsconfig.consumer.json
// via typedEvents.test.ts. The @ts-expect-error lines assert the schema
// REJECTS bad emits; if enforcement regressed (e.g. props widened to
// Record<string, unknown>), tsc would flag the unused @ts-expect-error and the
// test would fail.
import { defineEvent, prop, createTracked } from "../../src/index.js";
import type { Analytics } from "../../src/index.js";

const planSelected = defineEvent({
  name: "pricing.plan.selected",
  description: "User picked a pricing plan",
  props: {
    plan: prop.oneOf(["free", "pro", "team"], "Plan code"),
    period: prop.oneOf(["monthly", "yearly"], "Billing period"),
    source: prop.string("Entry point"),
  },
});

const appOpened = defineEvent({
  name: "app.opened",
  description: "App shell mounted (no props)",
});

const checkoutStarted = defineEvent({
  name: "billing.checkout.started",
  description: "Checkout began",
  flow: "billing.checkout", // optional flow link is allowed
});

const analytics = null as unknown as Analytics;
const { tracked, trackedSubmit } = createTracked(analytics);

// ── valid: the event name literal is preserved, props narrowed ───────────────
export const name1: "pricing.plan.selected" = planSelected.name;
export const flow1: string | undefined = checkoutStarted.flow;

analytics.track(planSelected, { plan: "pro", period: "monthly", source: "landing" });
analytics.track(appOpened, {});
analytics.track(checkoutStarted, {});
// string form stays available (library auto-instrumentation)
analytics.track("flow.auth.otp.verifying", { phase: "started" });

export const h1 = tracked(
  planSelected,
  { plan: "free", period: "yearly", source: "settings" },
  () => 42
);
export const h2 = trackedSubmit(appOpened, {}, (_e: { preventDefault(): void }) => {});

// ── invalid: must NOT compile ────────────────────────────────────────────────
// @ts-expect-error "gold" is not one of the oneOf literals
analytics.track(planSelected, { plan: "gold", period: "monthly", source: "x" });
// @ts-expect-error missing required prop `source`
analytics.track(planSelected, { plan: "pro", period: "monthly" });
// @ts-expect-error unknown prop `extra`
analytics.track(planSelected, { plan: "pro", period: "monthly", source: "x", extra: 1 });
// @ts-expect-error tracked enforces the same schema
export const bad1 = tracked(planSelected, { plan: "pro" }, () => {});
// @ts-expect-error description is required on a prop builder
prop.string();
// @ts-expect-error name and description are required
defineEvent({ name: "x.y.z" });
