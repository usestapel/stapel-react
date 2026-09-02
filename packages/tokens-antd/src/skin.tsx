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
 *  - {@link SkinProvider} + {@link SkinButton} / {@link SkinInput} — the
 *    component REGISTRY, the substrate's second restyle layer (tokens
 *    re-colour; the registry swaps ANATOMY). A host registers a replacement
 *    Button / Input / Dialog surface ONCE and every substrate render below —
 *    `GatedButton`, `ErrorAlert`'s retry, `SkinConfirm`'s arms, `SkinDialog`
 *    and everything composed on it — draws the host's primitive instead of
 *    antd's. No provider = today's exact markup. Contracts and duties:
 *    `docs/skin-component-registry.md`.
 *  - {@link SkinTheme} + {@link useThemeMode} + {@link useHostBrand} — a skin
 *    self-themes from the document's LIVE `data-theme` AND `data-brand` — the
 *    two attributes `tokens.css` keys on — never a hardcoded side or a brand
 *    frozen at first paint, and paints its own surface; phone controls are
 *    44px.
 *  - {@link SkinDialog} + {@link useDialogSurface} — on a phone a dialog is a
 *    bottom sheet; modals are tablet/desktop only. It also themes its own
 *    portal, so a dialog is on the right side wherever it was declared.
 *  - {@link SkinConfirm} — a confirmation is a dialog (so: a sheet on a
 *    phone), never an anchored popover.
 *  - {@link SkinCarousel} — a swipeable strip is NATIVE scroll-snap with a
 *    peek, never a JS gesture layer: the edge of the next slide is the
 *    affordance that there is more, and the platform owns the fling.
 *  - {@link PermissionSheet} / {@link PermissionGate} — a browser capability
 *    is explained BEFORE the browser's one-shot prompt fires, and a refusal
 *    is permanent: the same surface then says where the switch is and offers
 *    the way that does not need the capability. The state is core's headless
 *    `usePermission`; this adds no logic to it.
 *  - {@link ErrorAlert}, {@link EmptyState}, {@link LoadBoundary},
 *    {@link LoadList} — the loading / failed / empty arms are designed once;
 *    "empty" is reachable only from a load that succeeded.
 *  - {@link GatedControl} / {@link GatedButton} — a switched-off control
 *    states its reason as visible text beside it, never in a tooltip.
 *  - {@link PaneGate} — a pane-level refusal is rendered once for the pane,
 *    and per-control reasons inside an available pane are pooled, one copy
 *    per distinct sentence.
 *  - {@link Pane} / {@link Page} — the measure (`narrow`/`reading`/`wide`)
 *    and the padding scale, instead of a hand-set `maxWidth` per file.
 *  - {@link StatusTag} — one treatment per status family
 *    (success/warning/error/info/neutral), from the theme's status roles.
 *  - {@link RowActions} — a row's actions wrap between buttons, never inside
 *    a word; on a phone the overflow is a sheet.
 *  - {@link ListRow} / {@link CardHeader} — text columns are `min-width: 0`
 *    and wrap; actions and badges have slots of their own.
 *  - {@link DataTable} — a table where the box is wide, cards where it is
 *    not, by element width.
 *  - {@link useElementWidth} — the one element-width measurement: geometry
 *    comes from the box a thing is in, never from the viewport.
 *  - {@link ChoiceChips} — a handful of options is picked INLINE, as 44px
 *    chips that wrap and never truncate a label; a chip that cannot be
 *    chosen states its reason as text, once per distinct sentence.
 *  - {@link SkinPickerSheet} — a LONG list is picked in a bottom sheet with a
 *    search box, never a dropdown. It composes `SkinDialog`, holds a draft in
 *    multi-select (the footer button carries the count it is about to
 *    commit), and marks a list that no longer answers the search box as stale
 *    instead of letting somebody pick the previous query's row.
 *  - {@link SkinNumberField} — a number raises the numeric keypad, wears its
 *    unit as a suffix that is never part of the value, and states `min`/`max`
 *    as a hint. It is NOT antd's `InputNumber`, which clamps silently.
 *  - {@link CountedInput} — a length limit is a live counter in the unit the
 *    backend validates in (code points), never a `maxlength` that stops
 *    somebody two emoji short with no explanation.
 *
 * Copy the substrate needs for itself (retry, dismiss, confirm, cancel, the
 * empty-state default, the four permission pre-prompts) comes from
 * `@stapel/core`'s UI floor (`STAPEL_UI_KEYS`, `PERMISSION_COPY_KEYS`,
 * en/ru/es), so it is translated with zero host wiring and overridable by
 * registering the same key later.
 *
 * Regression is held by `@stapel/eslint-plugin`: `stapel/no-bare-dialog`
 * fails lint on a bare antd `Modal`/`Drawer`/`Popconfirm` under
 * `src/default/**`.
 */
export { SkinProvider, useSkinComponents, SkinButton, SkinInput } from "./skin/components.js";
export type {
  SkinComponents,
  SkinProviderProps,
  SkinButtonProps,
  SkinButtonComponent,
  SkinInputProps,
  SkinInputComponent,
  SkinDialogSlotProps,
  SkinDialogComponent,
} from "./skin/components.js";
export {
  SkinDialog,
  SHEET_MAX_HEIGHT,
  SHEET_WRAPPER_CLASS,
  SHEET_STYLE_HREF,
  sheetSizingCss,
} from "./skin/dialog.js";
export type { SkinDialogProps } from "./skin/dialog.js";
export { useDialogSurface, MODAL_MEDIA_QUERY } from "./skin/dialogSurface.js";
export type { DialogSurface } from "./skin/dialogSurface.js";
export {
  useThemeMode,
  subscribeThemeMode,
  useHostBrand,
  subscribeHostBrand,
} from "./skin/themeMode.js";
export {
  SkinTheme,
  PHONE_CONTROL_HEIGHT,
  PHONE_TOUCH_FLOOR,
  PHONE_TOUCH_FLOOR_STYLE_HREF,
  phoneTouchFloorCss,
} from "./skin/theme.js";
export type { SkinThemeProps, SkinSurface } from "./skin/theme.js";
export {
  SkinCarousel,
  SKIN_CAROUSEL_CLASS,
  SKIN_CAROUSEL_STRIP_CLASS,
  SKIN_CAROUSEL_SLIDE_CLASS,
  SKIN_CAROUSEL_DOTS_CLASS,
  SKIN_CAROUSEL_DOT_CLASS,
  SKIN_CAROUSEL_STYLE_HREF,
  SKIN_CAROUSEL_PEEK,
  skinCarouselCss,
} from "./skin/carousel.js";
export type { SkinCarouselProps } from "./skin/carousel.js";
export { visuallyHidden } from "./skin/visuallyHidden.js";
export { useElementWidth } from "./skin/elementWidth.js";
export type { ElementWidthOptions, ElementWidthReading } from "./skin/elementWidth.js";
export { ErrorAlert, EmptyState, LoadBoundary, LoadList, ACTION_STACK_BELOW } from "./skin/states.js";
export type {
  ErrorAlertProps,
  EmptyStateProps,
  LoadBoundaryProps,
  LoadListProps,
} from "./skin/states.js";
export { SkinConfirm, CONFIRM_OK_TESTID, CONFIRM_CANCEL_TESTID } from "./skin/confirm.js";
export type { SkinConfirmProps } from "./skin/confirm.js";
export {
  PermissionSheet,
  PermissionGate,
  permissionIsBlocked,
  PERMISSION_ALLOW_TESTID,
  PERMISSION_DISMISS_TESTID,
} from "./skin/permission.js";
export type {
  PermissionSheetProps,
  PermissionGateProps,
  PermissionCopy,
} from "./skin/permission.js";
export { GatedControl, GatedButton, GateReasonScopeContext } from "./skin/gated.js";
export type {
  GatedControlProps,
  GatedControlBinding,
  GatedButtonProps,
  GateReasonScope,
} from "./skin/gated.js";
export { PaneGate } from "./skin/paneGate.js";
export type { PaneGateProps } from "./skin/paneGate.js";
export { Pane, Page, PANE_MEASURES } from "./skin/pane.js";
export type { PaneProps, PageProps, PaneMeasure, PanePadding } from "./skin/pane.js";
export { StatusTag } from "./skin/status.js";
export type { StatusTagProps, StatusFamily } from "./skin/status.js";
export { RowActions } from "./skin/rowActions.js";
export type { RowActionsProps, RowAction } from "./skin/rowActions.js";
export { ListRow, CardHeader } from "./skin/listRow.js";
export type { ListRowProps, CardHeaderProps } from "./skin/listRow.js";
export { DataTable } from "./skin/dataTable.js";
export type { DataTableProps, DataTableColumn, DataTableCardRole } from "./skin/dataTable.js";
export { ChoiceChips } from "./skin/choiceChips.js";
export type {
  ChoiceChipsProps,
  ChoiceChipsSingleProps,
  ChoiceChipsMultiProps,
  ChoiceChipOption,
} from "./skin/choiceChips.js";
export {
  SkinPickerSheet,
  DEFAULT_MAX_ROWS,
  PICKER_SEARCH_TESTID,
  PICKER_DONE_TESTID,
} from "./skin/pickerSheet.js";
export type {
  SkinPickerSheetProps,
  PickerSheetSingleProps,
  PickerSheetMultiProps,
  PickerOption,
  PickerGroup,
} from "./skin/pickerSheet.js";
export { SkinNumberField, parseNumericText } from "./skin/numberField.js";
export type { SkinNumberFieldProps } from "./skin/numberField.js";
export { CountedInput, codePointLength, COUNTER_TESTID } from "./skin/countedInput.js";
export type { CountedInputProps } from "./skin/countedInput.js";
