---
"@stapel/profiles-react": minor
---

**BREAKING (default skin only):** `<ProfileSettings/>` (`@stapel/profiles-react/default`) is now data-driven, per `stapel-profiles` 0.5.0's field-constructor cut (`docs/pending/profile-fields.md`, "Дополнение владельца" §1 — the two-tier front-pair answer). The hardcoded display-name/currency/theme/units fields are gone; the skin now renders one row per entry of the new `GET /field-manifest` endpoint, widget picked by `entry.kind`:

- `text` (and `geohash`) → read-only + pencil → Modal (desktop) / Drawer (phone) to edit, same interaction canon as before.
- `bool` → a reactive `Switch`.
- `enum` → a reactive `Segmented` for ≤4 choices, else a `Select`.
- `model_ref` → a reactive `Select`; `currency_code` is the only field with a built-in options source today (`stapel-currencies` is a live catalog, not a fixed enum) — an unrecognized `model_ref` falls back to a text edit rather than disappearing.
- `geohash` is hidden unless the new `showGeohash` prop opts in.

The `showUnits` prop is REMOVED (measurement units left the hard `Profile` model entirely in stapel-profiles 0.5.0 — it's a `STANDARD_FIELDS` pick now, reflected automatically if a project's manifest selects it).

New surface: `useProfileFieldManifest()` (GET `/field-manifest`, public — no session gate), plus the `ProfileFieldManifestEntry`/`ProfileFieldKind` types and `ProfilesApi.getFieldManifest()`. `MyProfile`/`ProfileUpdate` are now OPEN envelopes (`& Record<string, unknown>`) — a project's swapped Profile model can carry identity/standard/custom fields this pair's own generated schema never declares, and the data-driven skin (or any host code) can read/write them by name with no cast.

Regenerated `api/generated/schema.ts` from stapel-profiles 0.5.0's `docs/schema.json` (the field-manifest response shape + the core `Profile` cut).
