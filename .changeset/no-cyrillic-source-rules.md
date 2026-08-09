---
"@stapel/eslint-plugin": minor
---

Two new rules, wired into `recommended`: **`stapel/no-cyrillic-source`** and
**`stapel/no-mixed-script-word`** — the frontend half of the fleet-wide
English-only source canon (owner ruling 2026-08-09; the Python-side check
lives in stapel-tools). Source is English-only across the fleet:
identifiers, comments, JSDoc, developer-facing log strings, commit messages.
Russian UI copy inside translation catalogs is NOT affected.

`no-cyrillic-source` flags Cyrillic in a comment, a JSDoc block, or an
identifier (variable/function/class/type/property name). It deliberately
never looks at plain string literals — i18n catalog values, fixtures, and
sample content are the legitimate case — which is the whole design: because
string literals are exempt, the rule needs no path allowlist, and a rule
with no allowlist is one nobody learns to silence wholesale. Reports land on
the line the Cyrillic actually sits on (never collapsed onto a block
comment's or file-leading JSDoc's opening line), so a suppression directive
placed before it has somewhere to attach.

`no-mixed-script-word` is the literal-scanning counterpart: it DOES look
inside string and template literals, because no legitimate text mixes
scripts mid-word. It catches the homoglyph shape a plain Cyrillic-presence
check misses — `miттudei` (Latin у vs Cyrillic и/т), `Q12а` (Latin Q,
Cyrillic а) — while staying silent on pure-Cyrillic i18n text. It scans the
*parsed* value of string/template literals (so a `\n` escape can't glue onto
a following Cyrillic run and misread as a mixed word), skips regex literals
outright (`\b`, `[a-zА-Я]` are pattern syntax, not prose), and applies a
4-character floor so an adjacent regex-range-boundary pair like `zА` stays
silent while `dataдата` still fires.

Both rules are off only in tests (their own fixtures deliberately contain
Cyrillic/homoglyph words); everywhere else, including i18n catalog files,
they stay on — the exemption is for the translated *copy*, not for comments,
identifiers, or homoglyphs living alongside it.
