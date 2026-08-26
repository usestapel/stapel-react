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
import { FILTER_PREFIX, RANGE_PREFIX } from "../state/urlState.js";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/**
 * The parameter as a person can recognise it.
 *
 * The codec reports the WIRE name, which for a facet or a range carries the
 * prefix that tells the backend which family it belongs to (`r.price`,
 * `f.brand`). That prefix is a protocol detail: the sentence is read by
 * somebody who followed a link, and "price" is the part of `r.price` they
 * have any chance of recognising.
 */
function readableParam(param: string): string {
  for (const prefix of [RANGE_PREFIX, FILTER_PREFIX]) {
    if (param.startsWith(prefix)) return param.slice(prefix.length);
  }
  return param;
}

export function UrlIssueNotice(): ReactElement | null {
  const t = useT();
  const { issues } = useSearchState();
  if (issues.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="search-url-issues"
      title={t(SEARCH_I18N_KEYS.urlIssuesTitle)}
      description={
        <ul style={{ margin: 0, paddingInlineStart: spacing[5] }}>
          {issues.map((issue) => (
            <li key={`${issue.param}:${issue.code}`}>
              {t(issue.messageKey, { param: readableParam(issue.param) })}
            </li>
          ))}
        </ul>
      }
    />
  );
}
