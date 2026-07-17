---
"@stapel/profiles-react": minor
---

Owner UX audit of the default settings skins (2026-07-17):

- **Interaction canon** (codified in `docs/pending/frontend-guidelines.md`
  §8 "Интеракции настроек"): `ProfileSettings`/`LanguageSettings` no longer
  have a single "Save changes" button batching several fields into one PATCH.
  Every picker (currency/theme/language/units) applies REACTIVELY on
  `onChange` — `useUpdateMyProfile` is now itself optimistic (the cache
  updates before the round trip lands, via a new `onMutate`/`onError` pair)
  and rolls back visibly on failure. Display name is now a read-only row with
  an edit (pencil) affordance that opens a `Modal` (desktop) / bottom
  `Drawer` (phone) to edit + save, instead of a bare inline `Input`.
- **Units removed from the default render** (`ProfileSettings`): measurement
  units only matter to convertible catalog attributes, not a personal
  profile screen. The field stays fully supported in the backend contract
  (`measurement_units` via `useMyProfile`/`useUpdateMyProfile`); pass the new
  `showUnits` prop to opt back into rendering it here.
- **Language picker**: "Auto" is now the FIRST item of the app-language
  `Select` itself (picking it PATCHes `use_device_language: true`) instead of
  a separate switch next to the picker — and the picker's option list truly
  reflects whatever `GET /languages/` returns (see `stapel-profiles`'s own
  release for the backend half of this fix).
- Fixed a developer-facing string: the language-settings subtitle no longer
  mentions `stapel-translate` by name (now reads as plain user copy in both
  `en` and `ru`).
