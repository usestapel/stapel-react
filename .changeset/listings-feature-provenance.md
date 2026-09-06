---
"@stapel/listings-react": patch
---

**`bag.setFeature` stopped dropping the third argument.** `@stapel/attributes-react` 0.16.4 emits `onChange(slug, value, source)` because `<FeatureFields>` performs two write-backs of its own — a dependent field's answer cleared when its parent moved (`"cascade"`), and a value the narrowed config left as the only possible one (`"bake"`). This composer's setter took two arguments, so a host wiring `onChange={bag.setFeature}` lost the provenance silently and stamped a cascade reset as the seller's own answer.

`setFeature(slug, value, source?)` now carries it (`"user"` when omitted, which is what a two-argument call always meant), records it on the bag as `featureSources` — pruned with the value when a category change drops the slug — and reports it to the container through the new `onFeatureChange(slug, value, source)`.
