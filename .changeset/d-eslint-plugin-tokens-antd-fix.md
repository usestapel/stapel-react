---
"@stapel/eslint-plugin": patch
---

`no-raw-dimensions` autofix imports from the module the file is allowed to depend on

Inside `src/default/**` the fix now writes `from "@stapel/tokens-antd"` (which
re-exports `spacing`/`radii`/`fontSize`/`cssVar`/`breakpoints` for exactly this
reason), so a pair's only design-system dependency stays the antd bridge it
already declares. Outside a default skin the fix keeps writing
`from "@stapel/tokens"` — there is no antd leg to route through.

This closes a real hole rather than a stylistic one: the fix wrote a bare
`@stapel/tokens` import into 274 sites across twenty pairs, and not one of those
pairs DECLARES that package — it resolved only because the consumer's tree
happened to hoist. A binding the file already imports from either module is not
imported a second time (a duplicate declaration is a syntax error, produced by
an autofix); an existing import of the target module is extended in place.
