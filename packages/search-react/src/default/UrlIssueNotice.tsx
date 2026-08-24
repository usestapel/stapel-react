/**
 * "Part of this link could not be read."
 *
 * A shared search is a link somebody typed, edited, or truncated in a chat
 * app. When the codec cannot read a parameter it reports the fact rather than
 * dropping it silently — because the silent version WIDENS the search (a
 * broken `lat` removes the location filter) and the person is then looking at
 * something other than what was shared, with nothing on screen to say so.
 */
import type { ReactElement } from "react";
import { Alert } from "antd";
import { spacing } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

export function UrlIssueNotice(): ReactElement | null {
  const t = useT();
  const { issues } = useSearchState();
  if (issues.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="search-url-issues"
      message={t(SEARCH_I18N_KEYS.urlIssuesTitle)}
      description={
        <ul style={{ margin: 0, paddingInlineStart: spacing[5] }}>
          {issues.map((issue) => (
            <li key={`${issue.param}:${issue.code}`}>
              {t(issue.messageKey, { param: issue.param })}
            </li>
          ))}
        </ul>
      }
    />
  );
}
