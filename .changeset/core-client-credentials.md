---
"@stapel/core": minor
---

`createStapelClient` accepts a `credentials?: RequestCredentials` option,
passed through to every fetch (including 401-refresh and verification-403
retries). Cookie-mode backends (HTTP-only JWT cookies) need `"include"` when
the API lives on another origin — the fetch default (`"same-origin"`) silently
drops cookies cross-origin, so bearer mode was previously the only mode that
worked cross-origin.
