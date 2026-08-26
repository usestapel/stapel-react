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
import { fontSize, spacing } from "@stapel/tokens";
import type { ReactElement } from "react";
import { Flex, List, Tag, Typography } from "antd";
import { useT } from "@stapel/core";
import { BUILTIN_VALUE_EDITOR_TYPES } from "@stapel/attributes-react/default";
import { featureCommentLabel, renderCategoryLabel } from "../catalog/labels.js";
import { CategoryFeatures } from "../headless/CategoryFeatures.js";
import type { CategoryFeatureEntry } from "../headless/CategoryFeatures.js";
import { CATEGORIES_I18N_KEYS, FEATURE_TYPE_LABEL_KEYS } from "../i18n/keys.js";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

export interface CategoryFeatureListProps extends ThemeModeProp {
  readonly categoryId: number | null | undefined;
}

export function CategoryFeatureList(
  props: CategoryFeatureListProps
): ReactElement {
  const t = useT();
  const drawable = new Set<string>(BUILTIN_VALUE_EDITOR_TYPES);

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <CategoryFeatures categoryId={props.categoryId}>
        {(bag) => (
          <Flex vertical gap={spacing[2]} data-testid="categories-features">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {t(CATEGORIES_I18N_KEYS.featuresTitle)}
            </Typography.Title>

            <LoadList
              state={bag.state}
              testId="categories-features"
              onRetry={bag.refetch}
              failed={(error) => (
                <ErrorAlert
                  testId="categories-features-failed"
                  thrown={error}
                  message={t(CATEGORIES_I18N_KEYS.featuresLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
              empty={
                <EmptyState
                  testId="categories-features-empty"
                  compact
                  title={t(CATEGORIES_I18N_KEYS.featuresEmpty)}
                />
              }
            >
              {(entries) => (
                <List<CategoryFeatureEntry>
                  data-testid="categories-features-list"
                  size="small"
                  dataSource={[...entries]}
                  renderItem={(entry) => {
                    // The catalogue author's note TO the person filling in the
                    // form ("as printed on the label"). It reached no screen
                    // in the fleet before this line — see `featureCommentLabel`.
                    const comment = featureCommentLabel(entry.feature);
                    return (
                      <List.Item
                        key={entry.feature.slug}
                        data-feature-slug={entry.feature.slug}
                      >
                        <Flex
                          justify="space-between"
                          align="flex-start"
                          gap={spacing[2]}
                          style={{ width: "100%" }}
                        >
                          <Flex vertical gap={spacing[1]}>
                            <Typography.Text>
                              {renderCategoryLabel(entry.label, t)}
                            </Typography.Text>
                            {comment !== null ? (
                              <Typography.Text
                                type="secondary"
                                data-testid={`categories-feature-comment-${entry.feature.slug}`}
                                style={{ fontSize: fontSize.sm.fontSize }}
                              >
                                {renderCategoryLabel(comment, t)}
                              </Typography.Text>
                            ) : null}
                          </Flex>
                          <Flex gap={spacing[1]} align="center">
                            {/* "Required" is a fact about the field, not a
                                failure: the danger token made every mandatory
                                row read as an error. */}
                            {entry.mandatory ? (
                              <Tag>
                                {t(CATEGORIES_I18N_KEYS.featuresMandatory)}
                              </Tag>
                            ) : null}
                            {entry.type === undefined ? (
                              <Tag color="warning" data-feature-untyped>
                                {t(CATEGORIES_I18N_KEYS.featuresUntyped)}
                              </Tag>
                            ) : (
                              // The WORD, never the identifier: `int`, `bool`
                              // and a host's own `holo_signature` were the
                              // badge's copy on a public category page. The
                              // machine name stays on the element, where a
                              // test can read it and a person cannot.
                              <Tag
                                {...(drawable.has(entry.type)
                                  ? {}
                                  : { color: "warning" })}
                                data-feature-type={entry.type}
                              >
                                {t(
                                  FEATURE_TYPE_LABEL_KEYS[entry.type] ??
                                    CATEGORIES_I18N_KEYS.featuresTypeOther
                                )}
                              </Tag>
                            )}
                          </Flex>
                        </Flex>
                      </List.Item>
                    );
                  }}
                />
              )}
            </LoadList>
          </Flex>
        )}
      </CategoryFeatures>
    </SkinTheme>
  );
}
