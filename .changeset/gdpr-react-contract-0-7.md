---
"@stapel/gdpr-react": patch
---

Regenerated against **stapel-gdpr 0.7.1**: the pin was two minors behind
(0.5.8), which failed the fleet's contract-freshness gate. The declared
backend contract moves from `>=0.5 <0.6` to `>=0.7 <0.8` in `manifest.json`
and `llms.txt`.

**Wire changes.** `429` is now a declared response on `POST
/gdpr/api/v1/dsar`, the account-close route and the data-export-request
route (security audit 2026-09-11 L-6: a rolling hourly budget per caller,
spent before anything is recorded or mailed, on doors that previously had
only a captcha that is a no-op with no captcha backend configured). Five
operation descriptions gain a paragraph documenting that a guest session
reaches its own erasure/export/close routes on purpose — text only, no
shape, gate or required-field change. `error_language`'s description moves
to match stapel-core 0.62.0's wording, already applied everywhere else.
`docs/errors.json` and `docs/flows.json` are unchanged.

**Not from this bump.** The two releases that motivated moving the pin off
0.5.8 in the first place — 0.7.0/0.7.1, the export-location fix
(`EXPORT_ROOT` stops defaulting inside `MEDIA_ROOT`, `archive_path` becomes
a store key instead of an absolute filesystem path, orphaned peer-uploaded
export slices get deleted) — are internal only: `docs/schema.json` is
byte-identical for both. The download endpoint's shape was already correct
and does not move. All three new `429`s are handled by this package's
existing generic `ErrorAlert` fallback (verified: `isExportCooldown` and
friends match specific error *codes*, not status classes, so the new
`error.429.rate_limit` code falls through to the same unrecognized-error
rendering every other refusal on these surfaces already uses) — no
component code needed to change and none did.
