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
import { actionAvailable, actionBlocked, useFormat, useT } from "@stapel/core";
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

/**
 * The suffix a bound field carries: a currency SYMBOL for a money axis, the
 * category's own unit string otherwise.
 *
 * `group.currency` is an ISO 4217 code and `RUB` beside an input is not what
 * money looks like anywhere; `Intl` knows the symbol per locale, so the code
 * goes in and «₽» comes out. An unsupported code falls back to the code
 * itself — still better than nothing, and it never throws inside a render.
 */
function boundSuffix(
  format: ReturnType<typeof useFormat>,
  group: RangeGroup
): string | undefined {
  if (group.currency === undefined) return group.unit;
  if (!/^[A-Za-z]{3}$/.test(group.currency)) return group.currency;
  try {
    const sample = format.number(0, {
      style: "currency",
      currency: group.currency.toUpperCase(),
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    });
    if (sample === null) return group.currency;
    const symbol = sample.replace(/[\s\u00a0\u202f0-9.,]/g, "");
    return symbol.length > 0 ? symbol : group.currency;
  } catch {
    return group.currency;
  }
}

export function RangeFilterRow(props: RangeFilterRowProps): ReactElement {
  const t = useT();
  const format = useFormat();
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

  const suffix = boundSuffix(format, group);
  const unit = suffix === undefined ? "" : ` ${suffix}`;
  // Thousands grouping inside the field, because a price is read in
  // thousands: `119000` is a wall of digits and `119 000` is a number. The
  // parser is digits-only, so whatever the locale's separator turns out to
  // be, the value that leaves the control is still the one the URL carries.
  const grouping =
    group.core
      ? {
          formatter: (value: string | number | undefined): string =>
            value === undefined || value === ""
              ? ""
              : (format.number(Number(value)) ?? String(value)),
          parser: (value: string | undefined): string =>
            (value ?? "").replace(/[^\d.-]/g, ""),
        }
      : {};

  return (
    <Flex
      vertical
      gap={spacing[1]}
      data-testid={`facet-range-${group.slug}`}
      data-active={group.active ? "true" : "false"}
      data-core={group.core ? "true" : "false"}
    >
      {/* The unit lives in the HEADING, not in the fields. It used to live
          only in an aria-label, so a sighted reader of a money row saw two
          bare integers and had to infer the currency from the results. antd
          deprecated `addonAfter` on InputNumber in favour of `Space.Compact`,
          and two addons plus an Apply button do not survive a 390px row —
          "Price, RUB" states it once and costs no width. */}
      <Typography.Text strong data-testid={`facet-range-${group.slug}-label`}>
        {suffix === undefined ? group.label : `${group.label}, ${suffix}`}
      </Typography.Text>
      <Flex gap={spacing[2]} align="center" wrap>
        <InputNumber
          value={from === "" ? null : Number(from)}
          placeholder={t(SEARCH_I18N_KEYS.facetsRangeFrom)}
          aria-label={`${t(SEARCH_I18N_KEYS.facetsRangeFromAria, {
            feature: group.label,
          })}${unit}`}
          data-testid={`facet-range-${group.slug}-from`}
          style={{ minWidth: RANGE_FIELD_MIN_WIDTH }}
          {...grouping}
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
          {...grouping}
          {...(group.min !== undefined ? { min: group.min } : {})}
          {...(group.max !== undefined ? { max: group.max } : {})}
          {...(group.step !== undefined ? { step: group.step } : {})}
          onChange={(value) => {
            setTo(value === null || value === undefined ? "" : String(value));
          }}
          onPressEnter={commit}
        />
        {/* Primary when there is something to apply, secondary when there is
            not. It used to be the other way round — filled over two empty
            fields, ghosted the moment the person had typed the numbers the
            button exists to submit (class C-NOPRIMARY). And no `size="small"`:
            a filter row that a phone cannot hit is not a filter row, and the
            shared `SkinTheme` only raises the DEFAULT control height to 44. */}
        <GatedButton
          gate={apply}
          type={usable && !empty ? "primary" : "default"}
          testId={`facet-range-${group.slug}-apply`}
          data-analytics="none"
          data-analytics-reason="a filter is a read, not a flow step"
          onClick={commit}
        >
          {t(SEARCH_I18N_KEYS.facetsRangeApply)}
        </GatedButton>
        {group.active && (
          <Button
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
