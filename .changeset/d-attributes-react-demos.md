---
"@stapel/attributes-react": patch
---

Demos: the antd skin is photographed for the first time, and held there by a gate.

`demo/` did not exist, so the default-skin gate read `0/4 covered` — the ten
builtin value editors, the unsupported-type notice and both display surfaces
had never been rendered in a story. Three `defineDemo` sources now cover all
four `/default` exports (`FeatureFields`, `UnsupportedValueEditor`,
`FeatureBadges`, `FeatureValueList`) with **all ten builtin value types** drawn
across their variants, every variant declaring the `viewport` it was designed
for and the `step` it opens SEEDED at — so a static shot photographs the state
its name claims instead of one idle frame under five names.

- `demo/fixtures.ts` — rows shaped as `GET /categories/{id}/features/` sends
  them: `config` carries only the keys an admin set (that endpoint serializes
  `obj.config` verbatim), `name` is admin content rendered as-is, and option
  labels / `postfix` / `trueLabel` are catalogue KEYS resolved through `t()`.
- `demo/_harness.tsx` — a translator and the shared `SkinTheme`, and nothing
  else: no debug card, no class-name heading, no state chip.
- `attributes.fields` (5 variants), `attributes.unsupported` (3),
  `attributes.display` (4) — including the locked control with its reason, the
  minimum-selected hint, the code-point counter, refusals landing under their
  own control, and the submit blocked by FEATURE name rather than type slug.
- `test/demos.test.tsx` — glob discovery, a smoke render per demo,
  `assertVariantsRenderDistinctly` per demo, and an assertion that every
  `BUILTIN_VALUE_EDITOR_TYPES` entry appears in a demo fixture.
- `test/responsive.test.tsx` — all four skin surfaces at phone and desktop
  width on both sides of the theme (16 cases), plus a sweep asserting no
  builtin editor is desktop-only. The viewport and theme are mocked at the
  environment edge (a real `matchMedia` over a real `innerWidth`, a real
  `data-theme`), never by stubbing the hooks.

`@stapel/showcase` joins the devDependencies. 168 tests (was 142); lint 0/0.
