---
"@stapel/eslint-plugin": minor
---

New rule **`stapel/no-reserved-backend-route`** (owner directive: the SPA
router must not claim a reserved backend sub-path): flags an SPA route
(`<Route path="…">`, a `createBrowserRouter`/`createHashRouter`/
`createMemoryRouter` array literal, or any RouteObject-shaped `{ path, element/
Component/children/index/errorElement/loader/action/lazy }`) whose path falls
into a reserved backend sub-path — `/<mod>/api/…`, `/<mod>/swagger…`, or the
project-wide `/admin`, `/staticfiles`, `/media` (§57 nginx canon). A bare
module root (`/calendar`) is legitimate and never flagged — roots belong to
the frontend, only sub-paths collide.

Data-driven: reads the flat `reservedPathPrefixes` array from a project-root
`reserved-paths.json` (the projection stapel-tools' generator emits), or
`settings.stapel.reservedPathsFile`/`reservedPaths`. A missing catalog
degrades the rule to a no-op — it never fails the lint run. In the
`recommended` preset; off in tests/fixtures.
