---
"@stapel/core": patch
---

Fix `slugify`'s Cyrillic table to match the transliteration contract consumers use for addresses: `щ` now expands to `shch` (was `sch`), `ї` to `yi` (was `i`), and `є` to `ye` (was `e`). Every case from that contract is copied into this package's test suite as a shared contract.
