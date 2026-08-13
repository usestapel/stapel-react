---
"@stapel/workspaces-react": patch
"@stapel/notifications-react": patch
"@stapel/profiles-react": patch
"@stapel/recordings-react": patch
"@stapel/calendar-react": patch
"@stapel/billing-react": patch
"@stapel/auth-react": patch
"@stapel/shell-react": patch
"@stapel/analytics": patch
---

Raise the `@stapel/core` peer floor to the version that actually exports what each package imports.

`@stapel/workspaces-react` 0.15.0 shipped declaring `>=0.12.0` while importing
`LoadState`, which core did not export until 0.13.0. npm installed it happily;
the host's typecheck then failed on a type the package's own `.d.ts` referenced
and the host could not resolve. Nine packages were wrong the same way — most by
a wider margin (`recordings-react` allowed 0.3.0).

Nothing here could have caught it by building: in this monorepo every package
compiles against the workspace core, always the newest one, so a declared floor
is never the version anything is compiled against. `pnpm check:peer-floors` now
reads each package's imports from `@stapel/core`, asks core's own tagged history
which release first exported each name, and fails when the floor is older —
wired into CI **and** the publishing path, since a gate only on the merge path
does not stop a release.

Also invalidates the workspace audit query after an invite, a role change and a
removal: the history sits beside the roster and an admin who acts on one expects
to see it in the other. Its key is its own root, so the members invalidation did
not reach it.
