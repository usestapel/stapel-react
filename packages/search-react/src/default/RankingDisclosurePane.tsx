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
import { Flex, List, Tag, Typography } from "antd";
import { useT } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { fontSize, spacing } from "@stapel/tokens";
import type { Scorer } from "../api/types.js";
import { RankingDisclosure } from "../headless/RankingDisclosure.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

export interface RankingDisclosurePaneProps extends ThemeModeProp {
  /** Doc type to disclose; omitted asks for the deployment's default. */
  readonly type?: string;
}

/**
 * The widest a disclosure column may grow. A statutory text is a READING
 * surface: past this it stops being a paragraph and becomes a banner.
 */
export const RANKING_MAX_WIDTH = 720;

export function RankingDisclosurePane(
  props: RankingDisclosurePaneProps
): ReactElement {
  const t = useT();

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      style={{ width: "100%", maxWidth: RANKING_MAX_WIDTH }}
    >
      <RankingDisclosure {...(props.type !== undefined ? { type: props.type } : {})}>
        {(bag) => (
          <Flex vertical gap={spacing[3]} data-testid="search-ranking">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {t(SEARCH_I18N_KEYS.rankingTitle)}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              {t(SEARCH_I18N_KEYS.rankingIntro)}
            </Typography.Paragraph>

            <LoadList
              state={bag.state}
              testId="ranking"
              skeletonRows={4}
              onRetry={bag.refetch}
              empty={
                <EmptyState
                  compact
                  title={t(SEARCH_I18N_KEYS.rankingEmpty)}
                  testId="ranking-empty"
                />
              }
              failed={(error) => (
                <ErrorAlert
                  testId="ranking-failed"
                  thrown={error}
                  message={t(SEARCH_I18N_KEYS.rankingLoadFailed)}
                  onRetry={bag.refetch}
                />
              )}
            >
              {(scorers) => (
                <List<Scorer>
                  data-testid="ranking-list"
                  dataSource={[...scorers]}
                  renderItem={(scorer) => (
                    <List.Item key={scorer.slug} data-scorer={scorer.slug}>
                      <Flex vertical gap={spacing[1]} style={{ width: "100%" }}>
                        <Flex justify="space-between" align="center" gap={spacing[2]}>
                          <Typography.Text strong>
                            {t(scorer.description_key)}
                          </Typography.Text>
                          <Tag>{scorer.weight}</Tag>
                        </Flex>
                        <Typography.Text type="secondary">
                          {scorer.description}
                        </Typography.Text>
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: fontSize.xs.fontSize }}
                        >
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
              )}
            </LoadList>

            {bag.notes.length > 0 && (
              <Flex vertical gap={spacing[1]}>
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
    </SkinTheme>
  );
}
