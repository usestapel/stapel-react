/**
 * A sort SLUG as the skin names it, in one place.
 *
 * `relevance`, `price_asc`, `distance` are wire values: the URL carries them,
 * the envelope reports them, and the ranking disclosure lists them per scorer.
 * The sort SELECT translated them and the disclosure did not, so the same page
 * offered "Most relevant" in the control and stamped "Applies to: relevance"
 * under every parameter — the registry's word, in a statutory text, next to
 * the human word for the same thing.
 *
 * A slug the pair does not ship is returned as it is. Deployments register
 * their own scorers and sorts, and an unknown one is a real value that belongs
 * on screen; only an invented label would be worse.
 */
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

const SORT_LABEL_KEY: Readonly<Record<string, string>> = {
  relevance: SEARCH_I18N_KEYS.sortRelevance,
  newest: SEARCH_I18N_KEYS.sortNewest,
  price_asc: SEARCH_I18N_KEYS.sortPriceAsc,
  price_desc: SEARCH_I18N_KEYS.sortPriceDesc,
  distance: SEARCH_I18N_KEYS.sortDistance,
};

/** The i18n key for a shipped sort, or `undefined` for a deployment's own. */
export function sortLabelKey(sort: string): string | undefined {
  return SORT_LABEL_KEY[sort];
}

/** The sort's name for a reader, falling back to the slug. */
export function sortLabel(t: (key: string) => string, sort: string): string {
  const key = SORT_LABEL_KEY[sort];
  return key === undefined ? sort : t(key);
}
