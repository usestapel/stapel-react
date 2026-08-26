/**
 * The sort control.
 *
 * The options are the shipped `SORTS` list, NOT an enum from the schema —
 * `docs/schema.json` declares none, and a deployment may register more. So a
 * value the URL already carries that is not in the list is still offered as a
 * (raw) option rather than silently reset: resetting it would rewrite a
 * shared link's meaning on load, and the server is the one entitled to refuse
 * an unknown sort (`error.400.search_unknown_sort`, which names it).
 *
 * `sort=distance` needs a centre — the server answers
 * `error.400.search_sort_needs_center` without one. The option is therefore
 * DISABLED when no geo centre is set, and the REASON is rendered beside the
 * control through `GatedControl`, not in a `title=` a phone can never surface.
 * That is the whole defect this file used to carry: the one sort a person
 * would most want on a phone was greyed out with its explanation in a hover.
 */
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { GatedControl } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { SEARCH_SORTS } from "../api/types.js";
import { useAppliedSort } from "../headless/useAppliedSort.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { sortLabelKey } from "./sortLabels.js";

/**
 * The select's floor width. Off the spacing scale on purpose and named for it:
 * it is the width of the longest shipped sort label ("Price: low to high") at
 * the default type step, so the control does not resize as the choice changes.
 */
export const SORT_SELECT_MIN_WIDTH = 200;

export interface SortSelectProps {
  /** The sort the SERVER applied, shown when the URL names none. Omitted, it
   * is read from the page already in cache — see {@link useAppliedSort}. */
  readonly appliedSort?: string | undefined;
}

export function SortSelect(props: SortSelectProps): ReactElement {
  const t = useT();
  const { state, setSort } = useSearchState();
  // What the control SAYS must be what the results are ordered by. With no
  // `sort` in the URL the select used to fall through to its placeholder and
  // show nothing at all, while the server had already sorted the page and
  // said so in the envelope.
  const applied = useAppliedSort();

  // What the page is ACTUALLY ordered by: the URL's sort, else the one the
  // container states, else the one the server reported for the page in cache.
  const active = state.sort ?? props.appliedSort ?? applied;
  const hasCentre = state.geo !== undefined;
  const known = new Set(SEARCH_SORTS);
  const values =
    active !== undefined && !known.has(active)
      ? [...SEARCH_SORTS, active]
      : SEARCH_SORTS;

  // The gate is about ONE option, not the whole control — so the binding's
  // `aria-describedby` is spread onto the select (a screen reader hears the
  // reason with the control) and its `disabled` deliberately is not: the other
  // four sorts work perfectly well without a location.
  const distance: ActionAvailability = hasCentre
    ? actionAvailable()
    : actionBlocked("error.400.search_sort_needs_center");

  return (
    <GatedControl gate={distance} testId="search-sort-gate">
      {(bind) => (
        <Flex gap={spacing[2]} align="center">
          <Typography.Text type="secondary" aria-hidden="true">
            {t(SEARCH_I18N_KEYS.sortLabel)}
          </Typography.Text>
          <Select<string>
            data-testid="search-sort"
            aria-label={t(SEARCH_I18N_KEYS.sortLabel)}
            aria-describedby={bind["aria-describedby"]}
            style={{ minWidth: SORT_SELECT_MIN_WIDTH }}
            value={active ?? null}
            onChange={(next) => {
              setSort(next);
            }}
            options={values.map((value) => {
              const key = sortLabelKey(value);
              return {
                value,
                label: key !== undefined ? t(key) : value,
                disabled: value === "distance" && !hasCentre,
              };
            })}
          />
        </Flex>
      )}
    </GatedControl>
  );
}
