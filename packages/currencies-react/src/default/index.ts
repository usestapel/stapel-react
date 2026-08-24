/**
 * `@stapel/currencies-react/default` — the pair's default AntD skin (§54: a
 * pair ships a FEATURE, not only a bag). A separate entry point, so a host
 * that brings its own visuals never pulls `antd` or the token bridge into its
 * bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { Price, CurrencyPicker } from "@stapel/currencies-react/default";
 * ```
 */
export { Price } from "./Price.js";
export type { PriceProps } from "./Price.js";
export { CurrencyPicker } from "./CurrencyPicker.js";
export type { CurrencyPickerProps } from "./CurrencyPicker.js";
export { CurrencyField } from "./CurrencyField.js";
export type { CurrencyFieldProps, MoneyValue } from "./CurrencyField.js";
export { RateTable } from "./RateTable.js";
export type { RateTableProps } from "./RateTable.js";
export type { ThemeModeProp } from "./types.js";
