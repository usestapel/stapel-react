/**
 * `<CategoryFeatureList>` — a category's feature SCHEMA, rendered.
 *
 * The display integration with `@stapel/attributes-react` in the direction
 * this pair owns: categories serves the definitions, attributes knows what a
 * definition MEANS. So the type badge is not a string this file invents —
 * `featureType` is attributes-react's single reader of `config.type`, and
 * `BUILTIN_VALUE_EDITOR_TYPES` is its own statement of which types a build can
 * actually draw. A type outside that set is marked here, on the schema, rather
 * than discovered when somebody opens the compose form and finds a missing
 * field.
 *
 * The other direction — values, not definitions — belongs to attributes-react
 * outright: `formatFeatureValue`, `<FeatureBadges>`, `<FeatureValueList>`. A
 * listing card imports those directly and this pair is not in the path.
 */
import type { ReactElement } from "react";
import { Empty, Flex, List, Spin, Tag, Typography } from "antd";
import { matchList, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import { BUILTIN_VALUE_EDITOR_TYPES } from "@stapel/attributes-react/default";
import { renderCategoryLabel } from "../catalog/labels.js";
import { CategoryFeatures } from "../headless/CategoryFeatures.js";
import type { CategoryFeatureEntry } from "../headless/CategoryFeatures.js";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { CategoriesSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface CategoryFeatureListProps extends ThemeModeProp {
  readonly categoryId: number | null | undefined;
}

export function CategoryFeatureList(
  props: CategoryFeatureListProps
): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const drawable = new Set<string>(BUILTIN_VALUE_EDITOR_TYPES);

  return (
    <CategoriesSkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryFeatures categoryId={props.categoryId}>
        {(bag) => (
          <Flex vertical gap={8} data-testid="categories-features">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(CATEGORIES_I18N_KEYS.featuresTitle)}
            </Typography.Title>

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 16 }}>
                  <Spin data-testid="categories-features-loading" />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="categories-features-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(CATEGORIES_I18N_KEYS.featuresLoadFailed),
                  }}
                />
              ),
              empty: () => (
                <Empty
                  data-testid="categories-features-empty"
                  description={t(CATEGORIES_I18N_KEYS.featuresEmpty)}
                />
              ),
              ready: (entries) => (
                <List<CategoryFeatureEntry>
                  data-testid="categories-features-list"
                  size="small"
                  dataSource={[...entries]}
                  renderItem={(entry) => (
                    <List.Item
                      key={entry.feature.slug}
                      data-feature-slug={entry.feature.slug}
                    >
                      <Flex
                        justify="space-between"
                        align="center"
                        gap={8}
                        style={{ width: "100%" }}
                      >
                        <Typography.Text>
                          {renderCategoryLabel(entry.label, t)}
                        </Typography.Text>
                        <Flex gap={4} align="center">
                          {entry.mandatory ? (
                            <Tag color="red">
                              {t(CATEGORIES_I18N_KEYS.featuresMandatory)}
                            </Tag>
                          ) : null}
                          {entry.type === undefined ? (
                            <Tag color="warning" data-feature-untyped>
                              {t(CATEGORIES_I18N_KEYS.featuresUntyped)}
                            </Tag>
                          ) : (
                            <Tag
                              {...(drawable.has(entry.type)
                                ? {}
                                : { color: "warning" })}
                              data-feature-type={entry.type}
                            >
                              {t(CATEGORIES_I18N_KEYS.featuresType, {
                                type: entry.type,
                              })}
                            </Tag>
                          )}
                        </Flex>
                      </Flex>
                    </List.Item>
                  )}
                />
              ),
            })}
          </Flex>
        )}
      </CategoryFeatures>
    </CategoriesSkinTheme>
  );
}
