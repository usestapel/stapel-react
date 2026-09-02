/**
 * `<DriveSearchField/>` — the search box, and the debounce that belongs to it.
 *
 * The delay lives HERE, not in the hook: an input's job is to decide when a
 * keystroke has become a question. `useDriveSearch` takes a finished `q`, so a
 * query restored from a URL or picked from a suggestion runs at once, and a
 * caller that already debounced does not pay twice.
 *
 * Results carry the server-materialized breadcrumb of the container they live
 * in, so a hit reads "Q3 budget — My drive › Finance › 2026" without a second
 * request per row (spec §3.3). Tapping one navigates to its FOLDER and hands
 * the row up, which is the only way a flat result list stays connected to the
 * tree it came from.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("searchField", …)`.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Flex, Input, List, Typography } from "antd";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { fontSize, spacing } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { DriveSearch } from "../headless/DriveSearch.js";
import type { DriveSearchHit } from "../api/types.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";

/**
 * How long a person stops typing before it counts as a question. Short enough
 * that the list feels live, long enough that a five-letter word is one
 * request and not five.
 */
export const SEARCH_DEBOUNCE_MS = 250;

export interface DriveSearchFieldProps {
  readonly workspaceId: string;
  /** A hit was chosen: navigate to its container and reveal it. */
  onOpenHit(hit: DriveSearchHit): void;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
}

export function DriveSearchField(props: DriveSearchFieldProps): ReactElement {
  const t = useT();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex vertical gap={spacing[2]} data-testid="drive-search">
        <Input
          value={text}
          allowClear
          aria-label={t(DRIVE_I18N_KEYS.searchLabel)}
          placeholder={t(DRIVE_I18N_KEYS.searchPlaceholder)}
          data-testid="drive-search-input"
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <DriveSearch workspaceId={props.workspaceId} q={q}>
          {(bag) =>
            bag.idle ? (
              <EmptyState
                title={t(DRIVE_I18N_KEYS.searchIdle)}
                compact
                testId="drive-search-idle"
              />
            ) : (
              <LoadBoundary
                state={bag.state}
                onRetry={bag.refetch}
                testId="drive-search-results"
              >
                {(hits) =>
                  hits.length === 0 ? (
                    <EmptyState
                      title={t(DRIVE_I18N_KEYS.searchEmpty)}
                      compact
                      testId="drive-search-empty"
                    />
                  ) : (
                    <List
                      dataSource={[...hits]}
                      rowKey={(hit: DriveSearchHit) => `${hit.kind}:${hit.id}`}
                      renderItem={(hit: DriveSearchHit) => (
                        <List.Item
                          key={`${hit.kind}:${hit.id}`}
                          data-testid={`drive-hit-${hit.id}`}
                          data-analytics="none"
                          data-analytics-reason="navigation within the surface — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
                          onClick={() => {
                            props.onOpenHit(hit);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <List.Item.Meta
                            title={hit.name}
                            description={
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: fontSize.xs.fontSize }}
                              >
                                {[
                                  t(DRIVE_I18N_KEYS.searchInRoot),
                                  ...(hit.breadcrumb ?? []).map(
                                    (node) => node.name
                                  ),
                                ].join(" › ")}
                              </Typography.Text>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )
                }
              </LoadBoundary>
            )
          }
        </DriveSearch>
      </Flex>
    </SkinTheme>
  );
}
