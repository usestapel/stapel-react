/**
 * `@stapel/tokens-antd/skin` — the SHARED SKIN SUBSTRATE: the antd surfaces
 * and rules every `@stapel/<module>-react` default skin inherits instead of
 * re-deciding.
 *
 * ## Why this lives in the token bridge
 *
 * `@stapel/tokens-antd` is the only package EVERY antd default skin already
 * depends on — it is what makes a skin self-theming — so it is the only place
 * a design-system rule can be stated once and inherited by all of them
 * without inverting the dependency graph (a pair must not depend on the
 * shell, and `@stapel/core` is deliberately design-system-agnostic and
 * carries no antd). The root export stays what it always was — pure
 * functions, no components; this subpath is the antd SURFACE the bridge
 * owns, and a host that only wants the theme mapping never loads it.
 *
 * ## What is here, and the rule each one states once
 *
 *  - {@link SkinTheme} + {@link useThemeMode} — a skin self-themes from the
 *    document's LIVE `data-theme`, never a hardcoded side, and paints its own
 *    surface; phone controls are 44px.
 *  - {@link SkinDialog} + {@link useDialogSurface} — on a phone a dialog is a
 *    bottom sheet; modals are tablet/desktop only.
 *  - {@link SkinConfirm} — a confirmation is a dialog (so: a sheet on a
 *    phone), never an anchored popover.
 *  - {@link ErrorAlert}, {@link EmptyState}, {@link LoadBoundary},
 *    {@link LoadList} — the loading / failed / empty arms are designed once;
 *    "empty" is reachable only from a load that succeeded.
 *  - {@link GatedControl} / {@link GatedButton} — a switched-off control
 *    states its reason as visible text beside it, never in a tooltip.
 *
 * Copy the substrate needs for itself (retry, dismiss, confirm, cancel, the
 * empty-state default) comes from `@stapel/core`'s UI floor
 * (`STAPEL_UI_KEYS`, en/ru/es), so it is translated with zero host wiring and
 * overridable by registering the same key later.
 *
 * Regression is held by `@stapel/eslint-plugin`: `stapel/no-bare-dialog`
 * fails lint on a bare antd `Modal`/`Drawer`/`Popconfirm` under
 * `src/default/**`.
 */
export { SkinDialog, useDialogSurface, MODAL_MEDIA_QUERY } from "./skin/dialog.js";
export type { SkinDialogProps, DialogSurface } from "./skin/dialog.js";
export { useThemeMode, subscribeThemeMode } from "./skin/themeMode.js";
export { SkinTheme, PHONE_CONTROL_HEIGHT } from "./skin/theme.js";
export type { SkinThemeProps, SkinSurface } from "./skin/theme.js";
export { ErrorAlert, EmptyState, LoadBoundary, LoadList } from "./skin/states.js";
export type {
  ErrorAlertProps,
  EmptyStateProps,
  LoadBoundaryProps,
  LoadListProps,
} from "./skin/states.js";
export { SkinConfirm, CONFIRM_OK_TESTID, CONFIRM_CANCEL_TESTID } from "./skin/confirm.js";
export type { SkinConfirmProps } from "./skin/confirm.js";
export { GatedControl, GatedButton } from "./skin/gated.js";
export type { GatedControlProps, GatedControlBinding, GatedButtonProps } from "./skin/gated.js";
