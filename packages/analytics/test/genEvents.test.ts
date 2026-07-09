import { describe, expect, it } from "vitest";
// The gen:events extractor lib is repo tooling (scripts/), tested here so the
// static defineEvent extraction and flows.json projection have unit coverage
// beyond the drift gate.
import {
  extractDefinedEvents,
  flowFunnels,
  manifestEvents,
  buildEventsJson,
  FLOW_PHASES,
} from "../../../scripts/events-lib.mjs";

const SRC = `
import { defineEvent, prop } from "@stapel/analytics";

export const planSelected = defineEvent({
  name: "pricing.plan.selected",
  description: "User picked a plan",
  props: {
    plan: prop.oneOf(["free", "pro", "team"], "Plan code"),
    seats: prop.number("Seat count"),
    trial: prop.boolean("Was on trial"),
    source: prop.string("Entry point"),
  },
  flow: "billing.checkout",
});

// no-prop event
export const appOpened = defineEvent({
  name: "app.opened",
  description: "Shell mounted",
});
`;

describe("extractDefinedEvents (TypeScript AST)", () => {
  const events = extractDefinedEvents(SRC, "src/analytics/events.ts");

  it("finds every defineEvent, sorted by name, with source location", () => {
    expect(events.map((e) => e.name)).toEqual([
      "app.opened",
      "pricing.plan.selected",
    ]);
    const opened = events.find((e) => e.name === "app.opened");
    expect(opened?.source.file).toBe("src/analytics/events.ts");
    expect(opened?.source.line).toBeGreaterThan(0);
  });

  it("captures per-prop type, description, oneOf options, and the flow link", () => {
    const plan = events.find((e) => e.name === "pricing.plan.selected");
    expect(plan?.flow).toBe("billing.checkout");
    expect(plan?.description).toBe("User picked a plan");
    expect(plan?.props).toEqual({
      plan: { type: "string", description: "Plan code", options: ["free", "pro", "team"] },
      seats: { type: "number", description: "Seat count" },
      trial: { type: "boolean", description: "Was on trial" },
      source: { type: "string", description: "Entry point" },
    });
  });

  it("defaults props to {} and omits flow when absent", () => {
    const opened = events.find((e) => e.name === "app.opened");
    expect(opened?.props).toEqual({});
    expect(opened && "flow" in opened).toBe(false);
  });

  it("ignores defineEvent with a non-literal argument (uncaptured, not crashed)", () => {
    const dyn = `const spec = {}; defineEvent(spec);`;
    expect(extractDefinedEvents(dyn, "x.ts")).toEqual([]);
  });
});

describe("flowFunnels (flows.json projection)", () => {
  const flows = [
    {
      id: "auth.passwordless_login",
      titleKey: "flow.auth.passwordless_login.title",
      descriptionKey: "flow.auth.passwordless_login.description",
      steps: [
        { order: 0, kind: "human", noteKey: "n0" },
        { order: 1, kind: "http", noteKey: "n1" },
      ],
    },
  ];

  it("projects one funnel per flow with a phase prop over the closed phase set", () => {
    const funnels = flowFunnels(flows);
    expect(funnels).toHaveLength(1);
    const f = funnels[0];
    expect(f.event).toBe("flow.auth.passwordless_login.<step>");
    expect(f.props.phase.options).toEqual(FLOW_PHASES);
    expect(f.steps).toHaveLength(2);
    expect(f.source).toBe("flows.json");
  });
});

describe("manifestEvents (compact manifest section)", () => {
  it("renders oneOf props as type(a|b) and counts funnel steps", () => {
    const eventsJson = buildEventsJson({
      pkg: { name: "@stapel/x", version: "1.0.0" },
      defined: extractDefinedEvents(SRC, "src/analytics/events.ts"),
      funnels: flowFunnels([
        { id: "f", titleKey: "t", descriptionKey: "d", steps: [{ order: 0, kind: "human", noteKey: "n" }] },
      ]),
    });
    const m = manifestEvents(eventsJson);
    const plan = m.defined.find((e) => e.name === "pricing.plan.selected");
    expect(plan?.props.plan).toBe("string(free|pro|team)");
    expect(plan?.props.seats).toBe("number");
    expect(plan?.flow).toBe("billing.checkout");
    expect(m.flows[0]).toEqual({ flow: "f", event: "flow.f.<step>", steps: 1 });
  });
});
