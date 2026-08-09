---
"@stapel/workspaces-react": minor
---

Active-workspace selection, in the library instead of in every product.

`WorkspaceSelectionProvider` + `useWorkspaceSelection` resolve "which
workspace am I in" from three layers, and the order between them IS the
design: **URL > localStorage > backend preference**, then the instance's
`default_workspace_id`, then the personal workspace, then — last, and only
last — the first row.

`workspaces[0]` was the rule every product invented for itself, and it is
#239: the list is ordered by `-last_accessed_at`, so the first row is
"wherever you happened to be last", not a choice, and the owner's pending
invitations sat in the org workspace while his screen showed his personal
one. It survives only as the final fallback, where it is trivially right for
the single-workspace majority.

The URL layer is what makes several tabs each work in a different workspace,
and it is bound through controlled props — `urlWorkspaceId` +
`onUrlWorkspaceChange` — so this pair still depends on no router. A library
reading `window.location` itself could not re-render on `history.pushState`
(which emits no event), and a `{read, write}` adapter has the same defect in
disguise. The host reads `?workspace=` however its router does and navigates
when asked; a query parameter, not a path segment, so no host is forced to
grow a `/w/:workspaceId/*` route prefix.

Multi-tab independence is a stated rule, not an accident: local storage is
read exactly ONCE, at mount, and never subscribed to. The obvious
"improvement" — a `storage` event listener to sync tabs — is precisely what
destroys the feature, because that event fires in the *other* tabs and would
drag tab B onto tab A's workspace.

The write policy separates context from choice. `switchTo` (a picker click)
writes all three layers, fire-and-forget on the backend so a flaky network
never blocks the switch. Resolving from a shared link writes *nothing* —
otherwise one pasted URL would permanently repoint its recipient's home. A
stale stored pointer is deleted rather than rewritten to the fallback, so an
ossified guess cannot outrank a later-corrected preference.

A URL naming a workspace the person cannot open (deleted, not a member,
suspended — the backend deliberately does not distinguish) lands them through
the rest of the chain, raises `urlWorkspaceInvalid` for a visible notice, and
replaces the address bar so the broken URL is not reachable with back. Never
a blank screen, and never a silent switch to another tenant's data.

Also adds `useSetPreferredWorkspace` / `useClearPreferredWorkspace` over
stapel-workspaces 0.20.0's `PUT`/`DELETE /me/preferred-workspace`, and
`source` on the bag so "why am I here" is answerable from outside.
