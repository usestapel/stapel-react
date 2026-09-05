---
"@stapel/eslint-plugin": patch
---

`stapel/no-raw-storage`: `**/core/src/session.{ts,js}` joins `STORAGE_ALLOWED`.

The file was already the named exception for `no-adhoc-401` — it is where the
single-flight refresh lives — and carried an inline `eslint-disable` for this
rule on top. The reason is structural, not local: `SessionManager` is what
`createRepository` is BUILT ON, so it cannot persist through it, and its one
raw read is the cross-reload refresh-handoff marker (per-tab, readable
synchronously at construction, deliberately not wiped at logout — the opposite
kind of value from the one §43.4 guards). A structural exception belongs in
the preset, where anyone reading it can see it, not in a paragraph at a line
only the file's next reader will find.
