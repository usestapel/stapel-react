---
"@stapel/auth-react": patch
"@stapel/notifications-react": patch
"@stapel/profiles-react": patch
"@stapel/billing-react": patch
"@stapel/workspaces-react": patch
"@stapel/calendar-react": patch
"@stapel/recordings-react": patch
---

v1 canon sweep §60 (api-versioning.md §2, §6): regenerated schema.ts /
flows / manifest / llms.txt against the backends' `/…/api/v1/` contracts;
gen scripts and manifest tag prefixes repointed to `/api/v1/`; documented
`baseUrl` examples and the auth QR same-origin guard now use
`/<mod>/api/v1/`. Public TS types unchanged — only the fetch base / path
literals carry the new version segment. Mount your runtimes at
`/<mod>/api/v1/`.
