---
"@stapel/workspaces-react": minor
"@stapel/billing-react": minor
"@stapel/notifications-react": minor
"@stapel/calendar-react": minor
"@stapel/recordings-react": minor
---

Gate top-level "the caller's own …" query hooks on `@stapel/core`'s new
`useActiveSessionReady()` (owner-diagnosed live incident, 2026-07-17): a hook
with no natural `enabled` condition of its own (`useWorkspaces`, `useWallet`,
`useTransactions`, `useSubscription`, `useNotificationFeed`/
`useInfiniteNotificationFeed`, `useCalendar`/`useEvents`/`useAvailability`,
`useRecordings`) fires the instant a component mounts — which used to race a
session still bootstrapping and read a live one as "expired". Detail hooks
keyed by an id (`useWorkspace`/`useMembers`/`useEvent`/`useRecording`) now
ALSO gate on session readiness in addition to their existing non-empty-id
check, since an id can be known synchronously (e.g. a URL param) before the
session settles.

Deliberately NOT gated: `useCatalog` (billing) and `useLanguages` (profiles,
unaffected by this changeset but worth noting for symmetry) — both are
public reference lists a signed-out visitor legitimately needs.

Zero manual wiring at any call site: `useActiveSessionReady()` reads
whichever `SessionManager` a session-owning module (e.g.
`@stapel/auth-react`'s `createAuthRuntime`) registered as "active", and
defaults to `true` (never blocks) when no such module exists in the host at
all.
