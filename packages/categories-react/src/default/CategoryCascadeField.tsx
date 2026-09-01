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
 * ── The trail, and popping it ──────────────────────────────────────────────
 *
 * A closable tag per answered level, above the selects. Redundant with the
 * selects by construction and kept anyway, for one reason: on a filter chip
 * the tags are what fits, and closing one is a single tap where re-opening a
 * select and picking its blank entry is three. `onClose` pops to that level —
 * every level below goes with it, because that is what the ladder does.
 *
 * ── What it does NOT draw ─────────────────────────────────────────────────
 *
 * A count beside an option, unless the host supplied one. See
 * `headless/CategoryCascade.tsx` for why no server can currently answer that
 * and why an invented number is worse than none.
 */
import type { ReactElement } from "react";
import { Flex, Select, Tag, Typography } from "antd";
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
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import type { CategoryNode } from "../catalog/tree.js";
import { CategoryCascade } from "../headless/CategoryCascade.js";
import type {
  CategoryCascadeBag,
  CategoryCascadeStep,
  UseCategoryCascadeOptions,
} from "../headless/CategoryCascade.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

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
            <Trail bag={bag} t={t} />

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
                    {steps.map((step) => (
                      <Level
                        key={step.depth}
                        step={step}
                        bag={bag}
                        t={t}
                        grow={inline}
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
  // nothing saying what Electronics is a choice OF. A rung with a real parent
  // keeps its heading, because there the word is not a duplicate of anything.
  const headingHidden = step.parentLabel === null;

  const caption = (node: CategoryNode): string =>
    renderCategoryLabel(categoryLabel(node.category), t);

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
        placeholder={t(CATEGORIES_I18N_KEYS.cascadeChoose)}
        value={step.chosen?.id ?? null}
        aria-label={heading}
        data-testid={`categories-cascade-select-${String(step.depth)}`}
        data-analytics="none"
        data-analytics-reason="walking the synced tree is a local read; the host tracks the search or the submit that consumes the chosen category"
        notFoundContent={t(CATEGORIES_I18N_KEYS.pickerNoMatches)}
        options={step.options.map((option) => ({
          value: option.node.id,
          // `label` is what antd filters and renders in the closed box; the
          // count rides in `title` only when a host supplied one, so an
          // unfilled column adds nothing to the caption rather than a "(—)".
          label: caption(option.node),
          ...(option.count !== null
            ? { title: `${caption(option.node)} (${String(option.count)})` }
            : {}),
        }))}
        onChange={(id) => {
          const chosen =
            id === undefined || id === null
              ? null
              : (step.options.find((option) => option.node.id === id)?.node ??
                null);
          bag.choose(step.depth, chosen);
        }}
      />
    </Flex>
  );
}

/** The answered levels as closable tags — the poppable trail. */
function Trail(props: {
  readonly bag: CategoryCascadeBag;
  readonly t: TranslateFn;
}): ReactElement | null {
  const { bag, t } = props;
  if (bag.trail.length === 0) return null;
  return (
    <Flex gap={spacing[1]} wrap data-testid="categories-cascade-trail">
      {bag.trail.map((node, depth) => (
        <Tag
          key={node.id}
          closable
          data-testid={`categories-cascade-crumb-${String(node.id)}`}
          onClose={(event) => {
            event.preventDefault();
            bag.clearFrom(depth);
          }}
        >
          {renderCategoryLabel(categoryLabel(node.category), t)}
        </Tag>
      ))}
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
            : renderCategoryLabel(categoryLabel(bag.selected.category), t),
      })}
    </Typography.Text>
  );
}
