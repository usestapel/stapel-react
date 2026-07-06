import { RuleTester } from "eslint";
import "./helpers.js"; // wires RuleTester into vitest
import rule from "../rules/require-disable-description.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});

// Uses core rule names in directives so ESLint's directive validation is happy.
tester.run("stapel/require-disable-description", rule, {
  valid: [
    `// eslint-disable-next-line no-console -- debugging aid, remove before ship\nconst x = 1;`,
    `/* eslint-disable no-unused-vars -- generated block */\nconst x = 1;`,
    `const x = 1; // a normal comment`,
    `/* eslint-enable no-console */\nconst x = 1;`,
  ],
  invalid: [
    {
      code: `// eslint-disable-next-line no-console\nconst x = 1;`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `/* eslint-disable no-unused-vars */\nconst x = 1;`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
