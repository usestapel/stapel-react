---
"@stapel/tokens-antd": minor
---

`/skin` becomes the shared skin substrate: the rules every antd default skin inherits instead of re-deciding.

Nine pairs carried a copied `src/default/theme.tsx`; fifteen carried a copied `ErrorAlert.tsx` in six flavours; nine sites rendered a `Popconfirm` on a phone; blocked controls explained themselves in tooltips nobody can hover. Each of those is a design-system decision re-taken per component, and a decision re-taken is not a decision. This release states each one once, in the package every antd skin already depends on.

- **`SkinTheme` + `useThemeMode()`** — the ONE self-theming wrapper. `mode` defaults to the document's LIVE `data-theme` (reactive: `useSyncExternalStore` + a MutationObserver), never `"light"`, so a runtime toggle re-themes mounted skins and a dark deployment is dark on the first frame. It paints its own surface (`raised` by default, `base`, or `bare` to opt out) so typography never lands on a host page of the other side, and on a phone it raises antd's `controlHeight` to 44px so every control in every pair is a touch target.
- **`SkinConfirm`** — a confirmation is a dialog: a bottom sheet on a phone, a small modal on desktop, through `SkinDialog`. Controlled (`open`, `confirming`), `danger` variant (red, cancel focused first, backdrop does not answer), labels from core's floor unless the action names itself.
- **`ErrorAlert`, `EmptyState`, `LoadBoundary`, `LoadList`** — the union of the fifteen copies' props (`error` described, `thrown` raw, `message`, `onRetry`, `onDismiss`, `action`, `variant="block"|"inline"`), a designed empty state (icon, title, hint, action), and `matchLoad`/`matchList` as components with default loading/failed/empty arms.
- **`GatedControl` / `GatedButton`** — a control plus its `ActionAvailability` reason as visible text beside it, linked by `aria-describedby`. Never a tooltip: a disabled button is not hoverable or focusable.
- `useDialogSurface` documents why a DIALOG reads the viewport while everything inside a box measures the box.
- `THEME_ATTRIBUTE` is exported from the root.

Peer: `@stapel/core >=0.17.0` (the substrate's copy comes from core's `stapel.ui.*` floor in en/ru/es). `@stapel/eslint-plugin`'s `no-bare-dialog` gains `Popconfirm` in its own release.
