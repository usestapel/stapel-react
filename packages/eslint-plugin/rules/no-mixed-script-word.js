// stapel/no-mixed-script-word — fleet-wide English-only source canon (owner
// ruling 2026-08-09), the literal-scanning counterpart to no-cyrillic-source.
// A single WORD that mixes Latin and Cyrillic letters is a homoglyph — the
// header below documents that using the actual offending example words,
// which is the one legitimate reason source comments carry Cyrillic at all
// (spelling out the attack IS the documentation, hence the scoped disable
// below rather than rewording every example into a description of itself).
/* eslint-disable stapel/no-cyrillic-source -- these lines document the rule with the real Cyrillic/mixed-script example words it exists to catch. */
// `miттudei` reads as Latin, greps as neither script cleanly, and survives
// review because the eye cannot tell Cyrillic и/т apart from Latin i/t.
//
// Unlike no-cyrillic-source, this rule DOES look inside string and template
// literals — no legitimate text mixes scripts mid-word, so there is nothing
// to exempt, and (per the sibling rule's design note) no path allowlist to
// learn to silence wholesale.
//
// Three deliberate false-positive guards, each earned by a real miss during
// the Python-side draft of this same check:
//   1. Scans the PARSED value of string/template literals (`node.value` /
//      `quasi.value.cooked`), never raw source text. By the time we
//      tokenize `"\nУточняющий"` its `\n` is already a real newline
//      character — a non-letter — so it cannot glue onto the following
//      Cyrillic run and read as a mixed-script word "nУточняющий".
//   2. Regex literals are skipped outright. A regex's `\b` (word-boundary
//      metachar, as in `/\bготово/`) and character classes like
//      `[a-zА-Я]` are pattern syntax, not prose — scanning raw pattern text
//      reproduces exactly the two glued-letter false positives above,
//      because there is no "cooked" value to fall back on for a RegExp
//      literal the way there is for a string.
//   3. A minimum word length (4) is the last line of defence against
//      adjacent-letter noise that survives tokenizing, e.g. a Cyrillic
//      range boundary `[a-zА-Я]` inside a STRING (not a regex) still puts
//      `z` directly next to `А` — length 2, filtered — while `dataдата`
//      and `miттudei` (length ≥ 4) still fire.
/* eslint-enable stapel/no-cyrillic-source */
const WORD_RE = /[A-Za-z\u0400-\u04FF][A-Za-z0-9\u0400-\u04FF]*/g;
const LATIN = /[A-Za-z]/;
const CYRILLIC = /[\u0400-\u04FF]/;
const MIN_WORD_LENGTH = 4;

function isMixedScript(word) {
  return word.length >= MIN_WORD_LENGTH && LATIN.test(word) && CYRILLIC.test(word);
}

// Map an offset into `text` to a line/column relative to `startLoc`, given
// `prefixLength` extra source chars before `text` starts on its first line
// (e.g. the opening quote of a string literal). Exact on the (overwhelmingly
// common) single-line case; on a match past an embedded newline, exact on
// the line number — what suppressability depends on — and best-effort on
// the column, since an escape earlier in the same physical line can make
// the cooked value shorter than the raw source that produced it.
function makeLocator(startLoc, text, prefixLength) {
  return (index, length) => {
    const before = text.slice(0, index);
    const newlineCount = before.split("\n").length - 1;
    if (newlineCount === 0) {
      const column = startLoc.column + prefixLength + index;
      return {
        start: { line: startLoc.line, column },
        end: { line: startLoc.line, column: column + length },
      };
    }
    const column = index - (before.lastIndexOf("\n") + 1);
    return {
      start: { line: startLoc.line + newlineCount, column },
      end: { line: startLoc.line + newlineCount, column: column + length },
    };
  };
}

function scanText(context, text, locator) {
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(text)) !== null) {
    if (!isMixedScript(m[0])) continue;
    context.report({
      loc: locator(m.index, m[0].length),
      messageId: "mixedScript",
      data: { word: m[0] },
    });
  }
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a single word mixing Latin and Cyrillic letters (a homoglyph) inside string and template literals.",
    },
    schema: [],
    messages: {
      mixedScript:
        'Mixed-script word "{{word}}" mixes Latin and Cyrillic letters — a homoglyph a reviewer cannot see (e.g. Cyrillic а/е/о/р/с/т/х next to Latin letters). Fleet source is English-only; pure-Cyrillic i18n text is fine on its own, but no single word may straddle both scripts.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (node.regex) return; // pattern syntax, not prose — see header
        if (typeof node.value !== "string") return;
        scanText(context, node.value, makeLocator(node.loc.start, node.value, 1));
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        scanText(context, text, makeLocator(node.loc.start, text, 0));
      },
    };
  },
};
