---
"@stapel/eslint-plugin": minor
---

New package: `@stapel/eslint-plugin` — the static-enforcement tier of the
frontend guardrails (frontend-guardrails §2). Data-driven rules that read the
same generated manifests the codegen writes (token catalog, i18n key registries),
so lint and code never drift; every message teaches the one right way and points
at the catalog.

Rules (flat-config `recommended` preset):

- **`no-raw-colors`** — hex/rgb/hsl/named colours in style objects and CSS
  templates, Tailwind arbitrary colour values (`bg-[#…]`), interpolated arbitrary
  values (`bg-[${x}]` — JIT-invisible), and bare raw-ramp references (`gray.500`).
- **`no-raw-token-import`** — `@stapel/tokens/raw` outside theme-config/showcase
  (off there via preset overrides).
- **`no-raw-fetch`** — `fetch`/`globalThis.fetch`/`new XMLHttpRequest()`/`axios`/
  `ky` outside the codegen api layer (off there via preset overrides).
- **`i18n-key-exists`** — `t("…")` keys absent from the generated registry, scoped
  to managed namespaces so host-local keys never false-positive.
- **`no-hardcoded-text`** — user-facing JSX text and `alt`/`title`/`placeholder`/
  `aria-*` literals.
- **`require-disable-description`** — every `eslint-disable` must carry a
  `-- reason` (§2.4 escape-hatch policy).

Also ships a self-contained **stylelint preset**
(`@stapel/eslint-plugin/stylelint/preset`): colour properties only via
`var(--stapel-*)`, no hex/rgb/hsl in CSS. Wired into the monorepo lint;
auth-react, tokens, and core all pass.
