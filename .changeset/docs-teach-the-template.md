---
"@stapel/listings-react": patch
"@stapel/categories-react": patch
"@stapel/cdn-react": patch
---

Docs teach code that lints and type-checks. listings-react README/MODULE.md: the composer's features wiring is `mapLoad(loadStateFromQuery(useCategoryFeatures(id)), (r) => r.features)` with `featuresError` spread only on failure (it was `features.data?.features ?? []`, which `stapel/no-flattened-load-state` rejects, and a MODULE.md snippet that did not type-check); MODULE.md states that `useCategoryFeatures` answers `CategoryFeaturesResult` (an object), not an array. categories-react README says the same. llms.txt (all three): query hooks carry their return type, and a new "Other hooks" section states each exported hook's call shape with its REQUIRED options (`useUploadQueue(...) — required { max; target }`).
