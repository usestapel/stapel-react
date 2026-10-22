---
"@stapel/listings-react": minor
"@stapel/categories-react": minor
---

Contract pins move to stapel-listings 0.24.0 and stapel-categories 0.25.0, whose schemas pin every enum name: the drf-spectacular collision names (`StatusD41Enum`, `Type104Enum`, …) are gone from the generated `schema.ts` in favour of stable ones (`ListingStatusEnum`, `ConvertibleUnitTypeEnum`, …). `ListingLifecycleStatus` reads `ListingStatusEnum`. A host that referenced a collision name in the generated types renames it.
