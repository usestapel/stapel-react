/**
 * `<SubscriptionsPane>` — the list of reaction rules, and everything a person
 * can do to one.
 *
 * A table on a desktop and cards on a phone: the same rows, drawn the way each
 * width can actually read them. A settings table squeezed to 390px is a
 * horizontal scrollbar over the one screen someone opens on their phone to
 * turn a broken integration off.
 *
 * ── The three columns that are not decoration ─────────────────────────────
 *
 *  - **Active** is a switch with an `aria-label`, and re-activating a rule
 *    RESETS its strike counter server-side (`services.py`). The copy says so,
 *    because "turn it back on and it gets one more attempt" and "turn it back
 *    on and it gets the full ladder again" are different promises.
 *  - **Failures** is `consecutive_failures`, and a rule with a `disabled_at`
 *    is one the backend switched off — not one a person did. The threshold is
 *    a setting the API does not serve (BACKEND-GAP W-7), so the copy says
 *    "after repeated failures" instead of inventing a number.
 *  - **Destination** is a SUMMARY (the host of a webhook URL, the recipient of
 *    a notification), because the full target is unreadable at list width and
 *    one row-open away in the sheet.
 *
 * ── Delete is a named, bodied confirm ─────────────────────────────────────
 *
 * The delete CASCADES the delivery log — including dead letters nobody has
 * replayed yet. That is the sentence in the confirm's body; a bare "are you
 * sure?" would hide the only consequence that is not obvious.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Card, Flex, Switch, Table, Tag, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  LoadList,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { actionAvailable, useBreakpoint, useI18n, useT } from "@stapel/core";
import type { Subscription } from "../api/types.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useSubscriptions } from "../model/subscriptions.js";
import { useWebhooksRuntime } from "../model/context.js";
import { formatDate, formatOptionalInstant, targetSummary } from "../model/format.js";
import { isMandateUnavailable } from "../model/refusals.js";
import { DeliveriesPane } from "./DeliveriesPane.js";
import { MandateNotice } from "./MandateNotice.js";
import { SecretRotation } from "./SecretRotation.js";
import { SubscriptionSheet } from "./SubscriptionSheet.js";
import { deliveryLabelKey } from "./labels.js";
import type { ThemeModeProp } from "./types.js";

export interface SubscriptionsPaneProps extends ThemeModeProp {
  readonly testId?: string;
}

/** What the pane currently has open, as one value rather than four booleans. */
type Sheet =
  | { readonly kind: "none" }
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly row: Subscription }
  | { readonly kind: "log"; readonly row: Subscription };

export function SubscriptionsPane(props: SubscriptionsPaneProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const runtime = useWebhooksRuntime();
  const breakpoint = useBreakpoint();
  const bag = useSubscriptions();
  const [sheet, setSheet] = useState<Sheet>({ kind: "none" });
  const [removingId, setRemovingId] = useState<string | undefined>(undefined);
  const testId = props.testId ?? "webhooks-subscriptions";
  const phone = breakpoint === "phone";
  const absent = t(WEBHOOKS_I18N_KEYS.never);

  const activeSwitch = (row: Subscription): ReactElement => (
    <Flex vertical gap={spacing[1]} align="flex-start">
      <Switch
        size="small"
        checked={row.is_active}
        loading={bag.toggleActive.isPending && bag.toggleActive.variables?.id === row.id}
        aria-label={t(WEBHOOKS_I18N_KEYS.activeLabel)}
        data-testid={`${testId}-active-${row.id}`}
        data-analytics="none"
        data-analytics-reason="the toggled event is emitted by the model layer on success"
        onChange={(checked) =>
          bag.toggleActive.mutate({ id: row.id, isActive: checked })
        }
      />
      <Typography.Text type="secondary">
        {t(row.is_active ? WEBHOOKS_I18N_KEYS.activeOn : WEBHOOKS_I18N_KEYS.activeOff)}
      </Typography.Text>
      {!row.is_active ? (
        <Typography.Text type="secondary">
          {t(WEBHOOKS_I18N_KEYS.activeReactivatedNote)}
        </Typography.Text>
      ) : null}
    </Flex>
  );

  const strikes = (row: Subscription): ReactElement => (
    <Flex vertical gap={spacing[1]} align="flex-start">
      {row.consecutive_failures > 0 ? (
        <Tag color="warning">
          {t(WEBHOOKS_I18N_KEYS.strikes, { count: row.consecutive_failures })}
        </Tag>
      ) : null}
      {row.disabled_at != null ? (
        <>
          <Typography.Text type="danger" data-testid={`${testId}-auto-${row.id}`}>
            {t(WEBHOOKS_I18N_KEYS.autoDisabled)}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t(WEBHOOKS_I18N_KEYS.disabledAt, {
              date: formatDate(row.disabled_at, locale),
            })}
          </Typography.Text>
        </>
      ) : null}
    </Flex>
  );

  const rowActions = (row: Subscription): ReactElement => (
    <Flex gap={spacing[1]} wrap>
      <GatedButton
        gate={actionAvailable()}
        size="small"
        testId={`${testId}-edit-${row.id}`}
        data-analytics="none"
        data-analytics-reason="opens the edit sheet"
        onClick={() => setSheet({ kind: "edit", row })}
      >
        {t(WEBHOOKS_I18N_KEYS.edit)}
      </GatedButton>
      <GatedButton
        gate={actionAvailable()}
        size="small"
        testId={`${testId}-log-${row.id}`}
        data-analytics="none"
        data-analytics-reason="opens a read-only delivery log"
        onClick={() => setSheet({ kind: "log", row })}
      >
        {t(WEBHOOKS_I18N_KEYS.openLog)}
      </GatedButton>
      <GatedButton
        gate={actionAvailable()}
        size="small"
        danger
        testId={`${testId}-remove-${row.id}`}
        data-analytics="none"
        data-analytics-reason="opens the delete confirm"
        onClick={() => setRemovingId(row.id)}
      >
        {t(WEBHOOKS_I18N_KEYS.remove)}
      </GatedButton>
    </Flex>
  );

  const columns = [
    {
      key: "event",
      title: t(WEBHOOKS_I18N_KEYS.colEvent),
      render: (_: unknown, row: Subscription): ReactElement => (
        <Flex vertical>
          <Typography.Text>{row.event_type}</Typography.Text>
          {row.description.length > 0 ? (
            <Typography.Text type="secondary">{row.description}</Typography.Text>
          ) : null}
        </Flex>
      ),
    },
    {
      key: "delivery",
      title: t(WEBHOOKS_I18N_KEYS.colDelivery),
      render: (_: unknown, row: Subscription): ReactElement => (
        <Tag>{t(deliveryLabelKey(row.delivery), { delivery: row.delivery })}</Tag>
      ),
    },
    {
      key: "target",
      title: t(WEBHOOKS_I18N_KEYS.colTarget),
      render: (_: unknown, row: Subscription): string =>
        targetSummary(row.delivery, row.target),
    },
    {
      key: "active",
      title: t(WEBHOOKS_I18N_KEYS.colActive),
      render: (_: unknown, row: Subscription): ReactElement => activeSwitch(row),
    },
    {
      key: "strikes",
      title: t(WEBHOOKS_I18N_KEYS.colStrikes),
      render: (_: unknown, row: Subscription): ReactElement => strikes(row),
    },
    {
      key: "last",
      title: t(WEBHOOKS_I18N_KEYS.colLastDelivery),
      render: (_: unknown, row: Subscription): string =>
        formatOptionalInstant(row.last_delivery_at, locale, absent),
    },
    {
      key: "actions",
      title: t(WEBHOOKS_I18N_KEYS.colActions),
      render: (_: unknown, row: Subscription): ReactElement => rowActions(row),
    },
  ];

  const newButton = (
    <GatedButton
      gate={actionAvailable()}
      type="primary"
      testId={`${testId}-new`}
      data-analytics="none"
      data-analytics-reason="opens the create sheet; the created event fires on success"
      onClick={() => setSheet({ kind: "create" })}
    >
      {t(WEBHOOKS_I18N_KEYS.newSubscription)}
    </GatedButton>
  );

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card
        size="small"
        title={t(WEBHOOKS_I18N_KEYS.title)}
        extra={newButton}
        data-testid={testId}
      >
        <Flex vertical gap={spacing[3]}>
          <ErrorAlert
            testId={`${testId}-write-failed`}
            thrown={bag.create.error ?? bag.toggleActive.error ?? bag.remove.error}
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
                title={t(WEBHOOKS_I18N_KEYS.empty)}
                hint={t(WEBHOOKS_I18N_KEYS.emptyHint)}
                action={newButton}
              />
            }
          >
            {(rows) =>
              phone ? (
                <Flex vertical gap={spacing[3]} data-testid={`${testId}-cards`}>
                  {rows.map((row) => (
                    <Card
                      key={row.id}
                      size="small"
                      title={row.event_type}
                      data-testid={`${testId}-card-${row.id}`}
                    >
                      <Flex vertical gap={spacing[2]}>
                        <Tag>
                          {t(deliveryLabelKey(row.delivery), {
                            delivery: row.delivery,
                          })}
                        </Tag>
                        <Typography.Text>
                          {targetSummary(row.delivery, row.target)}
                        </Typography.Text>
                        {activeSwitch(row)}
                        {strikes(row)}
                        <Typography.Text type="secondary">
                          {t(WEBHOOKS_I18N_KEYS.colLastDelivery)}
                          {": "}
                          {formatOptionalInstant(row.last_delivery_at, locale, absent)}
                        </Typography.Text>
                        <SecretRotation
                          subscriptionId={row.id}
                          deliveryType={row.delivery}
                          hasSecret={row.has_secret}
                          {...(runtime.docsHref !== undefined
                            ? { docsHref: runtime.docsHref }
                            : {})}
                          testId={`${testId}-rotate-${row.id}`}
                        />
                        {rowActions(row)}
                      </Flex>
                    </Card>
                  ))}
                </Flex>
              ) : (
                <Table
                  size="small"
                  data-testid={`${testId}-rows`}
                  rowKey={(row: Subscription) => row.id}
                  dataSource={[...rows]}
                  columns={columns}
                  pagination={false}
                  scroll={{ x: true }}
                  expandable={{
                    expandedRowRender: (row: Subscription) => (
                      <SecretRotation
                        subscriptionId={row.id}
                        deliveryType={row.delivery}
                        hasSecret={row.has_secret}
                        {...(runtime.docsHref !== undefined
                          ? { docsHref: runtime.docsHref }
                          : {})}
                        testId={`${testId}-rotate-${row.id}`}
                      />
                    ),
                  }}
                />
              )
            }
          </LoadList>
        </Flex>
      </Card>

      {/* One confirm for the whole list, keyed by the pending id. */}
      <SkinConfirm
        open={removingId !== undefined}
        danger
        title={t(WEBHOOKS_I18N_KEYS.removeConfirm)}
        body={t(WEBHOOKS_I18N_KEYS.removeConfirmBody)}
        confirmLabel={t(WEBHOOKS_I18N_KEYS.remove)}
        confirming={bag.remove.isPending}
        onConfirm={() => {
          if (removingId !== undefined) {
            bag.remove.mutate(removingId, {
              onSettled: () => setRemovingId(undefined),
            });
          }
        }}
        onCancel={() => setRemovingId(undefined)}
        data-testid={`${testId}-remove-confirm`}
      />

      <SubscriptionSheet
        open={sheet.kind === "create" || sheet.kind === "edit"}
        onClose={() => setSheet({ kind: "none" })}
        {...(sheet.kind === "edit" ? { subscription: sheet.row } : {})}
        {...(runtime.docsHref !== undefined ? { docsHref: runtime.docsHref } : {})}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        testId={`${testId}-sheet`}
      />

      <SkinDialog
        open={sheet.kind === "log"}
        onClose={() => setSheet({ kind: "none" })}
        title={t(WEBHOOKS_I18N_KEYS.logTitle)}
        dismissLabel={t(WEBHOOKS_I18N_KEYS.dialogDismiss)}
        data-testid={`${testId}-log-dialog`}
      >
        {sheet.kind === "log" ? (
          <DeliveriesPane
            subscriptionId={sheet.row.id}
            {...(props.mode !== undefined ? { mode: props.mode } : {})}
            testId={`${testId}-log-pane`}
          />
        ) : null}
      </SkinDialog>
    </SkinTheme>
  );
}
