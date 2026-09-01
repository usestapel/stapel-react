/**
 * `@stapel/vocabularies-react/default` — the pair's default AntD skin (§54: a pair ships a
 * FEATURE, not only a bag). A separate entry point, so a host that brings its
 * own visuals never pulls `antd` or the token bridge into its bundle;
 * importing this subpath is the opt-in.
 *
 * ```tsx
 * import { VocabularyTermSelect } from "@stapel/vocabularies-react/default";
 * // under core's <I18nProvider>; the client is a prop, not a context read:
 * <VocabularyTermSelect client={client} vocabulary="phone-models" level="Vendor" … />
 * ```
 *
 * TWO controls over one level, and the choice between them is the SURFACE, not
 * the data (both hold the same value shape — a list of codes — and read the
 * same seam):
 *
 *  - {@link VocabularyTermSelect} — the inline typeahead. What a filter rail,
 *    an admin row or a bulk-edit cell embeds where a dropdown is what fits.
 *  - {@link VocabularyTermPicker} — the field. A trigger saying what is chosen,
 *    a bottom sheet with the search box, recents on top and a counted commit:
 *    the fleet's rule for a long list on a phone.
 */
export { VocabularyTermSelect } from "./VocabularyTermSelect.js";
export type { VocabularyTermSelectProps } from "./VocabularyTermSelect.js";
export {
  VocabularyTermPicker,
  termRecentsScope,
  TERM_RECENTS_MAX,
} from "./VocabularyTermPicker.js";
export type { VocabularyTermPickerProps } from "./VocabularyTermPicker.js";
export type { ThemeModeProp } from "./types.js";
