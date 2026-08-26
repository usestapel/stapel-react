/**
 * `@stapel/translate-react/default` — the pair's default AntD skin (§54: a pair
 * ships a FEATURE, not only a bag). A separate entry point, so a host that
 * brings its own visuals never pulls `antd` or the token bridge into its
 * bundle; importing this subpath is the opt-in.
 *
 * ```tsx
 * import { LanguageSwitcher, TranslatedText } from "@stapel/translate-react/default";
 *
 * // header chrome — AppShell's `headerExtra` slot:
 * <LanguageSwitcher compact />
 * // beside somebody else's writing:
 * <TranslatedText text={listing.description} sourceLang={listing.language} />
 * ```
 */
export { LanguageSwitcher } from "./LanguageSwitcher.js";
export type { LanguageSwitcherProps } from "./LanguageSwitcher.js";
export { LanguageSettingsPane } from "./LanguageSettingsPane.js";
export type { LanguageSettingsPaneProps } from "./LanguageSettingsPane.js";
export { TranslationStatus } from "./TranslationStatus.js";
export type { TranslationStatusProps } from "./TranslationStatus.js";
export { TranslateButton } from "./TranslateButton.js";
export type { TranslateButtonProps } from "./TranslateButton.js";
export { TranslatedText } from "./TranslatedText.js";
export type { TranslatedTextProps } from "./TranslatedText.js";
export type { ThemeModeProp } from "./types.js";
