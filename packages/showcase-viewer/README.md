# @stapel/showcase-viewer

Private, unpublished **introspection app** (frontend-guardrails §4.1, §5): a thin
[Ladle](https://ladle.dev) (Vite) viewer that renders the generated CSF stories
from every package's `demo/generated`. The demo **format** is ours
(`@stapel/showcase` → `defineDemo`); the viewer is a commodity.

Not a component library, not published, **never in any production bundle** — a
separate entry point by construction (§5.1).

## Commands (from the stapel-react root)

- `pnpm showcase` — serve the viewer for local development (not gated).
- `pnpm showcase:build` — build the deployable static site, **gated by
  `STAPEL_INTROSPECTION`** and precompressed (Brotli/gzip) for `nginx
  brotli_static`. Output: `build/` (gitignored).

The theme toggle drives `data-theme` on `<html>`, which is exactly how
`@stapel/tokens` switches light/dark — demos re-theme for free (`.ladle/`).

## Deploying

`STAPEL_INTROSPECTION` gating, the nginx basic-auth + `brotli_static` recipe, and
CI wiring are documented in
[`docs/deploy-introspection.md`](../../docs/deploy-introspection.md).
