import { describe } from "vitest";
import rule from "../rules/no-mixed-script-word.js";
import { tsxTester } from "./helpers.js";

/* eslint-disable stapel/no-mixed-script-word, stapel/no-cyrillic-source -- every fixture below IS a mixed-script or Cyrillic specimen, and each explanatory comment has to name the specimen it describes; that is what this rule's test suite is. Deliberately a file-scoped disable in THIS file rather than a glob in the recommended preset: consumers' test files must stay covered, because test files are where the English-only canon leaks (see index.js TEST_FILES). The sibling suite, no-cyrillic-source.test.js, needs only a two-line disable, so it uses one. */

describe("no-mixed-script-word", () => {
  tsxTester().run("stapel/no-mixed-script-word", rule, {
    valid: [
      // Pure-Cyrillic i18n catalog text — no Latin letters in any word, so
      // nothing straddles both scripts. This is the legitimate case the
      // whole design protects.
      `const s = t("auth.otp.enter_code", "Введите код подтверждения");`,
      `const s = "Здравствуйте, добро пожаловать!";`,
      // Pure-English text.
      `const s = "Enter your confirmation code";`,
      // False-positive class 1: an escape sequence must not glue onto a
      // following Cyrillic run. Scanning the PARSED value (a real newline,
      // not the two raw chars "\" + "n") keeps "n" from attaching to
      // "Уточняющий".
      `const s = "\\nУточняющий текст на следующей строке";`,
      // False-positive class 2: a regex is pattern syntax, not prose — the
      // \\b word-boundary metacharacter must not read as a Latin "b" glued
      // to the Cyrillic word that follows.
      "const re = /\\bготово/;",
      // False-positive class 3: a regex character class range boundary
      // puts a Latin letter directly next to a Cyrillic one (a-z next to
      // А-Я) — regex literals are skipped outright.
      "const re = /[a-zА-Я]/;",
      // Same adjacency outside a regex (a plain short string) is caught by
      // the minimum word length instead — "zА" is 2 chars, below the
      // 4-char floor.
      `const s = "zА";`,
      // A short, deliberately-adjacent pair below the length floor either
      // direction.
      `const s = "Zа-9";`,
    ],
    invalid: [
      // The canonical homoglyph: reads as Latin, greps as neither script.
      {
        code: `const slug = "miттudei";`,
        errors: [{ messageId: "mixedScript", data: { word: "miттudei" } }],
      },
      // A compound word long enough to clear the minimum length floor.
      {
        code: `const s = "dataдата";`,
        errors: [{ messageId: "mixedScript", data: { word: "dataдата" } }],
      },
      // Inside a template literal, isolated by non-word delimiters (a real
      // fleet hit shape: a section-style token surrounded by hyphens).
      {
        code: "const s = `prefix-Q12а-suffix`;",
        errors: [{ messageId: "mixedScript", data: { word: "Q12а" } }],
      },
      // A mixed-script word past an embedded newline in a template literal
      // — must still resolve to the correct line, not the template's
      // opening line.
      {
        code: "const s = `line one\\nmore text miттudei`;",
        errors: [{ messageId: "mixedScript", data: { word: "miттudei" }, line: 2 }],
      },
    ],
  });
});
