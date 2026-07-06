import { describe } from "vitest";
import rule from "../rules/known-event.js";
import { tsxTester, EVENT_SETTINGS } from "./helpers.js";

describe("known-event", () => {
  tsxTester().run("stapel/known-event", rule, {
    valid: [
      // String-literal event that exists in the catalog.
      {
        code: `track("pricing.plan.selected", { plan });`,
        settings: EVENT_SETTINGS,
      },
      // Flow event under a known funnel base — matched by prefix.
      {
        code: `track("flow.auth.otp.codeSent", { phase: "started" });`,
        settings: EVENT_SETTINGS,
      },
      // Identifier resolving to a local defineEvent whose name is known.
      {
        code: `const ev = defineEvent({ name: "auth.login.submitted", description: "x" });
               tracked(ev, {}, submit);`,
        settings: EVENT_SETTINGS,
      },
      // Unresolvable event expression → skipped (never guesses).
      {
        code: `track(events.dynamic, {});`,
        settings: EVENT_SETTINGS,
      },
      // Empty catalog → rule degrades to a no-op even for a made-up name.
      {
        code: `track("totally.made.up", {});`,
        settings: { stapel: { eventNames: [] } },
      },
    ],
    invalid: [
      // String-literal event not in the catalog → drift warning.
      {
        code: `track("pricing.plan.deselected", { plan });`,
        settings: EVENT_SETTINGS,
        errors: [{ messageId: "unknownEvent", data: { name: "pricing.plan.deselected" } }],
      },
      // Identifier resolving to a defineEvent whose name is unknown (registry stale).
      {
        code: `const ev = defineEvent({ name: "billing.checkout.opened", description: "x" });
               tracked(ev, {}, open);`,
        settings: EVENT_SETTINGS,
        errors: [{ messageId: "unknownEvent", data: { name: "billing.checkout.opened" } }],
      },
    ],
  });
});
