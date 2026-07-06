import { describe } from "vitest";
import rule from "../rules/clickable-needs-event.js";
import { tsxTester } from "./helpers.js";

describe("clickable-needs-event", () => {
  tsxTester().run("stapel/clickable-needs-event", rule, {
    valid: [
      // Outcome (a): handler wrapped in tracked() / trackedSubmit().
      `const x = <button onClick={tracked(planSelected, { plan }, startCheckout)}>Go</button>;`,
      `const x = <form onSubmit={trackedSubmit(loginSubmitted, {}, submit)}>x</form>;`,
      `const x = <button onClick={t.tracked(e, {}, h)}>Go</button>;`,
      // Outcome (b): flow action — the machine auto-emits.
      `const x = <button onClick={next} data-analytics="flow">Next</button>;`,
      // Outcome (c): explicit opt-out with a reason.
      `const x = <div onClick={toggle} data-analytics="none" data-analytics-reason="visual accordion toggle, not a funnel step">x</div>;`,
      // Decorative: handler only stops propagation / prevents default — exempt.
      `const x = <div onClick={(e) => e.stopPropagation()}>x</div>;`,
      `const x = <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>x</div>;`,
      // No interactive handler → nothing to enforce.
      `const x = <button>Just a label</button>;`,
      `const x = <div data-analytics="none">no handler, no reason needed</div>;`,
      // Dynamic data-analytics value → author took control, not statically read.
      `const x = <button onClick={h} data-analytics={mode}>x</button>;`,
    ],
    invalid: [
      // Bare handler, no outcome.
      {
        code: `const x = <button onClick={startCheckout}>Buy</button>;`,
        errors: [{ messageId: "needsEvent" }],
      },
      // Inline arrow that actually does work (not decorative) — still needs an outcome.
      {
        code: `const x = <button onClick={() => doThing()}>Buy</button>;`,
        errors: [{ messageId: "needsEvent" }],
      },
      // Custom component forwarding onClick — also requires an outcome.
      {
        code: `const x = <IconButton onClick={handleClick} />;`,
        errors: [{ messageId: "needsEvent" }],
      },
      // Opt-out without a reason.
      {
        code: `const x = <button onClick={h} data-analytics="none">x</button>;`,
        errors: [{ messageId: "noneNeedsReason" }],
      },
      // Opt-out with an empty reason.
      {
        code: `const x = <button onClick={h} data-analytics="none" data-analytics-reason="  ">x</button>;`,
        errors: [{ messageId: "noneNeedsReason" }],
      },
      // onSubmit without an outcome.
      {
        code: `const x = <form onSubmit={submit}>x</form>;`,
        errors: [{ messageId: "needsEvent" }],
      },
    ],
  });
});
