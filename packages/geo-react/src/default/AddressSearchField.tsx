/**
 * `<AddressSearchField/>` — search-as-you-type over `usePlaceSearch`, with the
 * states that are usually collapsed into one red box kept apart.
 *
 * Six things can be true under this field, and five of them are not failures:
 *
 *  - **idle** — fewer characters typed than `search_min_chars`. NOTHING has
 *    been asked yet, so an empty state here would be telling a person their
 *    two letters matched nothing. It says "keep typing".
 *  - **loading** — a request is in flight.
 *  - **results** — the list, each row the SERVER's `formatted` line.
 *  - **no results** — a SUCCESSFUL call that matched nothing. An empty state,
 *    never an error (contract §6: zero features is an answer).
 *  - **unauthorized** — 401/403. This deployment's four geocoding verbs
 *    default to authenticated-only, so for a signed-out visitor this is the
 *    system working as configured. It is stated in plain secondary text,
 *    saying the map still works and the pin can be placed by hand — not in red,
 *    and never as "something went wrong".
 *  - **throttled** — 429. The last good suggestions STAY on screen and a line
 *    says why nothing new is arriving. A rate limit is the server asking for
 *    quiet, not a fault to report. `usePlaceSearch` gets half of this right
 *    (it refuses to turn a 429 into a failure) but leaves the bag in
 *    `loading`, so the LIST is held here — see `held` below.
 *
 * Only `unavailable` (502, retryable) and `failed` render as an actual error,
 * with a retry.
 *
 * Every reason is visible TEXT beside the field. Never a `Tooltip`, never a
 * `title` attribute: a hover has no phone equivalent and a `title` is invisible
 * to touch and to most screen readers, which is how "blocked, reason unknown"
 * shipped six times on one pane (`stapel/no-tooltip-in-skin`).
 */
import { useId, useRef } from "react";
import type { ReactElement } from "react";
import { Input, Spin, Typography, theme as antdTheme } from "antd";
import { matchList, matchLoad, useT } from "@stapel/core";
import { EmptyState, ErrorAlert } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { GEO_I18N_KEYS } from "../i18n/keys.js";
import type { GeocoderAvailability } from "../model/availability.js";
import type { PlaceSearchBag, PlaceSuggestion } from "../headless/usePlaceSearch.js";

/** The sentence for each way the geocoder can be unavailable — four
 * situations, four keys, three different next actions. */
export const AVAILABILITY_KEYS: Readonly<Record<GeocoderAvailability, string>> = {
  available: GEO_I18N_KEYS.geocoderFailed,
  unauthorized: GEO_I18N_KEYS.geocoderUnauthorized,
  throttled: GEO_I18N_KEYS.geocoderThrottled,
  unavailable: GEO_I18N_KEYS.geocoderUnavailable,
  failed: GEO_I18N_KEYS.geocoderFailed,
};

export interface AddressSearchFieldProps {
  /** The bag from `usePlaceSearch` — the caller owns it because the map's
   * centre is its search bias, and the bias belongs to the picker. */
  readonly search: PlaceSearchBag;
  /** A suggestion was chosen. The picker moves the map and the pin to it. */
  readonly onPick: (suggestion: PlaceSuggestion) => void;
  readonly autoFocus?: boolean;
  readonly "data-testid"?: string;
}

export function AddressSearchField(props: AddressSearchFieldProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const { search } = props;
  const inputId = useId();
  const listId = useId();

  /**
   * The last list the geocoder actually answered with.
   *
   * `usePlaceSearch` sets `loading` before each request and, on a 429,
   * deliberately does NOT overwrite it with a failure — but it does not put the
   * previous list back either, so the bag alone would leave a spinner spinning
   * for as long as the throttle lasts. Holding the last ready answer HERE is
   * what makes "the suggestions stay on screen while the server asks for quiet"
   * true in the thing a person looks at. A ref written during render, because
   * it is a cache of a value this render already has — an effect would paint
   * one frame of the wrong thing first.
   */
  const held = useRef<readonly PlaceSuggestion[]>([]);
  const answered = matchLoad<readonly PlaceSuggestion[], readonly PlaceSuggestion[] | undefined>(
    search.results,
    {
      loading: () => undefined,
      failed: () => undefined,
      ready: (rows) => rows,
    }
  );
  if (answered !== undefined) held.current = answered;

  const note = (text: string, state: string): ReactElement => (
    <Typography.Text
      type="secondary"
      data-geo-search-state={state}
      style={{ fontSize: token.fontSizeSM }}
    >
      {text}
    </Typography.Text>
  );

  const results = (suggestions: readonly PlaceSuggestion[]): ReactElement => (
    <ul
      id={listId}
      role="listbox"
      aria-label={t(GEO_I18N_KEYS.pickerSearchLabel)}
      data-geo-search-state="results"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        overflow: "hidden",
      }}
    >
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} role="option" aria-selected={false}>
          <button
            type="button"
            data-testid="geo-suggestion"
            data-analytics="none"
            data-analytics-reason="passthrough — the picker reports the chosen place"
            onClick={() => {
              props.onPick(suggestion);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "start",
              padding: `${String(spacing[2])}px ${String(spacing[3])}px`,
              border: "none",
              background: "transparent",
              color: token.colorText,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            {suggestion.label}
          </button>
        </li>
      ))}
    </ul>
  );

  /**
   * The failed arm, routed by WHY. `unauthorized` is not a fault and does not
   * get an alert; `unavailable`/`failed` do, with the retry the hook exposes.
   * `throttled` never reaches here — it is branched off before `matchList`.
   */
  const failedArm = (): ReactElement =>
    search.availability === "unauthorized"
      ? note(t(GEO_I18N_KEYS.geocoderUnauthorized), "unauthorized")
      : (
          <ErrorAlert
            variant="inline"
            message={t(AVAILABILITY_KEYS[search.availability])}
            retryLabel={t(GEO_I18N_KEYS.searchRetry)}
            onRetry={search.retry}
            testId="geo-search-error"
          />
        );

  return (
    <div
      data-geo-search=""
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}
    >
      <label htmlFor={inputId}>
        <Typography.Text strong>{t(GEO_I18N_KEYS.pickerSearchLabel)}</Typography.Text>
      </label>
      <Input
        id={inputId}
        value={search.query}
        allowClear
        autoFocus={props.autoFocus ?? false}
        role="combobox"
        aria-expanded={!search.idle}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={t(GEO_I18N_KEYS.pickerSearchPlaceholder)}
        data-testid="geo-search-input"
        onChange={(event) => {
          search.setQuery(event.target.value);
        }}
      />
      {search.idle ? (
        note(t(GEO_I18N_KEYS.searchTypeMore), "idle")
      ) : search.availability === "throttled" ? (
        // Under a rate limit the screen keeps what the geocoder last said. No
        // spinner (nothing is coming), no empty state (nothing was answered),
        // no error (a 429 is not a fault) — just the last good list and, below
        // it, the line saying why it is not moving.
        held.current.length > 0 ? (
          results(held.current)
        ) : null
      ) : (
        matchList(search.results, {
            loading: () => (
              <div data-geo-search-state="loading" role="status">
                <Spin size="small" />
              </div>
            ),
            failed: failedArm,
            // "Nothing matched" is only true when the geocoder ANSWERED — the
            // throttled branch above never reaches this arm.
            empty: () => (
              <EmptyState
                compact
                title={t(GEO_I18N_KEYS.searchNoResults)}
                testId="geo-search-empty"
              />
            ),
            ready: results,
          })
      )}
      {/* A rate limit is stated beside the suggestions it froze, not instead
          of them. Secondary text, no alert, no colour of alarm. */}
      {search.availability === "throttled" &&
        note(t(GEO_I18N_KEYS.geocoderThrottled), "throttled")}
    </div>
  );
}
