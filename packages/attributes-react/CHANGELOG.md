# @stapel/attributes-react

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
