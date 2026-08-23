/**
 * `@stapel/billing-react/default` — the antd skin over the headless pair.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own wallet screen never pulls `antd` into its bundle. The
 * main entry has no visual opinion at all and no import path from it reaches
 * this directory — size-limit and the bundle-purity test are the teeth on
 * that.
 *
 * ```tsx
 * import { createBillingRuntime, BillingProvider } from "@stapel/billing-react";
 * import { WalletPanel } from "@stapel/billing-react/default";
 * ```
 *
 * `<WalletPanel>` is the wired screen (balance, the nearest credit deadline,
 * and both ways to buy); `<BuyOptions>` is the shop alone with the catalogue
 * handed in, for a host that owns its own pricing page.
 */
export { WalletPanel } from "./WalletPanel.js";
export type { WalletPanelProps } from "./WalletPanel.js";
export { BuyOptions } from "./BuyOptions.js";
export type { BuyOptionsProps } from "./BuyOptions.js";
export { BillingSkinTheme } from "./theme.js";
export type { BillingSkinThemeProps } from "./theme.js";
export { ErrorAlert } from "./ErrorAlert.js";
export type { ThemeModeProp } from "./types.js";
