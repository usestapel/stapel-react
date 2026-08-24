---
"@stapel/forms-react": minor
---

Ship the feature, not just the backend: form settings, delete, nav, and the skin on the shared substrate.

**The gap that made this a minor.** `PATCH /forms/<id>` is the only writer of
`Form.settings`, and `Form.settings` is where a form's notification
destinations live. Both `useUpdateForm` and `useDeleteForm` were exported with
**zero callers** — so a form authored entirely through the shipped skin
collected responses that reached nobody, and could never be removed. The
module's whole `form.submission.received` → notification half was unreachable
from the product.

- **`<FormSettingsPane>` / `<FormSettingsEditor>`** — title, `notify_emails`,
  `notify_telegram_chat_ids`, `retention_days`. The `settings` bag is patched
  whole with the host's own unknown keys preserved (the backend REPLACES it);
  a malformed-looking address is a notice, never a refusal (the server does not
  validate them, so refusing would be a verdict this pair cannot give); the
  retention ceiling is a deployment setting no client can read, so a too-long
  override arrives as `error.400.forms_invalid_retention`. With nothing
  configured, the pane says so.
- **Delete a form** from `<FormsListPane>` through `SkinConfirm` — a danger
  confirmation naming the consequence, because a soft-delete also CLOSES an
  open form and its public link stops resolving immediately.
- **`src/nav/manifest.ts` + `nav-manifest.json`** — `forms.list`,
  `forms.builder`, `forms.responses` under the container-owned `account.root`.
  The anonymous `<StapelForm>` deliberately has none.
- **Workspace scope on the runtime**: `createFormsRuntime({ workspaceId })` +
  `useFormsWorkspaceId()`. `workspaceId` is now OPTIONAL on the three admin
  panes — a routed screen has only the address. With neither declared, the
  screen says so instead of rendering an empty list.

**BREAKING (pre-1.0 = minor).** `FormsSkinTheme` and this pair's local
`ErrorAlert` are removed from `@stapel/forms-react/default`. Both were per-pair
copies of a fleet rule and now live once in `@stapel/tokens-antd/skin` as
`SkinTheme` (plus a `surface` prop) and `ErrorAlert`. Every surface migrated to
the substrate: `SkinTheme`, `LoadBoundary`/`LoadList`, `EmptyState`,
`ErrorAlert`, `SkinConfirm` (the last `Popconfirm` is gone) and `GatedButton`
(reasons beside controls, wired with `aria-describedby`). Peer floors move to
`@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

**Freshness is now declared, not implied.** stapel-forms ships no realtime
consumer — MODULE.md §11 reserves `forms:ws:<workspace_id>` for one that does
not exist — so `<ResponsesPane>` is refetch-only and says so on screen, with a
visible control. No background timer: a table that reorders under a reviewer
mid-read is worse than a stale one.

Also: six default-skin demos (previously 0 — every story was a harness dump),
each seeded so its variants photograph distinct states; all raw dimensions on
`@stapel/tokens` or a named geometry constant; `es`/`ru` complete for every new
key.
