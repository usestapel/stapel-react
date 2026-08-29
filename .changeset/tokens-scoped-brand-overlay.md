---
"@stapel/tokens": minor
---

`stapel-tokens --scope <brand-key>`: a second brand's tokens beside the first.

Two brands on one build need two role dictionaries in one bundle, chosen at
runtime. Emitting them as two default sets is not that — the second overwrites
the first, in the output directory and again in the cascade.

`--scope northgate` emits the same theme as an OVERLAY:

- selectors become `:root[data-brand="northgate"]` and
  `:root[data-brand="northgate"][data-theme="dark"]`, which out-rank the unscoped
  pair by specificity, so both stylesheets can be imported in either order and
  the attribute decides;
- every output filename gains a `.<key>` infix — `tokens.northgate.css`,
  `tailwind.northgate.css` — so a scoped run and the default run coexist in one
  `--out` directory instead of clobbering each other;
- `--check`, the drift gate, reads the scoped filenames too;
- the key must match `[a-z0-9-]+`: it lands in a selector and in a filename;
- `--pkg` is refused alongside it — the self artifacts (`tokens.ts`, `raw.ts`,
  `manifest.json`, `llms.txt`) describe the package, not a brand.

The `tailwind@3` RGB block is scoped with the core: an unscoped triplet
emitted from a brand's theme would repaint the other brand's host, which is
the one thing `--scope` exists to prevent. Unscoped output is byte-identical
to before.

`<html data-brand>` is written at runtime by `@stapel/core`'s
`<SiteProvider>`, from the host's own `site/` document.
