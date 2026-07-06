import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAnalytics } from "../src/analytics/createAnalytics.js";
import { createTracked } from "../src/analytics/tracked.js";
import { defineEvent, prop } from "../src/analytics/defineEvent.js";
import { createFlowMachine } from "../src/flows/flowMachine.js";
import type { AnalyticsProvider } from "../src/analytics/types.js";
import { memoryStorage } from "../src/storage.js";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function collector(): { events: string[]; provider: AnalyticsProvider } {
  const events: string[] = [];
  return {
    events,
    provider: {
      track: (e) => {
        events.push(e.name);
      },
    },
  };
}

describe("defineEvent / prop", () => {
  it("captures name, description, per-prop meta, and optional flow", () => {
    const e = defineEvent({
      name: "pricing.plan.selected",
      description: "User picked a plan",
      props: {
        plan: prop.oneOf(["free", "pro", "team"], "Plan code"),
        source: prop.string("Entry point"),
      },
      flow: "billing.checkout",
    });
    expect(e.name).toBe("pricing.plan.selected");
    expect(e.description).toBe("User picked a plan");
    expect(e.flow).toBe("billing.checkout");
    expect(e.props["plan"]).toEqual({
      type: "string",
      description: "Plan code",
      options: ["free", "pro", "team"],
    });
    expect(e.props["source"]).toEqual({ type: "string", description: "Entry point" });
  });

  it("defaults props to {} and omits flow when unset", () => {
    const e = defineEvent({ name: "app.opened", description: "Shell mounted" });
    expect(e.props).toEqual({});
    expect("flow" in e).toBe(false);
  });
});

describe("track(event, props) — typed emit over the facade", () => {
  it("delivers under the event's name", async () => {
    const { events, provider } = collector();
    const a = createAnalytics({ providers: { c: provider }, consent: "granted", storage: memoryStorage() });
    const e = defineEvent({
      name: "pricing.plan.selected",
      description: "d",
      props: { plan: prop.oneOf(["free", "pro"], "Plan") },
    });
    a.track(e, { plan: "pro" });
    await a.flush();
    expect(events).toEqual(["pricing.plan.selected"]);
  });
});

describe("tracked() wrapper", () => {
  it("emits the event then calls the handler and returns its result", async () => {
    const { events, provider } = collector();
    const a = createAnalytics({ providers: { c: provider }, consent: "granted", storage: memoryStorage() });
    const { tracked } = createTracked(a);
    const e = defineEvent({ name: "cta.clicked", description: "d" });
    const handler = vi.fn((n: number) => n * 2);
    const onClick = tracked(e, {}, handler);

    const result = onClick(21);
    expect(result).toBe(42);
    expect(handler).toHaveBeenCalledWith(21);
    await a.flush();
    expect(events).toEqual(["cta.clicked"]);
  });

  it("still emits when there is no handler", async () => {
    const { events, provider } = collector();
    const a = createAnalytics({ providers: { c: provider }, consent: "granted", storage: memoryStorage() });
    const { tracked } = createTracked(a);
    const e = defineEvent({ name: "cta.clicked", description: "d" });
    tracked(e, {})();
    await a.flush();
    expect(events).toEqual(["cta.clicked"]);
  });
});

describe("double-count detection (dev)", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("warns when a tracked() handler steps a flow machine (double count)", () => {
    const a = createAnalytics({ consent: "granted", storage: memoryStorage() });
    const { tracked } = createTracked(a);
    const machine = createFlowMachine<{ step: string }>({
      id: "billing.checkout",
      initial: { step: "idle" },
      analytics: a,
    });
    const e = defineEvent({ name: "cta.pay", description: "d" });
    // A handler that steps the flow — exactly the forbidden double-count case.
    const onClick = tracked(e, {}, () => {
      machine.to({ step: "paying" });
    });
    onClick();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("double-count")
    );
    expect(warn.mock.calls[0]?.[0]).toContain("flow.billing.checkout.paying");
  });

  it("does NOT warn when a flow steps outside any tracked() scope", () => {
    const a = createAnalytics({ consent: "granted", storage: memoryStorage() });
    const machine = createFlowMachine<{ step: string }>({
      id: "billing.checkout",
      initial: { step: "idle" },
      analytics: a,
    });
    machine.to({ step: "paying" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("does NOT warn when a tracked() handler does no flow work", () => {
    const a = createAnalytics({ consent: "granted", storage: memoryStorage() });
    const { tracked } = createTracked(a);
    const e = defineEvent({ name: "cta.clicked", description: "d" });
    tracked(e, {}, () => {})();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("flow machine: runtime-configurable instrumentation (item 5)", () => {
  it("emits flow steps by default when analytics is present", async () => {
    const { events, provider } = collector();
    const a = createAnalytics({ providers: { c: provider }, consent: "granted", storage: memoryStorage() });
    const m = createFlowMachine<{ step: string }>({
      id: "demo",
      initial: { step: "idle" },
      analytics: a,
    });
    m.to({ step: "next" });
    await a.flush();
    expect(events).toEqual(["flow.demo.next"]);
  });

  it("stays silent when instrument:false but keeps the facade usable", async () => {
    const { events, provider } = collector();
    const a = createAnalytics({ providers: { c: provider }, consent: "granted", storage: memoryStorage() });
    const m = createFlowMachine<{ step: string }>({
      id: "demo",
      initial: { step: "idle" },
      analytics: a,
      instrument: false,
    });
    m.to({ step: "next" });
    await a.flush();
    expect(events).toEqual([]);
  });
});

describe("typed events (tsc on a consumer fixture)", () => {
  it("type-checks the fixture cleanly (valid usages + @ts-expect-error bad ones)", () => {
    const tsc = require.resolve("typescript/bin/tsc");
    const cfg = resolve(here, "fixtures/tsconfig.consumer.json");
    execFileSync(process.execPath, [tsc, "--noEmit", "-p", cfg], { stdio: "pipe" });
    expect(true).toBe(true);
  }, 60_000);
});
