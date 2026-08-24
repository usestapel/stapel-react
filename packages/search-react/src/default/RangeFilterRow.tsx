/**
 * One numeric range row — "Price: from ___ to ___".
 *
 * The pair could encode `r.price=100..500`, round-trip it through the URL and
 * send it, and had no control that produced one. A marketplace without a price
 * range filter is not a marketplace (audit S-2), and this is the row that fixes
 * it; `state/ranges.ts` decides which rows exist.
 *
 * ── Why it is applied by a button and not by typing ───────────────────────
 *
 * A facet checkbox commits on click because a click is a finished thought. A
 * range is TWO fields, and committing each keystroke would run a search for
 * `1`, `10`, `100` on the way to `1000` — three wrong result pages, three
 * history entries' worth of churn, and a facet panel that reshuffles under the
 * hand still typing. So the row holds a draft and commits on Apply (or Enter),
 * which is also what makes "from > to" refusable instead of merely empty.
 */
import { useRef, useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, InputNumber, Typography } from "antd";
import { actionAvailable, actionBlocked, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { GatedButton } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { SearchRange } from "../api/types.js";
import type { RangeGroup } from "../state/ranges.js";
import { isRangeUsable } from "../state/ranges.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** Floor width of one bound field, so two of them fit a 390px phone row. */
export const RANGE_FIELD_MIN_WIDTH = 96;

export interface RangeFilterRowProps {
  readonly group: RangeGroup;
  /** `null` clears the slug's range entirely. */
  readonly onApply: (slug: string, range: SearchRange | null) => void;
}

function toDraft(value: string | undefined): string {
  return value ?? "";
}

export function RangeFilterRow(props: RangeFilterRowProps): ReactElement {
  const t = useT();
  const { group } = props;
  const [from, setFrom] = useState(toDraft(group.from));
  const [to, setTo] = useState(toDraft(group.to));
  // The URL is still the state: when it moves on its own — Back, a shared
  // link, "clear all" — the draft follows it rather than keeping a number the
  // results are no longer about.
  const applied = useRef<string>(`${toDraft(group.from)}..${toDraft(group.to)}`);
  const current = `${toDraft(group.from)}..${toDraft(group.to)}`;
  if (applied.current !== current) {
    applied.current = current;
    if (from !== toDraft(group.from)) setFrom(toDraft(group.from));
    if (to !== toDraft(group.to)) setTo(toDraft(group.to));
  }

  const draft: SearchRange = {
    ...(from !== "" ? { from } : {}),
    ...(to !== "" ? { to } : {}),
  };
  const usable = isRangeUsable(draft);
  const empty = from === "" && to === "";
  const apply: ActionAvailability = usable
    ? actionAvailable()
    : actionBlocked(SEARCH_I18N_KEYS.facetsRangeInvalid);

  const commit = (): void => {
    if (!usable) return;
    props.onApply(group.slug, empty ? null : draft);
  };

  const unit = group.unit === undefined ? "" : ` ${group.unit}`;

  return (
    <Flex
      vertical
      gap={spacing[1]}
      data-testid={`facet-range-${group.slug}`}
      data-active={group.active ? "true" : "false"}
    >
      <Typography.Text strong>{group.label}</Typography.Text>
      <Flex gap={spacing[2]} align="center" wrap>
        <InputNumber
          value={from === "" ? null : Number(from)}
          placeholder={t(SEARCH_I18N_KEYS.facetsRangeFrom)}
          aria-label={`${t(SEARCH_I18N_KEYS.facetsRangeFromAria, {
            feature: group.label,
          })}${unit}`}
          data-testid={`facet-range-${group.slug}-from`}
          style={{ minWidth: RANGE_FIELD_MIN_WIDTH }}
          {...(group.min !== undefined ? { min: group.min } : {})}
          {...(group.max !== undefined ? { max: group.max } : {})}
          {...(group.step !== undefined ? { step: group.step } : {})}
          onChange={(value) => {
            setFrom(value === null || value === undefined ? "" : String(value));
          }}
          onPressEnter={commit}
        />
        <InputNumber
          value={to === "" ? null : Number(to)}
          placeholder={t(SEARCH_I18N_KEYS.facetsRangeTo)}
          aria-label={`${t(SEARCH_I18N_KEYS.facetsRangeToAria, {
            feature: group.label,
          })}${unit}`}
          data-testid={`facet-range-${group.slug}-to`}
          style={{ minWidth: RANGE_FIELD_MIN_WIDTH }}
          {...(group.min !== undefined ? { min: group.min } : {})}
          {...(group.max !== undefined ? { max: group.max } : {})}
          {...(group.step !== undefined ? { step: group.step } : {})}
          onChange={(value) => {
            setTo(value === null || value === undefined ? "" : String(value));
          }}
          onPressEnter={commit}
        />
        <GatedButton
          gate={apply}
          size="small"
          type={group.active ? "default" : "primary"}
          testId={`facet-range-${group.slug}-apply`}
          data-analytics="none"
          data-analytics-reason="a filter is a read, not a flow step"
          onClick={commit}
        >
          {t(SEARCH_I18N_KEYS.facetsRangeApply)}
        </GatedButton>
        {group.active && (
          <Button
            size="small"
            data-testid={`facet-range-${group.slug}-clear`}
            data-analytics="none"
            data-analytics-reason="a filter is a read, not a flow step"
            onClick={() => {
              props.onApply(group.slug, null);
            }}
          >
            {t(SEARCH_I18N_KEYS.facetsRangeClear)}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
