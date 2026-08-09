import { describe } from "vitest";
import rule from "../rules/no-cyrillic-source.js";
import { tsxTester } from "./helpers.js";

describe("no-cyrillic-source", () => {
  tsxTester().run("stapel/no-cyrillic-source", rule, {
    valid: [
      // Plain string literals are the whole point of the design — never
      // scanned, no matter how much Cyrillic they carry (i18n catalog
      // value, fixture content, sample copy).
      `const label = "Введите код подтверждения";`,
      `const s = t("auth.otp.enter_code", "Введите код");`,
      // Template literal text is a string literal too.
      "const s = `Здравствуйте, ${name}`;",
      // Ordinary English comments/identifiers.
      `// a normal English comment\nconst x = 1;`,
      `/**\n * English JSDoc, nothing to see here.\n */\nfunction run() {}`,
      // This case shows an `eslint-disable-next-line` directive suppressing
      // a single-line-comment violation — proof the report lands on a
      // reachable line, not swallowed or mis-anchored. (RuleTester registers
      // the rule under test as
      // `rule-to-test/<name>` rather than its real plugin id — see
      // https://github.com/eslint/eslint rule-tester.js — so the directive
      // below targets THAT id; in a real consuming repo it would read
      // `stapel/no-cyrillic-source` instead.)
      `// eslint-disable-next-line rule-to-test/stapel/no-cyrillic-source -- legacy TODO, ticket JIRA-1\n// Русский однострочный комментарий`,
      // A blanket eslint-disable placed BEFORE a multi-line block comment
      // suppresses a violation on an INTERIOR line of that block — the
      // suppression path the Python draft's bug made unreachable via
      // next-line only.
      [
        "/* eslint-disable rule-to-test/stapel/no-cyrillic-source -- legacy header, rewrite pending JIRA-2 */",
        "/**",
        " * English line one.",
        " * Русский текст на второй строке.",
        " */",
        "function legacy() {}",
        "/* eslint-enable rule-to-test/stapel/no-cyrillic-source */",
      ].join("\n"),
    ],
    invalid: [
      // Cyrillic in a single-line comment — reported on that comment's own
      // line (line 1 here), which IS reachable by eslint-disable-next-line
      // (see the valid case above).
      {
        code: `// Русский комментарий\nconst x = 1;`,
        errors: [
          { messageId: "cyrillicComment", line: 1 },
          { messageId: "cyrillicComment", line: 1 },
        ],
      },
      // Cyrillic on an INTERIOR line of a multi-line block comment (not the
      // comment's opening line) — must be reported on the line it actually
      // sits on (line 3), never collapsed onto line 1.
      {
        code: [
          "/**",
          " * English line one.",
          " * Русский текст на второй строке.",
          " */",
          "function f() {}",
        ].join("\n"),
        // One report per Cyrillic run (word) on the line — all five words
        // of the sentence, all anchored to line 3, none collapsed onto
        // line 1 (the block's opening `/**`).
        errors: new Array(5).fill({ messageId: "cyrillicComment", line: 3 }),
      },
      // Cyrillic variable identifier.
      {
        code: `const русскоеИмя = 1;`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "русскоеИмя" } }],
      },
      // Cyrillic function name.
      {
        code: `function тестФункция() {}`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "тестФункция" } }],
      },
      // Cyrillic class name.
      {
        code: `class ТестКласс {}`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "ТестКласс" } }],
      },
      // Cyrillic TS type alias name.
      {
        code: `type РусскийТип = string;`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "РусскийТип" } }],
      },
      // Cyrillic test-name identifier (a variable holding a test's subject).
      {
        code: `const тестИмя = "expected value";`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "тестИмя" } }],
      },
      // A mixed-script identifier (miттudei) is ALSO caught here — it
      // contains Cyrillic, full stop; no-mixed-script-word is a narrower,
      // literal-only sibling, not a replacement.
      {
        code: `const miттudei = 1;`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "miттudei" } }],
      },
      // Destructured binding name.
      {
        code: `const { имяПоля } = obj;`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "имяПоля" } }],
      },
      // Function parameter name.
      {
        code: `function f(параметр) { return параметр; }`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "параметр" } }],
      },
      // Object-literal key (not a string key — those stay exempt).
      {
        code: `const o = { русскийКлюч: 1 };`,
        errors: [{ messageId: "cyrillicIdentifier", data: { name: "русскийКлюч" } }],
      },
    ],
  });
});
