import { describe } from "vitest";
import rule from "../rules/event-literal-meta.js";
import { tsxTester } from "./helpers.js";

describe("event-literal-meta", () => {
  tsxTester().run("stapel/event-literal-meta", rule, {
    valid: [
      // Fully literal — name + description literals, props via prop.* builders.
      `const e = defineEvent({
        name: "pricing.plan.selected",
        description: "User picked a plan",
        props: {
          plan: prop.oneOf(["free", "pro"], "Plan code"),
          source: prop.string("Entry point"),
        },
      });`,
      // No props is fine.
      `const e = defineEvent({ name: "auth.login.submitted", description: "Login submitted" });`,
      // A call that isn't defineEvent is ignored.
      `const x = makeThing({ name: dynamic });`,
    ],
    invalid: [
      // Non-object argument.
      {
        code: `const e = defineEvent(config);`,
        errors: [{ messageId: "notObject" }],
      },
      // Computed / dynamic name.
      {
        code: `const e = defineEvent({ name: EVENT_NAME, description: "x" });`,
        errors: [{ messageId: "dynamicName" }],
      },
      // Dynamic description.
      {
        code: `const e = defineEvent({ name: "a.b.c", description: makeDesc() });`,
        errors: [{ messageId: "missingDescription" }],
      },
      // props is not an object literal.
      {
        code: `const e = defineEvent({ name: "a.b.c", description: "d", props: sharedProps });`,
        errors: [{ messageId: "dynamicProps" }],
      },
      // A prop value that isn't a prop.* builder.
      {
        code: `const e = defineEvent({ name: "a.b.c", description: "d", props: { plan: "free" } });`,
        errors: [{ messageId: "dynamicProp", data: { prop: "plan" } }],
      },
      // Spread into props — not statically extractable.
      {
        code: `const e = defineEvent({ name: "a.b.c", description: "d", props: { ...base } });`,
        errors: [{ messageId: "dynamicProps" }],
      },
    ],
  });
});
