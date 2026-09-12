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
import type { CSSProperties, ReactElement } from "react";
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

/**
 * The select's own chrome around its label: antd's two inline paddings plus
 * the caret and its margin. Added to the compact form's sizer (below), which
 * measures a bare label.
 */
export const SORT_SELECT_CHROME = 40;

/**
 * ── THE COMPACT CONTROL'S BOX, HELD FROM THE FIRST FRAME ────────────────────
 *
 * The compact arm draws `value={active ?? null}`, and `active` is only known
 * once the page in cache reports the sort the SERVER applied (see
 * {@link useAppliedSort}) — for an address that names no `sort`, that is a
 * whole round trip after the first paint. So the control rendered as a bare
 * caret and then GREW by the width of its label: measured on a category leaf,
 * the caret's own box moved from x=22 to x=137, 115px, the largest single
 * term in that page's layout shift. `minWidth: 0` was written inline, so no
 * consumer stylesheet could hold the box either.
 *
 * The floor is not {@link SORT_SELECT_MIN_WIDTH}: 200px is the desktop arm's
 * number and would wrap a two-control toolbar onto two rows at 390px. It is
 * the width of the longest label THIS control can be asked to show, at the
 * font it will show it in — so it is measured by the browser rather than
 * guessed in pixels, and it is right in every locale (a Russian sort label is
 * half again as long as its English original).
 *
 * One grid cell, two children stacked in it: an `aria-hidden` sizer carrying
 * the longest label, and the select itself. The cell is as wide as the sizer,
 * the select fills it, and neither depends on `active`.
 */
const COMPACT_WRAP: CSSProperties = {
  display: "inline-grid",
  // `0 0 auto`, not `0 1 auto`: the cell is already the width of the longest
  // label, and letting it SHRINK below that is how a sort select ends up
  // narrower than its own longest option — and, on a two-control phone
  // toolbar, how it takes that width off the control beside it instead. The
  // group wraps as a unit when the line is too short for both; it does not
  // squeeze. `max-content` states the same floor for a consumer stylesheet
  // that resets `flex`.
  flex: "0 0 auto",
  minInlineSize: "max-content",
};

const COMPACT_SIZER: CSSProperties = {
  gridArea: "1 / 1",
  visibility: "hidden",
  blockSize: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  paddingInline: SORT_SELECT_CHROME,
};

const COMPACT_SELECT: CSSProperties = { gridArea: "1 / 1", minWidth: 0 };

/** The longest of the labels the control can display, which is the one the
 * sizer holds. Ties keep the first — they are the same width. */
export function longestSortLabel(labels: readonly string[]): string {
  return labels.reduce((longest, label) =>
    label.length > longest.length ? label : longest
  , "");
}

/** Why `sort=distance` is refused without a centre — the server's own code, so
 * the control and the 400 it would have earned say the same sentence. */
const SORT_DISTANCE_BLOCKED = "error.400.search_sort_needs_center";

export interface SortSelectProps {
  /** The sort the SERVER applied, shown when the URL names none. Omitted, it
   * is read from the page already in cache — see {@link useAppliedSort}. */
  readonly appliedSort?: string | undefined;
  /**
   * The one-line form, for a phone toolbar. Default `false`.
   *
   * Three things change, and the third is the interesting one:
   *
   *  - the "Sort" caption goes (the select already shows a sort by name; the
   *    accessible name keeps the word);
   *  - the {@link SORT_SELECT_MIN_WIDTH} floor goes — the control shares one
   *    row with whatever the surface puts beside it instead of pushing it to
   *    the next line — and is replaced by a floor the width of this control's
   *    OWN longest label, so the box does not grow when the answer names the
   *    sort (see `COMPACT_WRAP`);
   *  - the line under the control goes. The blocked option's REASON does not:
   *    it is on the option itself at every width now (see `optionsFor`), and
   *    what the compact form drops is the second, separate copy of it.
   *
   * The reason lives on the row because that is where the person meets the
   * refusal — a disabled row of the open list, which a screen reader reads out
   * with the option and a thumb reads at the moment of the tap. This file
   * exists because it used to live in a `title=` a phone can never surface,
   * and a phone is exactly where "sort by distance" is greyed out most often;
   * on a 390px toolbar the reason as a separate row would also cost a whole
   * band of the viewport above the first result.
   */
  readonly compact?: boolean;
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
    : actionBlocked(SORT_DISTANCE_BLOCKED);

  /**
   * The list, with the blocked row carrying its own reason — AT EVERY WIDTH.
   *
   * This used to be the compact arm's alone. The desktop arm relied on
   * `GatedControl`'s sentence beside the closed select, which is where a
   * screen reader meets it (`aria-describedby`) and is NOT where a person
   * meets the refusal: they open the list, find one row greyed out, and the
   * explanation for it is behind the open dropdown, above a control the
   * dropdown is covering. A greyed row with no reason on it is the same defect
   * this file was written to fix, one width up — it was a `title=` then and a
   * line the dropdown hides now.
   *
   * So the row says it, and the sentence beside the control stays: one is the
   * accessible description of the SELECT, the other is the label of the OPTION
   * that is refused, and they are read in different moments.
   */
  /**
   * The names this control can DISPLAY, which is what the compact form's
   * sizer is measured on. The blocked row's appended reason is deliberately
   * not among them: it reaches the CLOSED control only for a sort the address
   * itself names, and a sort in the address is known from the first frame —
   * so it can widen the box but can never move it.
   */
  const plainLabels = values.map((value) => {
    const key = sortLabelKey(value);
    return key !== undefined ? t(key) : value;
  });

  const optionsFor = (): {
    readonly value: string;
    readonly label: string;
    readonly disabled: boolean;
  }[] =>
    values.map((value, index) => {
      const label = plainLabels[index] ?? value;
      const blocked = value === "distance" && !hasCentre;
      return {
        value,
        label: blocked ? `${label} — ${t(SORT_DISTANCE_BLOCKED)}` : label,
        disabled: blocked,
      };
    });

  if (props.compact === true) {
    return (
      <div style={COMPACT_WRAP} data-testid="search-sort-compact">
        {/* The box, not a caption — see `COMPACT_WRAP`. */}
        <span aria-hidden="true" data-testid="search-sort-sizer" style={COMPACT_SIZER}>
          {longestSortLabel(plainLabels)}
        </span>
        <Select<string>
          data-testid="search-sort"
          data-stapel-gated={hasCentre ? "available" : "blocked"}
          aria-label={t(SEARCH_I18N_KEYS.sortLabel)}
          style={COMPACT_SELECT}
          value={active ?? null}
          onChange={(next) => {
            setSort(next);
          }}
          options={optionsFor()}
        />
      </div>
    );
  }

  return (
    // `annotate`: the gate judges ONE option, not the control. Suppressing
    // the select would take away every sort, which is not what is blocked.
    <GatedControl gate={distance} whenBlocked="annotate" testId="search-sort-gate">
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
            options={optionsFor()}
          />
        </Flex>
      )}
    </GatedControl>
  );
}
