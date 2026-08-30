---
"@stapel/categories-react": patch
"@stapel/listings-react": patch
"@stapel/search-react": patch
---

Regenerated against the attributes-v2 contract pins: stapel-categories 0.7.0,
stapel-listings 0.10.0, stapel-search 0.3.1.

What moves in the wire types: `FeatureCompact` and `ResolvedFeature` gain
`rules`, `description`, `example`, `default`, `hints` and `group` — the form
metadata an imported catalogue actually carries, which is what
`<FeatureFields>` draws sections, help lines, placeholders and hints from
instead of a host's hand-written table; `Category` gains `external_id`; the two
vocabulary-backed value types (`ref_select`, `ref_hierarchical_select`) appear
in the type enums; and the error registry gains
`error.400.feature_invalid_rules`.

search-react's regen is contract metadata only — the facet mapping for the two
ref types (`term` / `path`, and no `closed_options` for any config carrying an
`optionsRef`) is decided server-side in stapel-search 0.3.1 and reaches this
pair as facet rows, not as a new surface.
