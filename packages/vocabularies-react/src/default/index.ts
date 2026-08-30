/**
 * `@stapel/vocabularies-react/default` — the pair's default AntD skin (§54: a pair ships a
 * FEATURE, not only a bag). A separate entry point, so a host that brings its
 * own visuals never pulls `antd` or the token bridge into its bundle;
 * importing this subpath is the opt-in.
 *
 * ```tsx
 * import { VocabularyTermSelect } from "@stapel/vocabularies-react/default";
 * // under core's <I18nProvider>; the client is a prop, not a context read:
 * <VocabularyTermSelect client={client} vocabulary="avito-phones" level="Vendor" … />
 * ```
 */
export { VocabularyTermSelect } from "./VocabularyTermSelect.js";
export type { VocabularyTermSelectProps } from "./VocabularyTermSelect.js";
export type { ThemeModeProp } from "./types.js";
