/**
 * `<AdminAuditPanel/>` — the GLOBAL security stream: every account's events,
 * as opposed to `<AuditLogPanel/>`'s "mine".
 *
 * Filters are COMMITTED, not live: a filter set is a cache key
 * (`adminAuditCacheKey`), so applying on every keystroke would be one request
 * per character and a page number that means nothing between them. The draft
 * lives in the form; pressing Apply is what makes it a read, and it resets to
 * page 1 because a page number from a different filter set is a different
 * page.
 *
 * Dates are `<input type="date">`: the platform's own picker, localized by
 * the browser, keyboard-operable, and no extra date library in a bundle that
 * ships to operators on phones. It emits `YYYY-MM-DD`, which is what the
 * query parameters take.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, Flex, Form, Input, List, Skeleton, Tag, Typography } from "antd";
import { fontSize } from "@stapel/tokens";
import { isLoadReady, loadStateFromQuery, mapLoad, matchList, useT } from "@stapel/core";
import { EmptyState, ErrorAlert } from "@stapel/tokens-antd/skin";
import type { AdminAuditQuery } from "../../api/types.js";
import { useAdminAudit } from "../../model/queries.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { AdminScreen } from "./AdminScreen.js";

interface FilterFormValues {
  readonly event_type?: string;
  readonly user_id?: string;
  readonly date_from?: string;
  readonly date_to?: string;
}

/** `"user.session_revoked"` → `"User session revoked"`. Best-effort: the set
 *  of backend event types is open-ended and not an i18n surface this pair
 *  owns, so the identifier is made readable rather than translated. */
function humanizeEventType(eventType: string): string {
  const spaced = eventType.replace(/[._]/g, " ").trim();
  if (spaced.length === 0) return eventType;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Drop the empty boxes: an `event_type=""` parameter is a filter on the
 *  empty string, not the absence of a filter. */
function toQuery(values: FilterFormValues, page: number): AdminAuditQuery {
  const query: Record<string, string | number> = { page };
  for (const [key, value] of Object.entries(values)) {
    const trimmed = (value ?? "").trim();
    if (trimmed !== "") query[key] = trimmed;
  }
  return query as AdminAuditQuery;
}

/** The global audit stream with committed filters and page-at-a-time reads. */
export function AdminAuditPanel(): ReactElement {
  const t = useT();
  const when = useAuthDateFormat();
  const [applied, setApplied] = useState<FilterFormValues>({});
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<FilterFormValues>();

  const audit = useAdminAudit(toQuery(applied, page));
  const pageState = loadStateFromQuery(audit);
  const entries = mapLoad(pageState, (p) => p.results);
  const nextPage = isLoadReady(pageState) ? pageState.data.next : null;
  const total = isLoadReady(pageState) ? pageState.data.count : null;

  return (
    <AdminScreen
      testId="admin-audit"
      title={t(AUTH_I18N_KEYS.adminAuditTitle)}
      subtitle={t(AUTH_I18N_KEYS.adminAuditSubtitle)}
    >
      <Card style={{ width: "100%" }}>
        <Flex vertical gap="middle" style={{ width: "100%" }}>
          <Form
            form={form}
            layout="vertical"
            data-testid="admin-audit-filters"
            onFinish={(values: FilterFormValues) => {
              setApplied(values);
              // A page number from another filter set is a different page.
              setPage(1);
            }}
          >
            <Flex gap="middle" wrap align="flex-end">
              <Form.Item
                name="event_type"
                label={t(AUTH_I18N_KEYS.adminAuditFilterEvent)}
                style={{ minWidth: "12rem", flex: "1 1 12rem", marginBottom: 0 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="user_id"
                label={t(AUTH_I18N_KEYS.adminAuditFilterUser)}
                style={{ minWidth: "12rem", flex: "1 1 12rem", marginBottom: 0 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="date_from"
                label={t(AUTH_I18N_KEYS.adminAuditFilterFrom)}
                style={{ marginBottom: 0 }}
              >
                <Input type="date" />
              </Form.Item>
              <Form.Item
                name="date_to"
                label={t(AUTH_I18N_KEYS.adminAuditFilterTo)}
                style={{ marginBottom: 0 }}
              >
                <Input type="date" />
              </Form.Item>
              <Flex gap="small">
                <Button type="primary" htmlType="submit" data-analytics="flow">
                  {t(AUTH_I18N_KEYS.adminAuditApply)}
                </Button>
                <Button
                  onClick={() => {
                    form.resetFields();
                    setApplied({});
                    setPage(1);
                  }}
                  data-analytics="none"
                  data-analytics-reason="local-ui-clear-admin-audit-filters"
                >
                  {t(AUTH_I18N_KEYS.adminAuditClear)}
                </Button>
              </Flex>
            </Flex>
          </Form>

          {total !== null && (
            <Typography.Text type="secondary" data-testid="admin-audit-count">
              {t(AUTH_I18N_KEYS.adminAuditCount, { count: total })}
            </Typography.Text>
          )}

          {matchList(entries, {
            loading: () => (
              <div role="status" aria-busy="true" data-testid="admin-audit-loading">
            <Skeleton active />
          </div>
            ),
            failed: (error) => (
              <ErrorAlert thrown={error} onRetry={() => void audit.refetch()} />
            ),
            empty: () => (
              <EmptyState
                title={t(AUTH_I18N_KEYS.adminAuditEmpty)}
                hint={t(AUTH_I18N_KEYS.adminAuditEmptyHint)}
              />
            ),
            ready: (results) => (
              <List
                // antd's `dataSource` is mutable-typed; the rows are readonly.
                dataSource={[...results]}
                data-testid="admin-audit-list"
                renderItem={(entry) => (
                  <List.Item key={entry.id}>
                    <List.Item.Meta
                      title={humanizeEventType(entry.event_type)}
                      description={
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: fontSize.xs.fontSize }}
                        >
                          {when.dateTime(entry.created_at)}
                          {entry.ip_address
                            ? ` — ${t(AUTH_I18N_KEYS.secAuditIp, {
                                ip: entry.ip_address,
                              })}`
                            : ""}
                        </Typography.Text>
                      }
                    />
                    {entry.event_type.includes("suspicious") && (
                      <Tag color="warning" data-testid="admin-audit-suspicious">
                        {t(AUTH_I18N_KEYS.secAuditSuspiciousLabel)}
                      </Tag>
                    )}
                  </List.Item>
                )}
                loadMore={
                  nextPage != null && (
                    <Typography.Link
                      onClick={() => setPage(nextPage)}
                      data-analytics="none"
                      data-analytics-reason="local-ui-load-more-admin-audit-page"
                    >
                      {t(AUTH_I18N_KEYS.secAuditLoadMore)}
                    </Typography.Link>
                  )
                }
              />
            ),
          })}
        </Flex>
      </Card>
    </AdminScreen>
  );
}
