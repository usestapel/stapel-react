# @stapel/attributes-react

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
