---
"@stapel/workspaces-react": minor
---

Contract pin to stapel-workspaces 0.37.0, where `PATCH` merges `settings` and `null` removes a key. `useUpdateSecuritySettings` sends only the change (`{settings: {security: patch}}`) with no read before it, so it no longer re-sends every stored key (which raced a concurrent edit); a key is removed by sending `null` (`WorkspaceSecurityPatch`).
