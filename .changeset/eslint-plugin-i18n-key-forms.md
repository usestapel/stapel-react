---
"@stapel/eslint-plugin": minor
---

`stapel/i18n-key-exists` resolves the forms a real call site takes instead of
skipping them.

Every branch of a literal ternary is checked; a plural family via
`tPlural("…")` is checked as `<key>.other` (`options.pluralFunctionNames`);
a template key `` t(`a.b.${x}`) `` is checked by its static head, so a
renamed or deleted family under that head is caught. A key built from a
variable cannot be resolved and is ignored by default, because reporting it
would be a guess; `options.dynamicKeys: "report"` surfaces those under their
own `dynamicKey` message. `options.requireRegistry: true` makes the rule fail
when no catalogue is configured — without it a mis-wired project got a silent
no-op that read exactly like a passing gate. Defaults unchanged.
