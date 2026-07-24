---
"@stapel/workspaces-react": minor
---

Org-program wave (spec §A2/§B4/§E): mandate model surface + invite flow.

- **model**: `useCapabilities(wsId)` (reads `my_capabilities` off the workspace detail; wildcard-aware `can()`), `useRoles()` (GET /roles — the effective registry), `useInvitationPreview(token)` (AllowAny — deliberately NOT session-gated), `useClaimInvitation`, `useDeclineInvitation`. Backend-ported, semantics-synced utils: `capabilityMatches`/`hasCapability` (`*` and `prefix.*`) and `maskEmail`/`emailMatchesMask` (the preview's mask algorithm — drives §B4 session/email routing client-side without exposing the invitee's address).
- **headless**: `Can` (static-children gate + render-prop verdict; deny-by-default — UI convenience, backend re-checks), `RoleSelect` (registry-driven roles; labels via `workspaces.role.<key>` with client-bundle merge and RAW-name fallback), `InviteAcceptFlow` — the §B4 flow machine (preview → accept-prompt / wrong-account / login slot / claim → grant → basic-data slot → accept/decline, terminal `unavailable` for dead invites).
- **THE GRANT SEAM**: pairs don't depend on each other — `claim` hands the minted `grant_token` OUT via `onLoginGrant(grantToken)`; the HOST exchanges it at auth (`@stapel/auth-react`'s `exchangeLoginGrant`) and calls `grantExchanged()`. `InviteAcceptPage` automates the advance when the host callback's promise resolves.
- **default**: `InviteAcceptPage` (the `/invite/{token}` route component — every flow state, with `renderLoginPanel`/`renderInitialSetup` host slots for auth-react and profiles-react); `MembersManager` now takes its role options from the registry via `RoleSelect` instead of the hardcoded builtin four.
- **types**: `InvitationPreview`, `InvitationClaim`, `RoleInfo`, `RoleList`; `MemberRoleChange.role` widened to `string` (registry-extensible roles). Generated types regenerated against stapel-workspaces v0.8.0 — the 0.8 provision/suspension/security contract shapes are already carried; their model/headless/skins land in the next wave.
- **i18n**: `workspaces.role.*` (builtin four), `workspaces.invite.*` (all flow states), en + ru.
- Contract pin: stapel-workspaces → v0.8.0 (`df58135`), regen'd together.
