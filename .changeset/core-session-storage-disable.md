---
"@stapel/core": patch
---

`SessionManager` drops its inline `eslint-disable stapel/no-raw-storage`: the
refresh-handoff marker's carve-out is now structural, in the plugin's
`STORAGE_ALLOWED` beside the `no-adhoc-401` exception the same file already
had. The reasoning stays at the site as an ordinary comment; the code is
unchanged.
