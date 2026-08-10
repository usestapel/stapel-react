/**
 * `<AuditLogPanel/>` — default skin for the security audit log
 * (`AuditLogViewSet`, auth-sa.md §16). Built entirely on the pair's EXISTING
 * `useAuditLog(page)` query — no new backend surface. Dropped during the
 * ironmemo port; re-added here as its own Card so the security page always
 * shows recent account activity, not just the mutable settings around it.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Empty, List, Spin, Tag, Typography } from "antd";
import {
  isLoadReady,
  loadStateFromQuery,
  mapLoad,
  matchList,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import { useAuditLog } from "../../model/queries.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { ErrorAlert } from "../ErrorAlert.js";
import { SecurityEmptyIcon } from "./icons.js";

/** `"user.session_revoked"` → `"User session revoked"` — best-effort, since
 * the set of backend event types is open-ended and not itself an i18n
 * surface this pair owns. */
function humanizeEventType(eventType: string): string {
  const spaced = eventType.replace(/[._]/g, " ").trim();
  if (spaced.length === 0) return eventType;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Full audit-log security screen: a page of recent events, "Load more" for
 * the next one. */
export function AuditLogPanel(): ReactElement {
  const t = useT();
  // Never the raw `.message` — for a response with no error envelope that
  // is the transport's own "Request failed with status 500" (owner report
  // 2026-08-09). `useErrorText` folds any thrown value into the one dialect.
  const errorDisplay = useErrorDisplay(AUTH_I18N_KEYS.unknownError);
  const [page, setPage] = useState(1);
  const audit = useAuditLog(page);
  const pageState = loadStateFromQuery(audit);
  const entries = mapLoad(pageState, (p) => p.results);
  // Only ever read inside the `ready` arm below, where the page IS loaded.
  const nextPage = isLoadReady(pageState) ? pageState.data.next : null;

  return (
    <Card title={t(AUTH_I18N_KEYS.secAuditTitle)} data-testid="audit-log-panel" style={{ width: "100%" }}>
      {matchList(entries, {
        loading: () => <Spin />,
        failed: (error) => (
          <ErrorAlert error={errorDisplay(error)} onRetry={() => void audit.refetch()} />
        ),
        empty: () => (
          <Empty image={<SecurityEmptyIcon />} description={t(AUTH_I18N_KEYS.secAuditEmpty)} />
        ),
        ready: (results) => (
          <List
            // antd's `dataSource` is mutable-typed; the rows are readonly.
            dataSource={[...results]}
            renderItem={(entry) => (
              <List.Item key={entry.id}>
                <List.Item.Meta
                  title={humanizeEventType(entry.event_type)}
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatWhen(entry.created_at)}
                      {entry.ip_address
                        ? ` — ${t(AUTH_I18N_KEYS.secAuditIp, { ip: entry.ip_address })}`
                        : ""}
                    </Typography.Text>
                  }
                />
                {entry.event_type.includes("suspicious") && <Tag color="warning">!</Tag>}
              </List.Item>
            )}
            loadMore={
              nextPage != null && (
                <Typography.Link
                  onClick={() => setPage(nextPage)}
                  data-analytics="none"
                  data-analytics-reason="local-ui-load-more-audit-page"
                >
                  {t(AUTH_I18N_KEYS.secAuditLoadMore)}
                </Typography.Link>
              )
            }
          />
        ),
      })}
    </Card>
  );
}
