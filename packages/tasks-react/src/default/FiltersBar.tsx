/**
 * The board's filter bar.
 *
 * ── The assignee filter is built from the BOARD, not from a directory ──────
 *
 * stapel-tasks resolves no user ids and offers no member search, so a free-text
 * "assignee id" box would be a control only somebody holding a UUID could use.
 * The options here are the ids actually present on the board, labelled through
 * the host's `userLabel` seam (initials of the id when no host filled it) —
 * every option is therefore guaranteed to match something.
 *
 * `column`, `category` and `assignee` travel to the server; `text` does not
 * (there is no card search upstream), which is why it is labelled "find in
 * titles" rather than "search".
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, Input, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { BoardFilters } from "../headless/useBoard.js";
import { TASKS_I18N_KEYS } from "../i18n/keys.js";
import type { BoardMap } from "../model/board.js";
import { idInitials } from "../model/format.js";
import { CATEGORY_ORDER, categoryLabel } from "./labels.js";

export interface FiltersBarProps {
  readonly filters: BoardFilters;
  readonly onChange: (next: BoardFilters) => void;
  readonly onClear: () => void;
  /** Cards on screen — the source of the assignee options. */
  readonly cards: BoardMap | null;
  readonly userLabel: ((userId: string) => ReactNode) | null;
}

export function FiltersBar(props: FiltersBarProps): ReactElement {
  const t = useT();
  const { cards } = props;

  const assigneeOptions = useMemo(() => {
    const ids = new Set<string>();
    if (cards !== null) {
      for (const group of cards.values()) {
        for (const card of group) {
          for (const id of card.assignee_ids ?? []) ids.add(id);
        }
      }
    }
    return [...ids].sort();
  }, [cards]);

  const active =
    props.filters.category !== undefined ||
    props.filters.assigneeId !== undefined ||
    (props.filters.text ?? "") !== "";

  return (
    <Flex
      gap={spacing[2]}
      wrap
      align="center"
      role="group"
      aria-label={t(TASKS_I18N_KEYS.filtersTitle)}
      data-testid="tasks-board-filters"
    >
      <Select
        allowClear
        value={props.filters.category}
        placeholder={t(TASKS_I18N_KEYS.filtersCategory)}
        aria-label={t(TASKS_I18N_KEYS.filtersCategory)}
        onChange={(value: string | undefined) => {
          const { category: _dropped, ...rest } = props.filters;
          props.onChange(value === undefined ? rest : { ...rest, category: value });
        }}
        options={CATEGORY_ORDER.map((value) => ({
          value,
          label: categoryLabel(t, value),
        }))}
        style={{ minWidth: "10ch" }}
        data-testid="tasks-filter-category"
      />

      <Select
        allowClear
        value={props.filters.assigneeId}
        placeholder={t(TASKS_I18N_KEYS.filtersAssignee)}
        aria-label={t(TASKS_I18N_KEYS.filtersAssignee)}
        onChange={(value: string | undefined) => {
          const { assigneeId: _dropped, ...rest } = props.filters;
          props.onChange(
            value === undefined ? rest : { ...rest, assigneeId: value }
          );
        }}
        options={assigneeOptions.map((id) => ({
          value: id,
          label:
            props.userLabel === null ? idInitials(id) : props.userLabel(id),
        }))}
        style={{ minWidth: "10ch" }}
        data-testid="tasks-filter-assignee"
      />

      <Input
        allowClear
        value={props.filters.text ?? ""}
        placeholder={t(TASKS_I18N_KEYS.filtersText)}
        aria-label={t(TASKS_I18N_KEYS.filtersText)}
        onChange={(event) => {
          props.onChange({ ...props.filters, text: event.target.value });
        }}
        style={{ flex: "1 1 14ch", maxWidth: "24ch" }}
        data-testid="tasks-filter-text"
      />

      {active ? (
        <Button
          size="small"
          onClick={props.onClear}
          data-analytics="none"
          data-analytics-reason="filtering is a view state, not a decision this module reports"
        >
          {t(TASKS_I18N_KEYS.filtersClear)}
        </Button>
      ) : (
        <Typography.Text type="secondary">
          {t(TASKS_I18N_KEYS.filtersAny)}
        </Typography.Text>
      )}
    </Flex>
  );
}
