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
 */
import type { ReactElement } from "react";
import { Alert, Breadcrumb, Button, Empty, Flex, Input, List, Spin } from "antd";
import { matchList, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import type { CategoryNode } from "../catalog/tree.js";
import { CategoryPicker } from "../headless/CategoryPicker.js";
import type { CategoryOption } from "../headless/CategoryPicker.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CategoriesSkinTheme } from "./theme.js";
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
}

export function CategoryPickerField(
  props: CategoryPickerFieldProps
): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <CategoriesSkinTheme
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
        {(bag) => (
          <Flex vertical gap={8} data-testid="categories-picker">
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
              <Flex align="center" gap={8}>
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
                    title: renderCategoryLabel(
                      categoryLabel(node.category),
                      t
                    ),
                  }))}
                />
              </Flex>
            ) : null}

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 16 }}>
                  <Spin data-testid="categories-picker-loading" />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="categories-picker-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(CATEGORIES_I18N_KEYS.pickerLoadFailed),
                  }}
                />
              ),
              empty: () => (
                <Empty
                  data-testid="categories-picker-empty"
                  description={t(
                    bag.query === ""
                      ? CATEGORIES_I18N_KEYS.categoryNoSubcategories
                      : CATEGORIES_I18N_KEYS.pickerNoMatches
                  )}
                />
              ),
              ready: (options) => (
                <List<CategoryOption>
                  data-testid="categories-picker-list"
                  size="small"
                  dataSource={[...options]}
                  renderItem={(option) => (
                    <List.Item
                      key={option.node.id}
                      data-category-id={option.node.id}
                    >
                      <Button
                        type="link"
                        data-testid={`categories-picker-option-${String(option.node.id)}`}
                        data-analytics="none"
                        data-analytics-reason="drilling into the local tree is a read; the host tracks the SUBMIT that consumes the chosen category"
                        onClick={() => {
                          bag.open(option.node);
                        }}
                      >
                        {renderCategoryLabel(option.label, t)}
                      </Button>
                    </List.Item>
                  )}
                />
              ),
            })}

            {bag.submitBlockedReason !== null ? (
              <Alert
                type="info"
                showIcon
                data-testid="categories-picker-blocked"
                message={t(BLOCKED_KEY[bag.submitBlockedReason])}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                data-testid="categories-picker-selected"
                message={t(CATEGORIES_I18N_KEYS.pickerSelected, {
                  category:
                    bag.selected === null
                      ? ""
                      : renderCategoryLabel(
                          categoryLabel(bag.selected.category),
                          t
                        ),
                })}
              />
            )}
          </Flex>
        )}
      </CategoryPicker>
    </CategoriesSkinTheme>
  );
}
