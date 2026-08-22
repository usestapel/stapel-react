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
  /** The sort the SERVER applied, shown when the URL names none. */
  readonly appliedSort?: string | undefined;
}

export function SortSelect(props: SortSelectProps): ReactElement {
  const t = useT();
  const { state, setSort } = useSearchState();

  const hasCentre = state.geo !== undefined;
  const known = new Set(SEARCH_SORTS);
  const values =
    state.sort !== undefined && !known.has(state.sort)
      ? [...SEARCH_SORTS, state.sort]
      : SEARCH_SORTS;

  return (
    <Flex gap={8} align="center">
      <Typography.Text type="secondary">
        {t(SEARCH_I18N_KEYS.sortLabel)}
      </Typography.Text>
      <Select<string>
        data-testid="search-sort"
        style={{ minWidth: 180 }}
        value={state.sort ?? props.appliedSort ?? null}
        placeholder={t(SEARCH_I18N_KEYS.sortLabel)}
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
