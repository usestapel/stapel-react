/**
 * `<DeliveriesPane>` — the delivery log of one webhook.
 *
 * ── The header note is load-bearing ───────────────────────────────────────
 *
 * "My delivery disappeared" and "my delivery was never recorded" look
 * identical on a log that does not state its retention. Successful rows are
 * swept after `SUCCEEDED_RETENTION_DAYS` and dead letters after
 * `DEAD_RETENTION_DAYS` — settings the HTTP surface does not serve
 * (BACKEND-GAP W-8), so the numbers come from the runtime (defaulted to
 * `conf.py`'s 7 and 90) and a deployment that changed them passes its own.
 *
 * ── Replay is gated, never hidden ─────────────────────────────────────────
 *
 * Only a `dead` row can be replayed; anything else is a 409. So every row has
 * the control and every non-dead row has the reason beside it, with the status
 * named. A log where the button appears and disappears per row teaches nobody
 * the rule.
 *
 * ── The poll is visible ───────────────────────────────────────────────────
 *
 * There is no stream. While anything is `pending`/`retrying` the log re-reads
 * every 15 s and says so in one quiet line — a screen that silently changed
 * under somebody's cursor would be worse than one that does not update at all.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Flex, Select, Table, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useBreakpoint, useI18n, useT } from "@stapel/core";
import type { Delivery, DeliveryStatus } from "../api/types.js";
import { DELIVERY_STATUSES } from "../api/types.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useDeliveries } from "../model/deliveries.js";
import { formatJson, formatOptionalInstant } from "../model/format.js";
import { isMandateUnavailable } from "../model/refusals.js";
import { useWebhooksRuntime } from "../model/context.js";
import { DeliveryDetailSheet } from "./DeliveryDetailSheet.js";
import { deliveryStatusColor, deliveryStatusKey } from "./labels.js";
import { CODE_BLOCK_STYLE } from "./layout.js";
import { MandateNotice } from "./MandateNotice.js";
import type { ThemeModeProp } from "./types.js";

export interface DeliveriesPaneProps extends ThemeModeProp {
  readonly subscriptionId: string;
  readonly testId?: string;
}

export function DeliveriesPane(props: DeliveriesPaneProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const runtime = useWebhooksRuntime();
  const breakpoint = useBreakpoint();
  const [status, setStatus] = useState<DeliveryStatus | undefined>(undefined);
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const bag = useDeliveries(props.subscriptionId, status);
  const testId = props.testId ?? "webhooks-log";
  const phone = breakpoint === "phone";

  const absent = t(WEBHOOKS_I18N_KEYS.never);

  const statusTag = (row: Delivery): ReactElement => (
    <Tag color={deliveryStatusColor(row.status)}>
      {t(deliveryStatusKey(row.status), { status: row.status })}
    </Tag>
  );

  const replayButton = (row: Delivery): ReactElement => (
    <GatedButton
      gate={bag.replayGate(row)}
      size="small"
      testId={`${testId}-replay-${row.id}`}
      loading={bag.replay.isPending && bag.replay.variables === row.id}
      data-analytics="none"
      data-analytics-reason="the replay event is emitted by the model layer on success"
      onClick={() => bag.replay.mutate(row.id)}
    >
      {t(WEBHOOKS_I18N_KEYS.logReplay)}
    </GatedButton>
  );

  const openButton = (row: Delivery): ReactElement => (
    <GatedButton
      gate={{ available: true }}
      size="small"
      type="link"
      testId={`${testId}-open-${row.id}`}
      data-analytics="none"
      data-analytics-reason="opens a read-only detail sheet"
      onClick={() => setOpenId(row.id)}
    >
      {t(WEBHOOKS_I18N_KEYS.logOpenDetail)}
    </GatedButton>
  );

  const columns = [
    {
      key: "status",
      title: t(WEBHOOKS_I18N_KEYS.logStatus),
      render: (_: unknown, row: Delivery): ReactElement => statusTag(row),
    },
    {
      key: "event",
      title: t(WEBHOOKS_I18N_KEYS.colEvent),
      render: (_: unknown, row: Delivery): string => row.event_type,
    },
    {
      key: "attempts",
      title: t(WEBHOOKS_I18N_KEYS.logAttempts),
      render: (_: unknown, row: Delivery): number => row.attempts,
    },
    {
      key: "response",
      title: t(WEBHOOKS_I18N_KEYS.logResponse),
      render: (_: unknown, row: Delivery): string =>
        row.response_status > 0 ? String(row.response_status) : absent,
    },
    {
      key: "last",
      title: t(WEBHOOKS_I18N_KEYS.logLast),
      render: (_: unknown, row: Delivery): string =>
        formatOptionalInstant(row.last_attempt_at, locale, absent),
    },
    {
      key: "next",
      title: t(WEBHOOKS_I18N_KEYS.logNext),
      render: (_: unknown, row: Delivery): string =>
        formatOptionalInstant(row.next_attempt_at, locale, absent),
    },
    {
      key: "actions",
      title: t(WEBHOOKS_I18N_KEYS.colActions),
      render: (_: unknown, row: Delivery): ReactElement => (
        <Flex gap={spacing[1]} wrap>
          {openButton(row)}
          {replayButton(row)}
        </Flex>
      ),
    },
  ];

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        size="small"
        title={t(WEBHOOKS_I18N_KEYS.logTitle)}
        data-testid={testId}
        extra={
          <Select
            size="small"
            allowClear
            value={status}
            placeholder={t(WEBHOOKS_I18N_KEYS.logStatusAll)}
            aria-label={t(WEBHOOKS_I18N_KEYS.logStatus)}
            data-testid={`${testId}-status-filter`}
            onChange={(next: DeliveryStatus | undefined) => setStatus(next)}
            options={DELIVERY_STATUSES.map((value) => ({
              value,
              label: t(deliveryStatusKey(value), { status: value }),
            }))}
          />
        }
      >
        <Flex vertical gap={spacing[3]}>
          <Typography.Text type="secondary" data-testid={`${testId}-retention`}>
            {t(WEBHOOKS_I18N_KEYS.logRetention, {
              succeededDays: runtime.retention.succeededDays,
              deadDays: runtime.retention.deadDays,
            })}
          </Typography.Text>

          {bag.polling ? (
            <Typography.Text type="secondary" data-testid={`${testId}-polling`}>
              {t(WEBHOOKS_I18N_KEYS.logPolling)}
            </Typography.Text>
          ) : null}

          <ErrorAlert
            testId={`${testId}-replay-failed`}
            thrown={bag.replay.error}
            variant="inline"
          />

          <LoadList
            state={bag.rows}
            testId={testId}
            skeletonRows={3}
            onRetry={bag.refetch}
            failed={(error) =>
              isMandateUnavailable(error) ? (
                <MandateNotice testId={`${testId}-mandate`} onRetry={bag.refetch} />
              ) : (
                <ErrorAlert
                  testId={`${testId}-failed`}
                  thrown={error}
                  onRetry={bag.refetch}
                />
              )
            }
            empty={
              <EmptyState
                testId={`${testId}-empty`}
                title={t(WEBHOOKS_I18N_KEYS.logEmpty)}
                hint={t(WEBHOOKS_I18N_KEYS.logEmptyHint)}
              />
            }
          >
            {(rows) =>
              phone ? (
                <Flex vertical gap={spacing[3]} data-testid={`${testId}-cards`}>
                  {rows.map((row) => (
                    <Card key={row.id} size="small" title={statusTag(row)}>
                      <Flex vertical gap={spacing[2]}>
                        <Typography.Text>{row.event_type}</Typography.Text>
                        <Typography.Text type="secondary">
                          {t(WEBHOOKS_I18N_KEYS.logAttempts)}
                          {": "}
                          {row.attempts}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          {t(WEBHOOKS_I18N_KEYS.logLast)}
                          {": "}
                          {formatOptionalInstant(
                            row.last_attempt_at,
                            locale,
                            absent
                          )}
                        </Typography.Text>
                        {row.last_error.length > 0 ? (
                          <Typography.Text type="danger" ellipsis>
                            {row.last_error}
                          </Typography.Text>
                        ) : null}
                        <Flex gap={spacing[2]} wrap>
                          {openButton(row)}
                          {replayButton(row)}
                        </Flex>
                      </Flex>
                    </Card>
                  ))}
                </Flex>
              ) : (
                <Table
                  size="small"
                  data-testid={`${testId}-rows`}
                  rowKey={(row: Delivery) => row.id}
                  dataSource={[...rows]}
                  columns={columns}
                  pagination={false}
                  scroll={{ x: true }}
                  expandable={{
                    expandedRowRender: (row: Delivery) => (
                      <Flex vertical gap={spacing[1]}>
                        <Typography.Text strong>
                          {t(WEBHOOKS_I18N_KEYS.logPayload)}
                        </Typography.Text>
                        <pre
                          style={CODE_BLOCK_STYLE}
                          data-testid={`${testId}-payload-${row.id}`}
                        >
                          {formatJson(row.payload)}
                        </pre>
                        {row.last_error.length > 0 ? (
                          <Typography.Text type="danger">
                            {row.last_error}
                          </Typography.Text>
                        ) : null}
                      </Flex>
                    ),
                  }}
                />
              )
            }
          </LoadList>
        </Flex>
      </Card>

      <DeliveryDetailSheet
        open={openId !== undefined}
        onClose={() => setOpenId(undefined)}
        subscriptionId={props.subscriptionId}
        {...(openId !== undefined ? { deliveryId: openId } : {})}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        testId={`${testId}-detail`}
      />
    </SkinTheme>
  );
}
