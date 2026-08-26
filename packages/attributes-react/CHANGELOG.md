# @stapel/attributes-react

## 0.3.1

### Patch Changes

- ba97390: Demos: the antd skin is photographed for the first time, and held there by a gate.

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

- 0921578: Every `/default` surface is its own skin root, and the composer's chips are a touch target.

  **Nothing in `src/default/**`wrapped itself.** The package draws form rows,
not pages, and it took that as licence to render no`SkinTheme`anywhere — so
on a dark document with no`ConfigProvider`above it, antd fell back to its
light algorithm and the ten editors painted light inputs and near-invisible
help text on a dark form.`FeatureFields`, `UnsupportedValueEditor`,
`FeatureBadges`, `FeatureValueList`and every builtin editor in`BUILTIN_VALUE_EDITORS`now render inside`SkinTheme surface="bare"`: the theme
  applies, the paint stays the host's, and a host that wraps the composer too
  pays nothing (nested skins reuse the applied config and render no second
  provider).

  **The test proved the test.** `test/responsive.test.tsx` already rendered every
  surface at phone/desktop × light/dark and asserted a skin root on the
  document's side — inside a `SkinTheme surface="base"` the test itself
  supplied. It renders with no skin above it now, so the assertion is about the
  component; the phone case asserts `data-stapel-skin-phone`, the branch the
  44px `controlHeight` comes from.

  **Chips at 27px.** `SkinTheme` raises antd's `controlHeight` to 44px on a phone
  VIEWPORT, and the listings composer draws these rows in a narrow form column on
  a full desktop — where the visual pass measured the segmented feature chips at
  ~27px. `FeatureFields` measures its own column with `useElementWidth` (the
  substrate's one measurement) against the `tablet` breakpoint and publishes the
  answer to the editors through context, since a registry-resolved editor cannot
  see its host. Below it, a `select` drawn as chips holds its labels to the touch
  floor, so the chip lands on 44 regardless of how wide the window is.

## 0.3.0

### Minor Changes

- 80617e9: Close the config-vocabulary gap between the validation mirror and the controls, and give the feature form a headless level.

  **The class.** The editors read roughly half the config keys `validate.ts` reads, so a well-configured category rendered as a set of unconstrained inputs that the mirror or the server then refused — §83's "a control that offers something meaningless in the current state", with a round trip attached. This closes it and adds the gate that keeps it closed: `test/configKeys.test.ts` extracts, from the SOURCE of both halves, the `config[...]` keys each type's mirror rule reads and each type's editor reads, and fails when the first is not a subset of the second — naming the key, the type and the editor.

  - **`hierarchical_select` reads its own `required`** (default `true`, `types/hierarchical_select/config.py`) for both the required marker and the mirrored refusal, through a new exported `featureAnswerRequired(feature)` — a per-type rule table, not an `if` on a slug. The pair read only `feature.mandatory`, so the field was unmarked and unmirrored while `publish_listing`'s raise-style `validate_dto` refuses an empty path with `mandatory_missing`.
  - **`string` / `int` / `float`** draw a picker when `options` is present — a closed `Select` when `allowCustom === false`, an `AutoComplete` (suggestions, free entry) otherwise — and carry `prefix` / `postfix` / `postfix1000`, `pattern` and `minLength` onto the control. `maxLength` becomes a live counter in the engine's own unit (code points), never a cap.
  - **`select`** honours `uiStyle` on both branches (`Segmented` / radio buttons / `Checkbox.Group`), treats an ABSENT `uiStyle` as `dropdown` (it previously read absent as "not dropdown" and rendered inline where the config said otherwise), states `minSelected` beside the control, and renders `lockUserInput` as a `GatedControl` with the reason rather than a bare disabled box.
  - **`date`** derives its bounds from `allowFuture` / `allowPast` as well as `minDate` / `maxDate`, offers `options` as a picklist, and honours `lockInput`. `config.default` seeds the new headless hook.
  - **`hierarchical_select`** prunes the option tree at `maxDepth` and drops `changeOnSelect` when `minDepth > 1`, so a path the engine would refuse is no longer selectable.
  - **`hex_color`** draws each colour category as a colour and resolves each option's `label` through `t()`.
  - **`bool`**'s `trueLabel` / `falseLabel` and every `prefix` / `postfix` / `postfix1000` now pass through `t()` — upstream declares all of them translation keys in `get_translation_keys(config)`. New `src/default/labels.ts` is the one place that happens.

  **New: `useFeatureFields`** — the headless half of `<FeatureFields/>` (§54). Values, the DTO envelope, the mirrored verdict, errors routed by slug, `touched` / `showAllErrors`, and an `ActionAvailability` submit gate that names its reason. `initialFeatureValues` seeds a form from the features' own configured defaults.

  **Display.** `formatFeatureValue` resolves a `hierarchical_select` path through the option tree (it printed the stored values: `passenger / sedan`), applies the engine's `postfix1000` scale-and-unit switch at a thousand, and translates `prefix`/`postfix`/`trueLabel`/`falseLabel`.

  **Copy (visual class C-DEVCOPY).** The unsupported-type notice and the unreadable-value cell no longer render a type slug or "this build": `size_grid` is an identifier out of a Python registry and the release process is not a seller's problem. Both now carry `data-attributes-type` for support. `unsupportedTypeGate` names the blocked features by their display NAME (`{features}`, was `{types}`); new `unsupportedFeatureNames()` exposes that list, and `unsupportedTypes()` is unchanged for logs.

  **Breaking (pre-1.0 minor):** `attributes.unsupported_type` and `attributes.value.unreadable` no longer interpolate `{type}`; `attributes.submit.blocked.unsupported_type` interpolates `{features}` instead of `{types}`; the dead `attributes.required` key is gone. `ValueEditorProps` gains optional `required` (editors set `aria-required`); `FeatureRowProps` gains `help` and `unsupported`. Peer floors move to `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`. `manifest.json` declares `backend.contract ">=0.4 <0.5"`, so the contract-pin gate checks this pair instead of skipping it.

## 0.2.0

### Minor Changes

- 6c1f67e: New package: `@stapel/attributes-react` — the React value layer for
  `stapel-attributes`' dynamic feature types.

  L0, not a pair (modelled on `@stapel/image`): no client, no queries, no
  generated `schema.ts`, because its backend counterpart is an L1 library with
  no HTTP surface at all. Feature definitions and validation verdicts reach a
  browser inside the responses of the modules that own them, and those pairs
  depend on this one to draw and check what they carry.

  It switches on `config.type` — the VALUE type — which is a different axis from
  the `FormField.kind` that `@stapel/forms-react` keys on (the field kinds of
  the admin form that CONFIGURES a type). One consequence removes an upstream
  ask: a storefront needs no catalogue endpoint for these types, because the
  type arrives in the data on every feature.

  Main entry (no antd): the value-editor registry (`registerValueEditor` >
  skin builtin > loud unsupported, with `unsupportedTypeGate` blocking the
  submit and naming the reason), `mirrorValidate` returning the engine's own
  `ValidationBatchResult` shape with the engine's own `error.400.feature_*`
  keys, `featureErrorsBySlug` to lay a verdict on the controls that caused it,
  `toFeaturesDto`/`fromFeaturesDto` for the `{slug: {type, value}}` envelope,
  and React-free display formatting.

  `./default`: antd editors for all ten builtin types, `<FeatureFields>`,
  `<FeatureBadges>`, `<FeatureValueList>`.

  The mirror gets two easy-to-miss contract details right — `pattern` is a full
  match (`re.fullmatch`) and string length is counted in Unicode code points —
  and deliberately stands down on an unknown value type and on
  `convertible_unit`'s range, whose base-unit conversion table is server-side.
