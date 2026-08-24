/**
 * How many results a page carries — `limit`, the fifth of the nine state
 * setters that had no control.
 *
 * The offered sizes are the pair's, not the schema's: `docs/schema.json`
 * declares `limit` as a bare integer, and the backend clamps it to
 * `1..MAX_PAGE_SIZE` (100) with `DEFAULT_PAGE_SIZE` 24 when it is absent. So
 * the select offers a short ladder around that default and never sends
 * something the server would have to clamp — a person who lands on a link
 * carrying `limit=37` keeps it (it is offered as its own option) rather than
 * being silently moved to 24, which would change what a shared link shows.
 *
 * A page size is a PREFERENCE, not a step through the results: `setLimit`
 * replaces the history entry rather than pushing one, so Back still undoes the
 * last filter and not the last time somebody widened the page.
 */
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** The shipped ladder, around stapel-search's own `DEFAULT_PAGE_SIZE` (24). */
export const SEARCH_PAGE_SIZES: readonly number[] = [12, 24, 48, 96];

/** Width of the size select — the widest option plus its caption. */
export const PAGE_SIZE_SELECT_MIN_WIDTH = 148;

export interface PageSizeSelectProps {
  /** Override the offered ladder (a deployment with its own `MAX_PAGE_SIZE`). */
  readonly sizes?: readonly number[];
  /** What the server uses when the URL names none. Default 24. */
  readonly defaultSize?: number;
}

export function PageSizeSelect(props: PageSizeSelectProps): ReactElement {
  const t = useT();
  const { state, setLimit } = useSearchState();
  const ladder = props.sizes ?? SEARCH_PAGE_SIZES;
  const active = state.limit ?? props.defaultSize ?? 24;
  const values = ladder.includes(active) ? ladder : [...ladder, active].sort((a, b) => a - b);

  return (
    <Flex gap={spacing[2]} align="center">
      <Typography.Text type="secondary" aria-hidden="true">
        {t(SEARCH_I18N_KEYS.limitLabel)}
      </Typography.Text>
      <Select<number>
        data-testid="search-limit"
        aria-label={t(SEARCH_I18N_KEYS.limitLabel)}
        style={{ minWidth: PAGE_SIZE_SELECT_MIN_WIDTH }}
        value={active}
        onChange={(next) => {
          setLimit(next);
        }}
        options={values.map((size) => ({
          value: size,
          label: t(SEARCH_I18N_KEYS.limitOption, { count: size }),
        }))}
      />
    </Flex>
  );
}
