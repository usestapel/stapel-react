/**
 * `<CategoryPickerField>` — the compose form's category chooser.
 *
 * Drill down or search; either way the options come out of the tree that is
 * already in memory, so typing does not issue a request per keystroke and the
 * whole control works offline once the catalogue has synced.
 *
 * The blocked state carries its reason, always. `ActionAvailability`'s rule is
 * that a disabled control must say why, and this control has two different
 * whys — nothing chosen yet, versus a chosen category that still has
 * sub-categories. The second one matters more than it looks: filing a listing
 * under "Electronics" instead of "Electronics › Phones" inherits a different
 * feature set, so the form then asks the wrong questions and the server
 * refuses a field the person never saw.
 *
 * ── The shape it takes on a phone ──────────────────────────────────────────
 *
 * A drill-down is a JOURNEY — roots, then children, then a leaf — and a
 * journey rendered inline inside a long compose form is the worst of both: it
 * pushes every field below it up and down as the level changes, and it gets a
 * third of the screen for the decision that gates the whole form. Below the
 * tablet breakpoint the field is therefore a trigger showing the current
 * answer, and the drill-down is a bottom sheet (`SkinDialog`, the fleet's one
 * dialog surface) with the crumb as its header. Tablet and desktop keep the
 * inline list, where there is room for it. The state lives in the headless
 * bag either way, so the sheet is a container and not a second picker.
 */
import { useId, useState } from "react";
import type { ReactElement } from "react";
import { Breadcrumb, Button, Flex, Input, List, Typography } from "antd";
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import type { TranslateFn } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  PHONE_CONTROL_HEIGHT,
  SkinDialog,
  SkinTheme,
  useDialogSurface,
} from "@stapel/tokens-antd/skin";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import type { CategoryNode } from "../catalog/tree.js";
import { CategoryPicker } from "../headless/CategoryPicker.js";
import type { CategoryOption, CategoryPickerBag } from "../headless/CategoryPicker.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

const BLOCKED_KEY = {
  nothing_selected: CATEGORIES_I18N_KEYS.pickerBlockedNothingSelected,
  not_a_leaf: CATEGORIES_I18N_KEYS.pickerBlockedNotALeaf,
} as const;

export interface CategoryPickerFieldProps extends ThemeModeProp {
  readonly value?: number | null;
  readonly onChange?: (id: number | null, node: CategoryNode | null) => void;
  /** Only leaf categories are valid. Default `true`. */
  readonly leavesOnly?: boolean;
  /**
   * Force the surface instead of reading the viewport — `"sheet"` is the
   * phone shape, `"inline"` the tablet/desktop one. For tests and for a host
   * that renders this field inside a phone-width panel on a desktop. Not an
   * escape hatch for "I prefer the inline list on phones".
   */
  readonly surface?: "sheet" | "inline";
  /**
   * Mount with the phone sheet already open. For a host that routes straight
   * to the choice — and for the showcase, whose phone story photographed a
   * closed trigger because the sheet it documents needs a tap to exist.
   */
  readonly defaultOpen?: boolean;
}

export function CategoryPickerField(
  props: CategoryPickerFieldProps
): ReactElement {
  const t = useT();
  const dialogSurface = useDialogSurface();
  const sheet =
    props.surface !== undefined
      ? props.surface === "sheet"
      : dialogSurface === "sheet";
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const labelId = useId();

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryPicker
        {...(props.value !== undefined ? { value: props.value } : {})}
        {...(props.onChange !== undefined ? { onChange: props.onChange } : {})}
        {...(props.leavesOnly !== undefined
          ? { leavesOnly: props.leavesOnly }
          : {})}
        translate={t}
      >
        {(bag) => {
          const drill = (
            <DrillDown
              bag={bag}
              t={t}
              onSelected={() => {
                if (sheet) setOpen(false);
              }}
            />
          );
          const verdict = <Verdict bag={bag} t={t} />;

          return (
            <Flex vertical gap={spacing[2]} data-testid="categories-picker">
              {sheet ? (
                <>
                  {/* A FIELD, not a centred block of text: a visible label,
                      the value leading, a caret at the end and the touch
                      floor for a height. Centred with no affordance, it read
                      as a read-only value. */}
                  <Typography.Text id={labelId}>
                    {t(CATEGORIES_I18N_KEYS.pickerTitle)}
                  </Typography.Text>
                  <Button
                    block
                    aria-labelledby={labelId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: spacing[2],
                      textAlign: "start",
                      height: "auto",
                      minHeight: PHONE_CONTROL_HEIGHT,
                    }}
                    data-testid="categories-picker-open"
                    data-analytics="none"
                    data-analytics-reason="opens the local drill-down; the host tracks the SUBMIT that consumes the chosen category"
                    onClick={() => {
                      setOpen(true);
                    }}
                  >
                    <span>
                      {bag.selected === null
                        ? t(CATEGORIES_I18N_KEYS.pickerChoose)
                        : renderCategoryLabel(
                            categoryLabel(bag.selected.category),
                            t
                          )}
                    </span>
                    <Typography.Text
                      type="secondary"
                      aria-hidden="true"
                      style={{ fontSize: fontSize.sm.fontSize }}
                    >
                      ›
                    </Typography.Text>
                  </Button>
                  {verdict}
                  <SkinDialog
                    open={open}
                    surface="sheet"
                    onClose={() => {
                      setOpen(false);
                    }}
                    title={t(CATEGORIES_I18N_KEYS.pickerTitle)}
                    dismissLabel={t(STAPEL_UI_KEYS.dismiss)}
                    data-testid="categories-picker-sheet"
                    footer={
                      <Button
                        block
                        type="primary"
                        data-testid="categories-picker-done"
                        data-analytics="none"
                        data-analytics-reason="closes a local sheet; nothing leaves the browser"
                        onClick={() => {
                          setOpen(false);
                        }}
                      >
                        {t(CATEGORIES_I18N_KEYS.pickerDone)}
                      </Button>
                    }
                  >
                    {drill}
                  </SkinDialog>
                </>
              ) : (
                <>
                  {drill}
                  {verdict}
                </>
              )}
            </Flex>
          );
        }}
      </CategoryPicker>
    </SkinTheme>
  );
}

/** The search box, the crumb, and the level — identical in both surfaces. */
function DrillDown(props: {
  readonly bag: CategoryPickerBag;
  readonly t: TranslateFn;
  readonly onSelected: () => void;
}): ReactElement {
  const { bag, t } = props;
  return (
    <Flex vertical gap={spacing[2]}>
      <Input
        allowClear
        value={bag.query}
        placeholder={t(CATEGORIES_I18N_KEYS.pickerSearch)}
        aria-label={t(CATEGORIES_I18N_KEYS.pickerSearch)}
        data-testid="categories-picker-search"
        onChange={(event) => {
          bag.setQuery(event.target.value);
        }}
      />

      {bag.query === "" && bag.path.length > 0 ? (
        <Flex align="center" gap={spacing[2]} wrap>
          <Button
            size="small"
            data-testid="categories-picker-up"
            data-analytics="none"
            data-analytics-reason="walking the local tree is a read; nothing leaves the browser"
            onClick={bag.up}
          >
            {t(CATEGORIES_I18N_KEYS.pickerUp)}
          </Button>
          <Breadcrumb
            items={bag.path.map((node) => ({
              title: renderCategoryLabel(categoryLabel(node.category), t),
            }))}
          />
        </Flex>
      ) : null}

      <LoadList
        state={bag.state}
        testId="categories-picker"
        onRetry={bag.refetch}
        failed={(error) => (
          <ErrorAlert
            testId="categories-picker-failed"
            thrown={error}
            message={t(CATEGORIES_I18N_KEYS.pickerLoadFailed)}
            onRetry={bag.refetch}
          />
        )}
        empty={
          <EmptyState
            testId="categories-picker-empty"
            compact
            title={t(
              bag.query === ""
                ? CATEGORIES_I18N_KEYS.categoryNoSubcategories
                : CATEGORIES_I18N_KEYS.pickerNoMatches
            )}
          />
        }
      >
        {(options) => (
          <List<CategoryOption>
            data-testid="categories-picker-list"
            size="small"
            dataSource={[...options]}
            renderItem={(option) => (
              <List.Item key={option.node.id} data-category-id={option.node.id}>
                <Button
                  block
                  type="text"
                  // The flex lives on the BUTTON, not on a `<Flex>` inside it:
                  // antd centres a button's content and an inner flex box
                  // shrink-wraps, so `justify="space-between"` had nothing to
                  // space and every option row came out centred with the
                  // chevron hugging the label. Height is the touch floor,
                  // because this is a list row people tap.
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: spacing[2],
                    textAlign: "start",
                    width: "100%",
                    height: "auto",
                    minHeight: PHONE_CONTROL_HEIGHT,
                  }}
                  data-category-leaf={option.isLeaf ? "true" : "false"}
                  data-testid={`categories-picker-option-${String(option.node.id)}`}
                  data-analytics="none"
                  data-analytics-reason="drilling into the local tree is a read; the host tracks the SUBMIT that consumes the chosen category"
                  onClick={() => {
                    bag.open(option.node);
                    // A leaf ends the journey: on a phone the sheet has done
                    // its job and closing it is the answer being accepted.
                    if (option.isLeaf) props.onSelected();
                  }}
                >
                  <span>{renderCategoryLabel(option.label, t)}</span>
                  {option.isLeaf ? null : (
                    <Typography.Text
                      type="secondary"
                      aria-hidden="true"
                      style={{ fontSize: fontSize.sm.fontSize }}
                    >
                      ›
                    </Typography.Text>
                  )}
                </Button>
              </List.Item>
            )}
          />
        )}
      </LoadList>
    </Flex>
  );
}

/** Chosen, or blocked with the reason — beside the control, never on hover. */
function Verdict(props: {
  readonly bag: CategoryPickerBag;
  readonly t: TranslateFn;
}): ReactElement {
  const { bag, t } = props;
  return bag.submitBlockedReason !== null ? (
    <Typography.Text
      type="secondary"
      role="status"
      data-testid="categories-picker-blocked"
      data-stapel-gated-reason=""
    >
      {t(BLOCKED_KEY[bag.submitBlockedReason])}
    </Typography.Text>
  ) : (
    <Typography.Text
      type="success"
      role="status"
      data-testid="categories-picker-selected"
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
