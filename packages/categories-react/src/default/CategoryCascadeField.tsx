/**
 * `<CategoryCascadeField>` — the cascading child selector, drawn.
 *
 * One select per level: the catalogue's roots, then that root's children, then
 * theirs, down to a leaf. It is deliberately the SAME control a person meets
 * as `Brand -> Model` inside a category's own characteristics, because under
 * the owner's navigation model a deep category IS a characteristic — the tiles
 * hand over here after level 2 and the gesture must not change at the handover.
 *
 * ── Selects, not a drill-down list ─────────────────────────────────────────
 *
 * The distinction is the whole control. `<CategoryPickerField>` shows ONE list
 * that replaces itself as you descend: to change a decision three levels up
 * you re-open the sheet and walk down again, and while the sheet is closed the
 * only thing on screen is the leaf. This field shows every level at once, each
 * still open to a different answer, and changing one drops the ones below it
 * because they are derived (`catalog/cascade.ts`) rather than remembered.
 *
 * On a phone that matters twice over: the answered levels ARE the trail, so
 * "where am I" costs no separate row, and a person who took a wrong turn fixes
 * the turn instead of restarting the journey.
 *
 * ── Every select searches ─────────────────────────────────────────────────
 *
 * `showSearch`, and not as a nicety: a live catalogue's top level has 130 rows
 * and its `Electronics` has 13. A select that made a person scroll 130 options
 * on a 390px screen would be the modal drill-down again, wearing a caret. The
 * filter runs over the RENDERED caption, so typing matches what is on screen
 * rather than the `category.` translation key underneath it
 * (`catalog/labels.ts`).
 *
 * ── The trail is gone, and the selects absorbed its one job ───────────────
 *
 * There used to be a row of closable tags above the selects — one per
 * answered level. It was redundant with the selects BY CONSTRUCTION, which
 * this file said out loud and kept anyway, on the argument that popping a tag
 * is one tap where re-opening a select and picking its blank entry is three.
 *
 * That argument had already expired: every rung carries `allowClear`, so the
 * × inside the select pops that level in exactly one tap, from the control
 * that is already showing the answer. What the tags actually bought was a
 * second printing of the path, and the measurement is what settled it — the
 * phone's filter sheet opened on the chosen leaf's three names, and then the
 * same three names again in the selects under them: half a screen spent
 * restating one fact before the first control (walker D103; the composer's
 * step 3 was the same shape, D89). One path, printed once, in the controls
 * that can change it.
 *
 * ── What it does NOT draw ─────────────────────────────────────────────────
 *
 * A count beside an option, unless the host supplied one. See
 * `headless/CategoryCascade.tsx` for why no server can currently answer that
 * and why an invented number is worse than none.
 */
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import type { TranslateFn } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  LoadBoundary,
  PHONE_CONTROL_HEIGHT,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { Category } from "../api/types.js";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import { CategoryCascade } from "../headless/CategoryCascade.js";
import type {
  CategoryCascadeBag,
  CategoryCascadeStep,
  UseCategoryCascadeOptions,
} from "../headless/CategoryCascade.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

/**
 * How tall a rung's option list may be, in pixels.
 *
 * Ten rows of the skin's 44px touch target plus the list's own padding — the
 * size of a catalogue's top level, which is the one rung a person must be
 * able to read whole. antd's 256px default cut it at seven.
 */
const CASCADE_LIST_HEIGHT = 456;

export interface CategoryCascadeFieldProps
  extends UseCategoryCascadeOptions,
    ThemeModeProp {
  /**
   * `"stack"` (default) puts one select per line — the composer's shape, and
   * the desktop filter rail's.
   *
   * `"inline"` lets them wrap side by side, which is what fits inside a filter
   * chip's sheet where the ladder is rarely more than two rungs.
   */
  readonly layout?: "stack" | "inline";
  /**
   * Print the verdict line under the control. Default `true`.
   *
   * The composer needs it — the whole attribute form is gated on reaching a
   * leaf, and a control that goes quiet without saying why is the thing
   * `ActionAvailability` exists to prevent. A filter chip does not: there the
   * narrowing is visible in the results themselves and the chip's own label
   * already carries the answer.
   */
  readonly verdict?: boolean;
}

export function CategoryCascadeField(
  props: CategoryCascadeFieldProps
): ReactElement {
  const t = useT();
  const { layout, verdict, mode, ...cascadeOptions } = props;
  const inline = layout === "inline";

  return (
    <SkinTheme {...(mode !== undefined ? { mode } : {})}>
      <CategoryCascade {...cascadeOptions}>
        {(bag) => (
          <Flex
            vertical
            gap={spacing[2]}
            data-testid="categories-cascade"
            data-at-leaf={bag.atLeaf ? "true" : "false"}
          >
            <LoadBoundary
              state={bag.state}
              testId="categories-cascade"
              onRetry={bag.refetch}
              skeletonRows={2}
              failed={(error) => (
                <ErrorAlert
                  testId="categories-cascade-failed"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.catalogLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
            >
              {(steps) =>
                steps.length === 0 ? (
                  // A rooted cascade whose root is a leaf. Not an error and
                  // not a gap: the tiles arrived somewhere there is nothing
                  // further to narrow, and saying so beats an empty box.
                  <EmptyState
                    compact
                    testId="categories-cascade-exhausted"
                    title={t(CATEGORIES_I18N_KEYS.categoryNoSubcategories)}
                  />
                ) : (
                  <Flex
                    gap={spacing[2]}
                    vertical={!inline}
                    wrap={inline ? "wrap" : undefined}
                  >
                    {steps.map((step, index) => (
                      <Level
                        key={step.depth}
                        step={step}
                        bag={bag}
                        t={t}
                        grow={inline}
                        first={index === 0}
                      />
                    ))}
                  </Flex>
                )
              }
            </LoadBoundary>

            {verdict === false ? null : <Verdict bag={bag} t={t} />}
          </Flex>
        )}
      </CategoryCascade>
    </SkinTheme>
  );
}

/** One rung: its heading and its select. */
function Level(props: {
  readonly step: CategoryCascadeStep;
  readonly bag: CategoryCascadeBag;
  readonly t: TranslateFn;
  readonly grow: boolean;
  /** The topmost rung. Only its heading names something no other rung shows. */
  readonly first: boolean;
}): ReactElement {
  const { step, bag, t } = props;
  // The heading names what is being CHOSEN FROM, which is the parent. At the
  // top of a rootless ladder there is no parent, and the generic word is the
  // honest one — "Category", not the name of a row that does not exist.
  const heading =
    step.parentLabel === null
      ? t(CATEGORIES_I18N_KEYS.categoryTitle)
      : renderCategoryLabel(step.parentLabel, t);
  // …and that generic word is the one every surface that mounts this control
  // has ALREADY printed: the composer's form item says "Category" above it and
  // the filter chip's sheet is titled "Category". Printed again in a second
  // type size it reads as two stacked controls. So the top rung's heading is
  // dropped from the SCREEN and kept in the accessibility tree — the same
  // distinction `<CategoryPickerField>` draws, and the same reason: a select
  // whose only name is its value announces "Electronics, combobox" with
  // nothing saying what Electronics is a choice OF.
  //
  // Every rung BELOW the first is hidden for the same reason with a different
  // word: its parent's name is, by construction, the chosen value of the rung
  // directly above it — visible, one control away, in a bigger type size. The
  // phone's filter sheet printed the consequence in full: "Electronics /
  // Electronics / Phones / Phones / Mobile phones", five lines for a
  // three-level path, before the first control (walker D103; the composer's
  // step 3 was the same shape, D89). Removing the crumb tags took the path
  // from three printings to two; this takes it to one.
  //
  // Only the FIRST rung of a ROOTED cascade keeps a visible heading, because
  // there the parent is the root the tiles handed over at — a category no rung
  // is showing, so the word is information rather than an echo. The rest keep
  // it in `aria-label`, where it was never the duplicate.
  const headingHidden = step.parentLabel === null || !props.first;

  const caption = (category: Category): string =>
    renderCategoryLabel(categoryLabel(category), t);

  return (
    <Flex
      vertical
      gap={spacing[1]}
      style={props.grow ? { flex: "1 1 12rem", minWidth: 0 } : undefined}
      data-testid={`categories-cascade-level-${String(step.depth)}`}
    >
      {headingHidden ? null : (
        <Typography.Text
          type="secondary"
          style={{ fontSize: fontSize.sm.fontSize }}
        >
          {heading}
        </Typography.Text>
      )}
      <Select<number>
        allowClear
        showSearch
        // The caption, not the key: a person types what they can read.
        optionFilterProp="label"
        style={{ width: "100%", minHeight: PHONE_CONTROL_HEIGHT }}
        // A short rung must not need a gesture to be read in full.
        //
        // antd's dropdown is 256px tall by default. With the touch-sized rows
        // this skin draws (44px), that shows five and a half of them, and the
        // seventh row sits flush with the bottom edge — so a ten-option rung
        // renders with no visual cue that three more exist, behind an 8px
        // scrollbar. Two separate walkers reported a ten-root catalogue as
        // "seven roots" from exactly that view, and a scripted `scrollTop`
        // cannot move it either: a virtualised list keeps `overflow-y:
        // hidden` on its holder and scrolls itself.
        //
        // `listHeight` is the whole fix: a rung of this size now fits. Longer
        // rungs (fifty manufacturers) still scroll, and they always looked
        // scrollable because a row is cut by the edge.
        listHeight={CASCADE_LIST_HEIGHT}
        placeholder={t(CATEGORIES_I18N_KEYS.cascadeChoose)}
        value={step.chosen?.id ?? null}
        aria-label={heading}
        data-testid={`categories-cascade-select-${String(step.depth)}`}
        data-analytics="none"
        data-analytics-reason="a rung is one small children read; the host tracks the search or the submit that consumes the chosen category"
        notFoundContent={t(CATEGORIES_I18N_KEYS.pickerNoMatches)}
        options={step.options.map((option) => ({
          value: option.category.id,
          // `label` is what antd filters and renders in the closed box; the
          // count rides in `title` only when a host supplied one, so an
          // unfilled column adds nothing to the caption rather than a "(—)".
          label: caption(option.category),
          ...(option.count !== null
            ? { title: `${caption(option.category)} (${String(option.count)})` }
            : {}),
        }))}
        onChange={(id) => {
          const chosen =
            id === undefined || id === null
              ? null
              : (step.options.find((option) => option.category.id === id)
                  ?.category ?? null);
          bag.choose(step.depth, chosen);
        }}
      />
    </Flex>
  );
}

/**
 * Where the ladder got to, or why it is not done — beside the control, never
 * on hover.
 *
 * `not_a_leaf` is the sentence the composer's whole gate hangs on, and it is
 * the same key `<CategoryPickerField>` uses: one refusal, one wording, two
 * controls.
 */
function Verdict(props: {
  readonly bag: CategoryCascadeBag;
  readonly t: TranslateFn;
}): ReactElement {
  const { bag, t } = props;
  if (bag.blockedReason !== null) {
    return (
      <Typography.Text
        type="secondary"
        role="status"
        data-testid="categories-cascade-blocked"
        data-stapel-gated-reason=""
      >
        {t(
          bag.blockedReason === "nothing_selected"
            ? CATEGORIES_I18N_KEYS.cascadeBlockedNothingSelected
            : CATEGORIES_I18N_KEYS.pickerBlockedNotALeaf
        )}
      </Typography.Text>
    );
  }
  return (
    <Typography.Text
      type="success"
      role="status"
      data-testid="categories-cascade-selected"
    >
      {t(CATEGORIES_I18N_KEYS.pickerSelected, {
        category:
          bag.selected === null
            ? ""
            : renderCategoryLabel(categoryLabel(bag.selected), t),
      })}
    </Typography.Text>
  );
}
