---
"@stapel/workspaces-react": minor
---

The pair becomes the product: the delete button stops lying, the MFA policy gets a screen, and the invitation console exists

**The refusal a screen used to promise.** `<WorkspaceSettings/>` drew "Delete
workspace" from `my_role === "owner"` — the exact derivation stapel-workspaces
0.26.0 added `WorkspaceResponse.can_delete` + `delete_blocked_reason` to
replace, because an owner of the instance's default workspace or of a personal
one gets a 409. The control now reads the server's verdict through
`GatedControl`, and prints the server's own refusal CODE as a sentence beside
it — translatable at last, because the generated error bundle was five codes
behind the backend (`error.409.workspace_is_instance_default`,
`workspace_is_personal`, `error.429.invitation_grant_pending`,
`error.503.billing_unavailable`, `error.503.mandate_unavailable`). The test
that cemented the old rule now asserts the new one. Name and security editing
are gated on the CAPABILITIES the server granted (`workspace.update`,
`workspace.security.manage`), falling back to the pre-0.6 owner rule only when
a backend sends no `my_capabilities` at all.

**Four screens that were hooks with no pixels.** `<WorkspacesPage/>` (the §54
default skin `WorkspaceList` never had: roster, create gated on
`can_create_workspace`, preferred-workspace choice, guest and closed-instance
copy), `<InvitationsPane/>` (list / revoke / resend / rename — four API methods
and zero pixels until now, each control gated on the invitation state the
endpoint would refuse), `<AuditTrailPane/>` (the membership history, action
vocabulary as sentences, timestamps as "3 days ago (23 Sept 2026, 09:00)"), and
`<RoleSelectField/>` (a real `<Select>` with an accessible name and the rank as
a caption, where the story used to show five bullet points).

**MFA enforcement, visible.** `mfa_enforcement` (state, coverage, unverified
members, last error) is drawn beside the `require_mfa` switch that
`useUpdateSecuritySettings` now actually has a consumer for, and
`MemberResponse.mfa_compliant` is a per-member tag with three states — true,
false, and "nobody has asked yet".

**Members reach page two.** `<Members>` takes `params` and exposes `page`
(anchor cursors + `has_next`/`has_prev`); the roster ships a pager and a
search box. `rosterComplete` now also requires `has_prev === false`, so the
last-owner claim is not made from the last page of a longer roster.

**Substrate migration.** Local `src/default/ErrorAlert.tsx` deleted; every
screen self-themes through `<SkinTheme>`, confirms are `SkinConfirm` (no
`Popconfirm`), load arms are `LoadList`/`LoadBoundary`, blocked controls are
`GatedButton`/`GatedControl`, and the unfilled `renderLoginPanel` slot renders
a `SlotPlaceholder` instead of a hole. Doctrine lint: 99 warnings → 0.

**i18n.** `es` went from 1 translated UI key to complete; `ru` stays complete
over a bundle that roughly tripled. Counts render through CLDR plurals
(`useTPlural`) instead of `1 workspace(s)`, and dates through a new
`useWorkspaceFormat()` in the model layer instead of raw ISO.

BREAKING (pre-1.0, hence minor): `MembersBag` gained `page`/`rename`/
`isRenaming`, `RoleSelect`'s `labelFor` now title-cases an unlabelled registry
role (`secretary` → `Secretary`) instead of returning the raw token, and
`src/default/ErrorAlert.tsx` is gone — import `ErrorAlert` from
`@stapel/tokens-antd/skin`.
