/**
 * `<AuditLogPanel/>` — default skin for the security audit log
 * (`AuditLogViewSet`, auth-sa.md §16). Built entirely on the pair's EXISTING
 * `useAuditLog(page)` query — no new backend surface. Dropped during the
 * ironmemo port; re-added here as its own Card so the security page always
 * shows recent account activity, not just the mutable settings around it.
 */
import { fontSize } from "@stapel/tokens";
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Skeleton, Tag, Typography, theme as antdTheme } from "antd";
import { EmptyState, ErrorAlert } from "@stapel/tokens-antd/skin";
import {
  isLoadReady,
  loadStateFromQuery,
  mapLoad,
  matchList,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import { useAuditLog } from "../../model/queries.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { SecurityEmptyIcon } from "./icons.js";
import { SecurityCard, SecurityList, SecurityListRow } from "./SecurityListRow.js";

/** `"user.session_revoked"` → `"User session revoked"` — best-effort, since
 * the set of backend event types is open-ended and not itself an i18n
 * surface this pair owns. */
function humanizeEventType(eventType: string): string {
  const spaced = eventType.replace(/[._]/g, " ").trim();
  if (spaced.length === 0) return eventType;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Full audit-log security screen: a page of recent events, "Load more" for
 * the next one. */
export function AuditLogPanel(): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  // Never the raw `.message` — for a response with no error envelope that
  // is the transport's own "Request failed with status 500" (owner report
  // 2026-08-09). `useErrorText` folds any thrown value into the one dialect.
  const errorDisplay = useErrorDisplay(AUTH_I18N_KEYS.unknownError);
  // The APP's locale, not the browser's — `toLocaleString()` printed a US
  // date into a Spanish interface (visual pass C6).
  const when = useAuthDateFormat();
  const [page, setPage] = useState(1);
  const audit = useAuditLog(page);
  const pageState = loadStateFromQuery(audit);
  const entries = mapLoad(pageState, (p) => p.results ?? []);
  // Only ever read inside the `ready` arm below, where the page IS loaded.
  const nextPage = isLoadReady(pageState) ? pageState.data.next : null;

  return (
    <SecurityCard title={t(AUTH_I18N_KEYS.secAuditTitle)} data-testid="audit-log-panel">
      {matchList(entries, {
        loading: () => (
          <div role="status" aria-busy="true" data-testid="audit-loading">
            <Skeleton active />
          </div>
        ),
        failed: (error) => (
          <ErrorAlert error={errorDisplay(error)} onRetry={() => void audit.refetch()} />
        ),
        empty: () => (
          <EmptyState
            icon={<SecurityEmptyIcon />}
            title={t(AUTH_I18N_KEYS.secAuditEmpty)}
            hint={t(AUTH_I18N_KEYS.secAuditEmptyHint)}
          />
        ),
        ready: (results) => (
          <Flex vertical gap="middle" style={{ width: "100%" }}>
            <SecurityList ruleColor={token.colorBorderSecondary} data-testid="audit-list">
              {results.map((entry) => (
                <SecurityListRow
                  key={entry.id}
                  data-testid="audit-row"
                  title={humanizeEventType(entry.event_type)}
                  /* The chip is a GRID cell beside the meta, not a float over
                     it: right-floating it landed the badge on top of the very
                     timestamp it annotates (visual pass N6). */
                  {...(entry.event_type.includes("suspicious")
                    ? {
                        badges: (
                          <Tag color="warning" data-testid="audit-suspicious">
                            {t(AUTH_I18N_KEYS.secAuditSuspiciousLabel)}
                          </Tag>
                        ),
                      }
                    : {})}
                  meta={
                    <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
                      {when.dateTime(entry.created_at)}
                      {entry.ip_address
                        ? ` — ${t(AUTH_I18N_KEYS.secAuditIp, { ip: entry.ip_address })}`
                        : ""}
                    </Typography.Text>
                  }
                />
              ))}
            </SecurityList>
            {nextPage != null && (
              <Typography.Link
                onClick={() => setPage(nextPage)}
                data-analytics="none"
                data-analytics-reason="local-ui-load-more-audit-page"
              >
                {t(AUTH_I18N_KEYS.secAuditLoadMore)}
              </Typography.Link>
            )}
          </Flex>
        ),
      })}
    </SecurityCard>
  );
}
