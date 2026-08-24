/**
 * The backend's own limits, in one place — and the two timings the client
 * chooses so that it never provokes them.
 *
 * Every number here is a fact about stapel-search's `conf.py` (or, for the
 * debounces, a decision taken because of one). They live in the state layer,
 * beside the codec, because they are properties of the CONTRACT rather than of
 * any component: a control that caps its input at `SEARCH_QUERY_MAX_CHARS`
 * cannot produce `error.400.search_query_too_long`, and a typeahead that waits
 * for `SEARCH_BOX_SUGGEST_DEBOUNCE_MS` does not earn a 429 from a throttled
 * endpoint for typing quickly.
 *
 * They are DEFAULTS, not assertions: a deployment may raise `MAX_PAGE_SIZE` or
 * lower `MAX_QUERY_CHARS`, and nothing here is sent to the server as a claim.
 * The server remains the one entitled to refuse.
 */

/** `MAX_QUERY_CHARS` — the longest `q` (and suggest prefix) the server reads. */
export const SEARCH_QUERY_MAX_CHARS = 200;

/** `DEFAULT_PAGE_SIZE` — what a request with no `limit` gets. */
export const SEARCH_DEFAULT_PAGE_SIZE = 24;

/** `MAX_PAGE_SIZE` — the server clamps anything above this. */
export const SEARCH_MAX_PAGE_SIZE = 100;

/** `services.suggest` clamps `limit` into `1..25`. */
export const SUGGEST_MAX_LIMIT = 25;

/**
 * The shortest prefix worth asking the index about.
 *
 * One and two letters match nearly everything, so the answer is noise and the
 * request is a keystroke tax on a throttled endpoint (`SuggestThrottle`,
 * scope `search-suggest`). Three is where a prefix starts to mean something.
 */
export const SUGGEST_MIN_CHARS = 3;

/** How long the typing has to stop before the SEARCH runs. */
export const SEARCH_BOX_DEBOUNCE_MS = 350;

/**
 * How long it has to stop before the INDEX is asked for prefixes.
 *
 * Shorter than the commit: a suggestion is only worth having while you are
 * still typing, and it costs a cheap read of one column. Longer than zero: the
 * endpoint is throttled per client, and a request per keystroke is how a person
 * gets 429s for typing quickly.
 */
export const SEARCH_BOX_SUGGEST_DEBOUNCE_MS = 150;
