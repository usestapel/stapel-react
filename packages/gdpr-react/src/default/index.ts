/**
 * `@stapel/gdpr-react/default` — the antd skin over the headless pair, for the
 * screens a PERSON sees.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own privacy screen never pulls `antd` into its bundle.
 * The main entry has no visual opinion at all and no import path from it
 * reaches this directory — size-limit and the bundle-purity test are the teeth
 * on that.
 *
 * The STAFF screens live one subpath further out (`@stapel/gdpr-react/default/
 * admin`) for the same reason one layer up: a DSAR queue and an
 * operations-liveness table have no business riding in the bundle of a page
 * whose visitor is deleting their own account.
 *
 * ```tsx
 * import { createGdprRuntime, GdprProvider } from "@stapel/gdpr-react";
 * import { PrivacyPane } from "@stapel/gdpr-react/default";
 * ```
 *
 * `<PrivacyPane>` is the wired screen (the nav manifest's `account.privacy`
 * points at it); the four panels are exported individually for a host that
 * places them in its own settings layout.
 */
export { AccountClosurePanel } from "./AccountClosurePanel.js";
export type { AccountClosurePanelProps } from "./AccountClosurePanel.js";
export { PendingDeletions } from "./PendingDeletions.js";
export type { PendingDeletionsProps } from "./PendingDeletions.js";
export { DataExportPanel } from "./DataExportPanel.js";
export type { DataExportPanelProps } from "./DataExportPanel.js";
export { DsarForm } from "./DsarForm.js";
export type { DsarFormProps } from "./DsarForm.js";
export { PrivacyPane } from "./PrivacyPane.js";
export type { PrivacyPaneProps } from "./PrivacyPane.js";
export { GdprSkinTheme } from "./theme.js";
export type { GdprSkinThemeProps } from "./theme.js";
export { ErrorAlert } from "./ErrorAlert.js";
export type { ThemeModeProp } from "./types.js";
