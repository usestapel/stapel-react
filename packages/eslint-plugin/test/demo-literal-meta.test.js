import { describe } from "vitest";
import rule from "../rules/demo-literal-meta.js";
import { tsxTester } from "./helpers.js";

describe("demo-literal-meta", () => {
  tsxTester().run("stapel/demo-literal-meta", rule, {
    valid: [
      // Fully literal meta; component is a reference; variants is an object literal.
      `const d = defineDemo({
        id: "auth.passwordless-login",
        title: "Passwordless login",
        description: "Headless OTP flow",
        component: PasswordlessLogin,
        covers: ["AuthProvider"],
        flow: "auth.otp",
        tokens: ["accent"],
        variants: {
          default: { render: () => <Demo /> },
          locked: { description: "Rate-limited", render: () => <Demo /> },
        },
      });`,
      // A member-expression component reference is fine.
      `const d = defineDemo({ id: "a.b", title: "T", description: "D", component: Ns.Comp, variants: { default: { render: () => null } } });`,
      // A call that isn't defineDemo is ignored.
      `const x = makeThing({ id: dynamic });`,
    ],
    invalid: [
      {
        code: `const d = defineDemo(config);`,
        errors: [{ messageId: "notObject" }],
      },
      {
        code: `const d = defineDemo({ id: THE_ID, title: "T", description: "D", component: C, variants: { default: {} } });`,
        errors: [{ messageId: "dynamicString", data: { key: "id" } }],
      },
      {
        code: `const d = defineDemo({ id: "a.b", title: makeTitle(), description: "D", component: C, variants: { default: {} } });`,
        errors: [{ messageId: "dynamicString", data: { key: "title" } }],
      },
      {
        code: `const d = defineDemo({ id: "a.b", title: "T", description: "D", component: makeComp(), variants: { default: {} } });`,
        errors: [{ messageId: "dynamicComponent" }],
      },
      {
        code: `const d = defineDemo({ id: "a.b", title: "T", description: "D", component: C, variants: sharedVariants });`,
        errors: [{ messageId: "dynamicVariants" }],
      },
      {
        code: `const d = defineDemo({ id: "a.b", title: "T", description: "D", component: C, variants: { [dyn]: { render: () => null } } });`,
        errors: [{ messageId: "dynamicVariants" }],
      },
    ],
  });
});
