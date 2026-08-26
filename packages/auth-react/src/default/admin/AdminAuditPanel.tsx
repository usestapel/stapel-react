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
 * Dates go through the design system's `DatePicker`, not a bare
 * `<input type="date">`. The native control paints the BROWSER's chrome and
 * the browser's format hint (`dd.mm.yyyy`) beside antd's own text inputs —
 * two control vocabularies in one filter row, and a hint contradicting the
 * `Aug 24, 2026` this same card prints as output (visual pass N10). The wire
 * format the query parameters take (`YYYY-MM-DD`) is produced on submit.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Skeleton,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { fontSize } from "@stapel/tokens";
import { isLoadReady, loadStateFromQuery, mapLoad, matchList, useT } from "@stapel/core";
import { EmptyState, ErrorAlert } from "@stapel/tokens-antd/skin";
import type { AdminAuditQuery } from "../../api/types.js";
import { useAdminAudit } from "../../model/queries.js";
import { useAuthDateFormat } from "../../model/formatDate.js";
import { AUTH_I18N_KEYS } from "../../i18n/keys.js";
import { AdminScreen } from "./AdminScreen.js";
import { ForbiddenState, isForbidden } from "./forbidden.js";
import { SecurityList, SecurityListRow } from "../security/SecurityListRow.js";

/**
 * The form's DRAFT values. The two date fields hold whatever `DatePicker`
 * binds (a dayjs instance) — typed structurally, so the pair reads the one
 * method it needs without taking a dependency on antd's date library.
 */
interface DateValue {
  format(pattern: string): string;
}

interface FilterFormValues {
  readonly event_type?: string;
  readonly user_id?: string;
  readonly date_from?: DateValue | null;
  readonly date_to?: DateValue | null;
}

/** The wire form of a filter value: `YYYY-MM-DD` for a date, trimmed text
 *  otherwise, and `""` for anything the query has no business carrying. */
function wireValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  const candidate = value as Partial<DateValue>;
  return typeof candidate.format === "function"
    ? candidate.format("YYYY-MM-DD")
    : "";
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
    const wire = wireValue(value);
    if (wire !== "") query[key] = wire;
  }
  return query as AdminAuditQuery;
}

/** The global audit stream with committed filters and page-at-a-time reads. */
export function AdminAuditPanel(): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const when = useAuthDateFormat();
  const [applied, setApplied] = useState<FilterFormValues>({});
  const [page, setPage] = useState(1);
  const [form] = Form.useForm<FilterFormValues>();

  const audit = useAdminAudit(toQuery(applied, page));
  const pageState = loadStateFromQuery(audit);
  const entries = mapLoad(pageState, (p) => p.results ?? []);
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
                style={{ minWidth: "10rem", flex: "1 1 10rem", marginBottom: 0 }}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="date_to"
                label={t(AUTH_I18N_KEYS.adminAuditFilterTo)}
                style={{ minWidth: "10rem", flex: "1 1 10rem", marginBottom: 0 }}
              >
                <DatePicker style={{ width: "100%" }} />
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
            failed: (error) =>
              isForbidden(error) ? (
                <ForbiddenState testId="admin-audit-forbidden" />
              ) : (
                <ErrorAlert thrown={error} onRetry={() => void audit.refetch()} />
              ),
            empty: () => (
              <EmptyState
                title={t(AUTH_I18N_KEYS.adminAuditEmpty)}
                hint={t(AUTH_I18N_KEYS.adminAuditEmptyHint)}
              />
            ),
            ready: (results) => (
              <Flex vertical gap="middle" style={{ width: "100%" }}>
                <SecurityList
                  ruleColor={token.colorBorderSecondary}
                  data-testid="admin-audit-list"
                >
                  {results.map((entry) => (
                    <SecurityListRow
                      key={entry.id}
                      data-testid="admin-audit-row"
                      title={humanizeEventType(entry.event_type)}
                      {...(entry.event_type.includes("suspicious")
                        ? {
                            badges: (
                              <Tag color="warning" data-testid="admin-audit-suspicious">
                                {t(AUTH_I18N_KEYS.secAuditSuspiciousLabel)}
                              </Tag>
                            ),
                          }
                        : {})}
                      meta={
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
                  ))}
                </SecurityList>
                {nextPage != null && (
                  <Typography.Link
                    onClick={() => setPage(nextPage)}
                    data-analytics="none"
                    data-analytics-reason="local-ui-load-more-admin-audit-page"
                  >
                    {t(AUTH_I18N_KEYS.secAuditLoadMore)}
                  </Typography.Link>
                )}
              </Flex>
            ),
          })}
        </Flex>
      </Card>
    </AdminScreen>
  );
}
