/**
 * `<FacetPanelPane>` — the antd facet panel.
 *
 * Three things it is obliged to render, all of which a naive panel drops:
 *
 *  - the count NEXT TO EVERY OPTION, including the ones you have not chosen.
 *    Facets are counted with their own filter removed, so those numbers are
 *    "what you would get by switching to this instead" — a sibling that shows
 *    a stale or zeroed count has converted a drill-down facet into a naive one.
 *  - `approximate` — said in words, from the first day, because the counts
 *    genuinely are a sample above the backend's candidate cap.
 *  - `skipped` — the slugs the server did not count at all. Their options show
 *    "not counted", never `0`. A silent zero there is the same defect class as
 *    `data ?? []`: a number that looks like an answer and is not one.
 */
import type { ReactElement } from "react";
import { Alert, Button, Checkbox, Empty, Flex, Spin, Tag, Typography } from "antd";
import { matchList, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import { FacetPanel } from "../headless/FacetPanel.js";
import type { FacetGroup, FacetOption } from "../state/facets.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SearchSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface FacetPanelPaneProps extends ThemeModeProp {
  /** The category's feature schema — the source of option LABELS. */
  readonly categoryFeatures?: readonly FeatureDef[];
  readonly locale?: string;
  readonly enabled?: boolean;
}

function OptionRow(props: {
  group: FacetGroup;
  option: FacetOption;
  onToggle: (slug: string, value: string) => void;
}): ReactElement {
  const t = useT();
  const { option, group } = props;
  return (
    <Flex justify="space-between" align="center" gap={8}>
      <Checkbox
        checked={option.selected}
        data-testid={`facet-option-${group.slug}-${option.value}`}
        data-analytics="none"
        data-analytics-reason="a filter is a read, not a flow step"
        onChange={() => {
          props.onToggle(group.slug, option.value);
        }}
      >
        {option.label}
      </Checkbox>
      {option.count === null ? (
        <Tag data-testid={`facet-count-${group.slug}-${option.value}`}>
          {t(SEARCH_I18N_KEYS.facetsNotCounted)}
        </Tag>
      ) : (
        <Typography.Text
          type="secondary"
          data-testid={`facet-count-${group.slug}-${option.value}`}
        >
          {option.count}
        </Typography.Text>
      )}
    </Flex>
  );
}

export function FacetPanelPane(props: FacetPanelPaneProps): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <SearchSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <FacetPanel
        {...(props.categoryFeatures !== undefined
          ? { categoryFeatures: props.categoryFeatures }
          : {})}
        {...(props.locale !== undefined ? { locale: props.locale } : {})}
        {...(props.enabled !== undefined ? { enabled: props.enabled } : {})}
      >
        {(bag) => (
          <Flex vertical gap={12} data-testid="search-facets">
            <Flex justify="space-between" align="center" gap={8}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t(SEARCH_I18N_KEYS.facetsTitle)}
              </Typography.Title>
              {bag.activeFilters > 0 && (
                <Button
                  size="small"
                  onClick={bag.clearAll}
                  data-analytics="none"
                  data-analytics-reason="a filter is a read, not a flow step"
                  data-testid="facets-clear-all"
                >
                  {t(SEARCH_I18N_KEYS.facetsClearAll, { count: bag.activeFilters })}
                </Button>
              )}
            </Flex>

            {bag.approximate && (
              <Alert
                type="info"
                showIcon
                data-testid="facets-approximate"
                message={t(SEARCH_I18N_KEYS.facetsApproximate)}
              />
            )}
            {bag.skipped.length > 0 && (
              <Alert
                type="warning"
                showIcon
                data-testid="facets-skipped"
                message={t(SEARCH_I18N_KEYS.facetsSkipped, {
                  slugs: bag.skipped.join(", "),
                })}
              />
            )}

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 16 }}>
                  <Spin data-testid="facets-loading" />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="facets-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(SEARCH_I18N_KEYS.facetsLoadFailed),
                  }}
                />
              ),
              empty: () => (
                <Empty
                  data-testid="facets-empty"
                  description={t(SEARCH_I18N_KEYS.facetsEmpty)}
                />
              ),
              ready: (groups) => (
                <Flex vertical gap={16}>
                  {groups.map((group) => (
                    <Flex
                      vertical
                      gap={4}
                      key={group.slug}
                      data-testid={`facet-group-${group.slug}`}
                      data-counted={group.counted ? "true" : "false"}
                    >
                      <Typography.Text strong>{group.label}</Typography.Text>
                      {group.options.map((option) => (
                        <OptionRow
                          key={option.value}
                          group={group}
                          option={option}
                          onToggle={bag.toggle}
                        />
                      ))}
                    </Flex>
                  ))}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t(SEARCH_I18N_KEYS.facetsDrillDownHint)}
                  </Typography.Text>
                </Flex>
              ),
            })}
          </Flex>
        )}
      </FacetPanel>
    </SearchSkinTheme>
  );
}
