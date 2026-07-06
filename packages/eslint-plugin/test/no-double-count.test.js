import { describe } from "vitest";
import rule from "../rules/no-double-count.js";
import { tsxTester } from "./helpers.js";

describe("no-double-count", () => {
  tsxTester().run("stapel/no-double-count", rule, {
    valid: [
      // tracked() over a plain handler (no flow stepping) — one channel.
      `const x = <button onClick={tracked(planSelected, { plan }, () => startCheckout())}>Go</button>;`,
      // Flow action with NO tracked wrapper — the machine is the only channel.
      `const x = <button onClick={() => flow.run(pending, task, handlers)} data-analytics="flow">Next</button>;`,
      // A flow-stepping handler NOT wrapped in tracked() — fine.
      `const submit = () => flow.submitCode(code);`,
      // tracked() whose handler is a bare reference (can't inspect) — not flagged.
      `const x = <button onClick={tracked(e, {}, externalHandler)}>Go</button>;`,
    ],
    invalid: [
      // Heuristic 1: tracked() wraps a handler that steps a machine (run).
      {
        code: `const h = tracked(planSelected, {}, () => flow.run(p, t, hs));`,
        errors: [{ messageId: "trackedStepsFlow" }],
      },
      // Heuristic 1: submit* method inside the wrapped handler.
      {
        code: `const h = trackedSubmit(loginSubmitted, {}, () => { machine.submitCode(code); });`,
        errors: [{ messageId: "trackedStepsFlow" }],
      },
      // Heuristic 1: step() method.
      {
        code: `const h = tracked(ev, {}, function () { m.step(); });`,
        errors: [{ messageId: "trackedStepsFlow" }],
      },
      // Heuristic 2: data-analytics="flow" AND a tracked() handler on the same element.
      {
        code: `const x = <button onClick={tracked(ev, {}, doThing)} data-analytics="flow">Next</button>;`,
        errors: [{ messageId: "flowMarkerAndTracked" }],
      },
      // Heuristic 2 dominates 1: reports once (via the marker), not twice.
      {
        code: `const x = <button onClick={tracked(ev, {}, () => flow.run(p, t, hs))} data-analytics="flow">x</button>;`,
        errors: [{ messageId: "flowMarkerAndTracked" }],
      },
    ],
  });
});
