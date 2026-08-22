/**
 * `<RankingDisclosurePane>` — the P2B Art. 5 page: which parameters decide
 * the order of results, their relative weight, and which of them the
 * configured engine cannot actually evaluate.
 *
 * Generated from the backend's scorer registry, so it cannot drift from the
 * ranking it describes — which is the only version of this page worth
 * shipping.
 */
import type { ReactElement } from "react";
import { Empty, Flex, List, Spin, Tag, Typography } from "antd";
import { matchList, toFlowError, useDescribeFlowError, useT } from "@stapel/core";
import type { Scorer } from "../api/types.js";
import { RankingDisclosure } from "../headless/RankingDisclosure.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { SearchSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

export interface RankingDisclosurePaneProps extends ThemeModeProp {
  /** Doc type to disclose; omitted asks for the deployment's default. */
  readonly type?: string;
}

export function RankingDisclosurePane(
  props: RankingDisclosurePaneProps
): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();

  return (
    <SearchSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <RankingDisclosure {...(props.type !== undefined ? { type: props.type } : {})}>
        {(bag) => (
          <Flex vertical gap={12} data-testid="search-ranking">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t(SEARCH_I18N_KEYS.rankingTitle)}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              {t(SEARCH_I18N_KEYS.rankingIntro)}
            </Typography.Paragraph>

            {matchList(bag.state, {
              loading: () => (
                <Flex justify="center" style={{ padding: 16 }}>
                  <Spin data-testid="ranking-loading" />
                </Flex>
              ),
              failed: (error) => (
                <ErrorAlert
                  testId="ranking-failed"
                  error={{
                    ...describe(toFlowError(error)),
                    message: t(SEARCH_I18N_KEYS.rankingLoadFailed),
                  }}
                />
              ),
              empty: () => (
                <Empty
                  data-testid="ranking-empty"
                  description={t(SEARCH_I18N_KEYS.rankingEmpty)}
                />
              ),
              ready: (scorers) => (
                <List<Scorer>
                  data-testid="ranking-list"
                  dataSource={[...scorers]}
                  renderItem={(scorer) => (
                    <List.Item key={scorer.slug} data-scorer={scorer.slug}>
                      <Flex vertical gap={2} style={{ width: "100%" }}>
                        <Flex justify="space-between" align="center" gap={8}>
                          <Typography.Text strong>
                            {t(scorer.description_key)}
                          </Typography.Text>
                          <Tag>{scorer.weight}</Tag>
                        </Flex>
                        <Typography.Text type="secondary">
                          {scorer.description}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t(SEARCH_I18N_KEYS.rankingAppliesTo)}
                          {": "}
                          {scorer.applies_to_sorts.join(", ")}
                        </Typography.Text>
                        {!scorer.active && (
                          <Typography.Text type="warning" data-testid="ranking-inactive">
                            {t(SEARCH_I18N_KEYS.rankingInactive, {
                              reason: scorer.inactive_reason,
                            })}
                          </Typography.Text>
                        )}
                      </Flex>
                    </List.Item>
                  )}
                />
              ),
            })}

            {bag.notes.length > 0 && (
              <Flex vertical gap={2}>
                <Typography.Text strong>
                  {t(SEARCH_I18N_KEYS.rankingNotes)}
                </Typography.Text>
                {bag.notes.map((note) => (
                  <Typography.Text type="secondary" key={note}>
                    {note}
                  </Typography.Text>
                ))}
              </Flex>
            )}
          </Flex>
        )}
      </RankingDisclosure>
    </SearchSkinTheme>
  );
}
