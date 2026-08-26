/**
 * `<DeliveryDetailSheet>` — one delivery, in full.
 *
 * The screen somebody opens when a webhook "did not arrive". It answers three
 * questions in the order they get asked: what did you send, what did you send
 * it with, and what came back.
 *
 * ── Rebuilt, and labelled as rebuilt ──────────────────────────────────────
 *
 * The module stores the matched `payload` and the identifiers; `transport.py`
 * assembles the envelope and the headers at SEND time from exactly those
 * fields. So this sheet reconstructs both rather than replaying a recording,
 * and says so above them — a debugging screen that implied it was showing the
 * bytes on the wire would send somebody hunting for a difference that is an
 * artefact of the reconstruction.
 *
 * The signature line is deliberately absent: it is an HMAC over the body with
 * a secret this client does not have, and a fabricated one here would be the
 * single most misleading row on the page.
 *
 * ── Replay lives here too ─────────────────────────────────────────────────
 *
 * Because this is where a person concludes "yes, that one" — and because the
 * gate is the same one the log uses, so the reason for a non-`dead` row is the
 * same sentence in both places.
 */
import type { ReactElement } from "react";
import { Collapse, Descriptions, Flex, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useI18n, useT } from "@stapel/core";
import type { Delivery } from "../api/types.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useDeliveries, useDelivery } from "../model/deliveries.js";
import {
  deliveryEnvelope,
  deliveryHeaders,
  formatJson,
  formatOptionalInstant,
} from "../model/format.js";
import { deliveryStatusColor, deliveryStatusKey } from "./labels.js";
import { CODE_BLOCK_STYLE, DIALOG_ACTION_BAR_STYLE } from "./layout.js";
import type { ThemeModeProp } from "./types.js";

export interface DeliveryDetailSheetProps extends ThemeModeProp {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The subscription the delivery belongs to — the replay mutation's scope. */
  readonly subscriptionId: string;
  /** `undefined` while nothing is selected; the read is skipped then. */
  readonly deliveryId?: string;
  readonly testId?: string;
}

export function DeliveryDetailSheet(
  props: DeliveryDetailSheetProps
): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const detail = useDelivery(props.deliveryId, { enabled: props.open });
  const log = useDeliveries(props.subscriptionId, undefined, { enabled: false });
  const testId = props.testId ?? "webhooks-delivery";

  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(WEBHOOKS_I18N_KEYS.detailTitle)}
      dismissLabel={t(WEBHOOKS_I18N_KEYS.dialogDismiss)}
      data-testid={testId}
    >
      <SkinTheme
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        surface="bare"
      >
        <LoadBoundary
          state={detail.state}
          testId={testId}
          skeletonRows={4}
          onRetry={detail.refetch}
        >
          {(row: Delivery) => (
            <Flex vertical gap={spacing[4]}>
              <Descriptions
                size="small"
                column={1}
                data-testid={`${testId}-summary`}
                items={[
                  {
                    key: "status",
                    label: t(WEBHOOKS_I18N_KEYS.logStatus),
                    children: (
                      <Tag color={deliveryStatusColor(row.status)}>
                        {t(deliveryStatusKey(row.status), { status: row.status })}
                      </Tag>
                    ),
                  },
                  {
                    key: "attempts",
                    label: t(WEBHOOKS_I18N_KEYS.logAttempts),
                    children: row.attempts,
                  },
                  {
                    key: "response",
                    label: t(WEBHOOKS_I18N_KEYS.detailResponse),
                    children:
                      row.response_status > 0
                        ? row.response_status
                        : t(WEBHOOKS_I18N_KEYS.detailNoResponse),
                  },
                  {
                    key: "last",
                    label: t(WEBHOOKS_I18N_KEYS.logLast),
                    children: formatOptionalInstant(
                      row.last_attempt_at,
                      locale,
                      t(WEBHOOKS_I18N_KEYS.never)
                    ),
                  },
                  {
                    key: "next",
                    label: t(WEBHOOKS_I18N_KEYS.logNext),
                    children: formatOptionalInstant(
                      row.next_attempt_at,
                      locale,
                      t(WEBHOOKS_I18N_KEYS.never)
                    ),
                  },
                ]}
              />

              {row.last_error.length > 0 ? (
                <Flex vertical gap={spacing[1]}>
                  <Typography.Text strong>
                    {t(WEBHOOKS_I18N_KEYS.detailLastError)}
                  </Typography.Text>
                  <Typography.Text type="danger" data-testid={`${testId}-error`}>
                    {row.last_error}
                  </Typography.Text>
                </Flex>
              ) : null}

              <Typography.Text type="secondary">
                {t(WEBHOOKS_I18N_KEYS.detailReconstructed)}
              </Typography.Text>

              {/* Two JSON blocks are the tallest thing on this card and the
                  least of what a person opens it for — folded away, the
                  status, the error and Replay all fit a phone sheet at once.
                  They are still one press away, and the press is labelled. */}
              <Collapse
                size="small"
                data-testid={`${testId}-wire`}
                items={[
                  {
                    key: "headers",
                    label: t(WEBHOOKS_I18N_KEYS.detailHeaders),
                    children: (
                      <pre
                        style={CODE_BLOCK_STYLE}
                        data-testid={`${testId}-headers`}
                      >
                        {deliveryHeaders(row)
                          .map(([name, value]) => `${name}: ${value}`)
                          .join("\n")}
                      </pre>
                    ),
                  },
                  {
                    key: "envelope",
                    label: t(WEBHOOKS_I18N_KEYS.detailEnvelope),
                    children: (
                      <pre
                        style={CODE_BLOCK_STYLE}
                        data-testid={`${testId}-envelope`}
                      >
                        {formatJson(deliveryEnvelope(row))}
                      </pre>
                    ),
                  },
                ]}
              />

              <div style={DIALOG_ACTION_BAR_STYLE}>
                <Flex vertical gap={spacing[2]}>
                  <ErrorAlert
                    testId={`${testId}-replay-failed`}
                    thrown={log.replay.error}
                    variant="inline"
                  />

                  <GatedButton
                    gate={log.replayGate(row)}
                    block
                    testId={`${testId}-replay`}
                    loading={log.replay.isPending}
                    data-analytics="none"
                    data-analytics-reason="the replay event is emitted by the model layer on success"
                    onClick={() => log.replay.mutate(row.id)}
                  >
                    {t(WEBHOOKS_I18N_KEYS.logReplay)}
                  </GatedButton>
                </Flex>
              </div>
            </Flex>
          )}
        </LoadBoundary>
      </SkinTheme>
    </SkinDialog>
  );
}
