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
 * DISABLED with the reason named when no geo centre is set, rather than
 * offered and then refused.
 */
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import { SEARCH_SORTS } from "../api/types.js";
import { useAppliedSort } from "../headless/useAppliedSort.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

const SORT_LABEL_KEY: Readonly<Record<string, string>> = {
  relevance: SEARCH_I18N_KEYS.sortRelevance,
  newest: SEARCH_I18N_KEYS.sortNewest,
  price_asc: SEARCH_I18N_KEYS.sortPriceAsc,
  price_desc: SEARCH_I18N_KEYS.sortPriceDesc,
  distance: SEARCH_I18N_KEYS.sortDistance,
};

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

  return (
    <Flex gap={8} align="center">
      <Typography.Text type="secondary">
        {t(SEARCH_I18N_KEYS.sortLabel)}
      </Typography.Text>
      <Select<string>
        data-testid="search-sort"
        style={{ minWidth: 180 }}
        value={active ?? null}
        onChange={(next) => {
          setSort(next);
        }}
        options={values.map((value) => {
          const key = SORT_LABEL_KEY[value];
          const needsCentre = value === "distance" && !hasCentre;
          return {
            value,
            label: key !== undefined ? t(key) : value,
            disabled: needsCentre,
            // A disabled control states its reason (the ActionAvailability
            // canon), even inside a select.
            ...(needsCentre
              ? { title: t("error.400.search_sort_needs_center") }
              : {}),
          };
        })}
      />
    </Flex>
  );
}
