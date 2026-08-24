/**
 * `@stapel/billing-react/default` — the antd skin over the headless pair.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own billing screen never pulls `antd` into its bundle.
 * The main entry has no visual opinion at all and no import path from it
 * reaches this directory — size-limit and the bundle-purity test are the teeth
 * on that.
 *
 * ```tsx
 * import { createBillingRuntime, BillingProvider } from "@stapel/billing-react";
 * import { WalletPanel } from "@stapel/billing-react/default";
 * ```
 *
 * `<WalletPanel>` is the whole billing page (the two credit pools, any debt,
 * the subscription, both ways to buy, auto-recharge and the ledger). The four
 * parts it composes are exported beside it for a host that wants only one of
 * them on a page it lays out itself.
 *
 * ── What used to be here and is not any more ──────────────────────────────
 *
 * `BillingSkinTheme` and this pair's own `ErrorAlert` are gone. Nine pairs
 * shipped a byte-identical copy of each, which meant every fix to them had to
 * land nine times and landed in eight. Both now come from
 * `@stapel/tokens-antd/skin` (`SkinTheme`, `ErrorAlert`) — one reviewed copy,
 * reactive to the document's live `data-theme`, for the whole fleet. A host
 * that wrapped its own composition in `BillingSkinTheme` imports `SkinTheme`
 * from the skin subpath instead; every shipped surface here already wraps
 * itself, and nested antd `ConfigProvider`s merge.
 */
export { WalletPanel } from "./WalletPanel.js";
export type { WalletPanelProps } from "./WalletPanel.js";
export { BuyOptions } from "./BuyOptions.js";
export type { BuyOptionsProps } from "./BuyOptions.js";
export { SubscriptionCard } from "./SubscriptionCard.js";
export type { SubscriptionCardProps } from "./SubscriptionCard.js";
export { WalletSettings } from "./WalletSettings.js";
export type { WalletSettingsProps } from "./WalletSettings.js";
export { TransactionHistory } from "./TransactionHistory.js";
export type { TransactionHistoryProps } from "./TransactionHistory.js";
export type { ThemeModeProp } from "./types.js";
