---
"@stapel/core": patch
---

The i18n engine grows formatters: dates, relative times, durations and numbers, at the APP's locale.

Sixteen pairs had independently written the same `src/model/format.ts` — `useWorkspaceFormat`, `formatInstant`/`formatDuration`, `formatReviewDate`, `useAuthDateFormat`, and a dozen more — and nine of wave B's request files asked, in nearly the same words, for it to live here. The brief's own rule ("dates through core's i18n helpers **if they exist**") was satisfied by nothing existing: the engine shipped `t`/`tPlural` and nothing numeric.

The copies did not all decide alike, which is the real cost: an unreadable instant rendered as `null`, as `undefined`, as the raw ISO string or as an empty span depending on the pair; a "date" was `dateStyle: "medium"` here and `{year, month: "short", day}` there; the relative/absolute cutoff moved; and a malformed locale tag threw in some and was caught in others.

- `formatDate` / `formatDateTime` — month named, never `08/09`; per-call shape override.
- `formatRelative` — `Intl.RelativeTimeFormat` with `numeric: "auto"`, `now` injectable so a test is not a race, and a cutoff (default one year) past which it hands back to a date, because "in 4 years" is not something anyone can act on.
- `formatDuration` — seconds, as a `clock` timecode (`1:02:03`) or in the reader's `units`.
- `formatNumber` — thousands separated the way the reader's language separates them.
- `createFormat(locale)` and `useFormat()` — every method bound to one locale; the hook follows a runtime language switch, so dates move with the sentences. It uses `useOptionalI18n`, so it renders outside a provider instead of throwing: a date is not a translated string.

Every function answers `null` for an instant or a number it cannot read, and degrades an unknown locale tag to the runtime default instead of throwing — the contract `pluralCategory` already held. `Intl` instances are cached per locale and shape, so a 200-row list constructs one, not 200.

Deliberately not here, and why, in the module header: money (a currency contract, `@stapel/currencies-react`'s), bytes (a two-line caller of `formatNumber`), and anything that returns a sentence (those are keys). Migration for the per-pair copies: `SCRATCH/wave-b/SHARED-API.md` §9.
