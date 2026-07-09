---
"@stapel/eslint-plugin": patch
---

`no-direct-analytics-provider` follows the analytics restratification: the
provider-adapter carve-out now also matches `@stapel/analytics`' own
`src/providers.ts` (`**/analytics/src/providers.{ts,js}` in the recommended
preset's fetch + provider overrides), and the rule's message points at the
facade's new home (implementation `@stapel/analytics`, type seam
`@stapel/core`).
