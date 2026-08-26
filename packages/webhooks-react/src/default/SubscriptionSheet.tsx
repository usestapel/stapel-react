/**
 * `<SubscriptionSheet>` — write or edit one reaction rule.
 *
 * A bottom sheet on a phone and a modal above 768px, because it is the same
 * dialog either way and `SkinDialog` owns that rule for the whole fleet.
 *
 * ── The picker reads the deployment, it does not ship a list ──────────────
 *
 * Events come from `GET event-catalog`, grouped by the module that emits them
 * and annotated with the payload keys a filter can name. A hardcoded list here
 * would offer events nothing emits (a rule that silently never fires) and hide
 * the ones a host's own modules add.
 *
 * ── Every refusal that can be answered here is answered here ──────────────
 *
 * A missing target key, an `http://` webhook URL and a malformed predicate are
 * all decidable in the browser, and the backend's answers for them are single
 * codes with no position in them. So the form validates first
 * (`useSubscriptionForm`), the submit is an `ActionAvailability` whose reason
 * renders beside the button, and the sheet only shows a server refusal for the
 * two things a client cannot know: the per-owner cap and a delivery type this
 * deployment removed at runtime.
 *
 * ── The secret appears here and only here ────────────────────────────────
 *
 * A create answers 201 `{id, secret}` and no read ever returns the secret
 * again. So on success the sheet does NOT close: it replaces its body with
 * `<SecretReveal>`, whose acknowledgement is the only exit.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Input, Segmented, Select, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { actionBlocked, useT } from "@stapel/core";
import type { Subscription } from "../api/types.js";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useEventCatalog } from "../model/catalog.js";
import type { CatalogGroup } from "../model/catalog.js";
import { deliveryTypeSpec } from "../model/deliveryTypes.js";
import {
  useCreateSubscription,
  useUpdateSubscription,
} from "../model/subscriptions.js";
import { useSubscriptionForm } from "../model/subscriptionForm.js";
import { SecretReveal } from "./SecretReveal.js";
import { deliveryLabelKey, targetFieldLabelKey } from "./labels.js";
import { DIALOG_ACTION_BAR_STYLE } from "./layout.js";
import type { ThemeModeProp } from "./types.js";

export interface SubscriptionSheetProps extends ThemeModeProp {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Present = edit that rule; absent = create a new one. */
  readonly subscription?: Subscription;
  /** The host's "how to verify the signature" page, shown with the secret. */
  readonly docsHref?: string;
  readonly testId?: string;
}

export function SubscriptionSheet(props: SubscriptionSheetProps): ReactElement {
  const t = useT();
  const catalog = useEventCatalog({ enabled: props.open });
  const form = useSubscriptionForm(props.subscription);
  const create = useCreateSubscription();
  const update = useUpdateSubscription();
  const [secret, setSecret] = useState<string | undefined>(undefined);
  const testId = props.testId ?? "webhooks-sheet";

  const editing = props.subscription !== undefined;
  const spec = deliveryTypeSpec(form.fields.delivery);
  const chosen = catalog.eventByName(form.fields.eventType);

  const close = (): void => {
    setSecret(undefined);
    form.reset();
    props.onClose();
  };

  const submit = (): void => {
    if (editing && props.subscription !== undefined) {
      update.mutate(
        { id: props.subscription.id, patch: form.patch },
        { onSuccess: () => props.onClose() }
      );
      return;
    }
    if (form.body === undefined) return;
    create.mutate(form.body, {
      onSuccess: (result) => setSecret(result.secret),
    });
  };

  // An edit whose patch is empty would PATCH the values already on the row —
  // a write in the audit trail that wrote nothing. Blocked, with that as the
  // reason beside the button rather than a greyed control.
  const saveGate =
    editing && Object.keys(form.patch).length === 0
      ? actionBlocked(WEBHOOKS_I18N_KEYS.formNoChanges)
      : form.submit;

  return (
    <SkinDialog
      open={props.open}
      onClose={close}
      title={t(
        editing ? WEBHOOKS_I18N_KEYS.formEditTitle : WEBHOOKS_I18N_KEYS.formTitle
      )}
      dismissLabel={t(WEBHOOKS_I18N_KEYS.dialogDismiss)}
      // A half-filled rule that closed and reopened with yesterday's target is
      // worse than an empty form; the dialog throws its body away by default.
      dismissible={secret === undefined}
      data-testid={testId}
    >
      <SkinTheme
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
        surface="bare"
      >
        {secret !== undefined ? (
          <SecretReveal
            secret={secret}
            onAcknowledge={close}
            {...(props.docsHref !== undefined
              ? { docsHref: props.docsHref }
              : {})}
            testId={`${testId}-secret`}
          />
        ) : (
          <Flex vertical gap={spacing[4]} data-testid={`${testId}-form`}>
            {/* event */}
            <Flex vertical gap={spacing[1]}>
              <Typography.Text strong>
                {t(WEBHOOKS_I18N_KEYS.formEvent)}
              </Typography.Text>
              <LoadBoundary
                state={catalog.groups}
                testId={`${testId}-catalog`}
                skeletonRows={2}
                onRetry={catalog.refetch}
              >
                {(groups: readonly CatalogGroup[]) => (
                  <Select
                    showSearch
                    // `null`, not `undefined`: antd's Select types the
                    // "nothing chosen" value as `string | null`, and under
                    // exactOptionalPropertyTypes the two are not the same.
                    value={
                      form.fields.eventType.length > 0
                        ? form.fields.eventType
                        : null
                    }
                    placeholder={t(WEBHOOKS_I18N_KEYS.formEventPlaceholder)}
                    aria-label={t(WEBHOOKS_I18N_KEYS.formEvent)}
                    data-testid={`${testId}-event`}
                    onChange={form.setEventType}
                    options={groups.map((group) => ({
                      label: group.module,
                      options: group.events.map((event) => ({
                        value: event.event,
                        label: event.event,
                      })),
                    }))}
                  />
                )}
              </LoadBoundary>
              <Typography.Text type="secondary">
                {t(WEBHOOKS_I18N_KEYS.formEventHint)}
              </Typography.Text>
              {chosen !== undefined ? (
                <Typography.Text
                  type="secondary"
                  data-testid={`${testId}-event-description`}
                >
                  {chosen.description}
                </Typography.Text>
              ) : null}
            </Flex>

            {/* delivery */}
            <Flex vertical gap={spacing[1]}>
              <Typography.Text strong>
                {t(WEBHOOKS_I18N_KEYS.formDelivery)}
              </Typography.Text>
              {/* A `Segmented` measures its widest possible row and refuses
                  to shrink below it, so at 390px this control was wider than
                  the sheet and its last option was sliced by the edge. It
                  scrolls inside its own box instead. */}
              <div style={{ maxWidth: "100%", overflowX: "auto" }}>
                <Segmented
                  value={form.fields.delivery}
                  data-testid={`${testId}-delivery`}
                  onChange={(value) => form.setDelivery(String(value))}
                  options={catalog.deliveryTypes.map((name) => ({
                    value: name,
                    label: t(deliveryLabelKey(name), { delivery: name }),
                  }))}
                />
              </div>
            </Flex>

            {/* target */}
            <Flex vertical gap={spacing[2]}>
              <Typography.Text strong>
                {t(WEBHOOKS_I18N_KEYS.formTarget)}
              </Typography.Text>
              {spec === undefined ? (
                <Typography.Text type="secondary">
                  {t(WEBHOOKS_I18N_KEYS.formUnknownDeliveryTarget)}
                </Typography.Text>
              ) : null}
              {form.targetKeys.map((key) => (
                <Flex vertical gap={spacing[1]} key={key}>
                  <Input
                    value={String(form.fields.target[key] ?? "")}
                    aria-label={t(targetFieldLabelKey(key), { field: key })}
                    placeholder={t(targetFieldLabelKey(key), { field: key })}
                    data-testid={`${testId}-target-${key}`}
                    onChange={(event) =>
                      form.setTargetField(key, event.target.value)
                    }
                  />
                  {key === "url" ? (
                    <Typography.Text type="secondary">
                      {t(WEBHOOKS_I18N_KEYS.formUrlHint)}
                    </Typography.Text>
                  ) : null}
                </Flex>
              ))}
            </Flex>

            {/* filter */}
            <Flex vertical gap={spacing[1]}>
              <Typography.Text strong>
                {t(WEBHOOKS_I18N_KEYS.formFilter)}
              </Typography.Text>
              <Input.TextArea
                rows={3}
                value={form.fields.filterText}
                aria-label={t(WEBHOOKS_I18N_KEYS.formFilter)}
                data-testid={`${testId}-filter`}
                onChange={(event) => form.setFilterText(event.target.value)}
              />
              <Typography.Text type="secondary">
                {t(WEBHOOKS_I18N_KEYS.formFilterHint)}
              </Typography.Text>
              {form.filterProblem !== undefined ? (
                <Typography.Text type="danger" data-testid={`${testId}-filter-problem`}>
                  {t(form.filterProblem.code, form.filterProblem.params)}
                </Typography.Text>
              ) : form.fields.filterText.trim().length > 0 ? (
                <Typography.Text type="success" data-testid={`${testId}-filter-ok`}>
                  {t(WEBHOOKS_I18N_KEYS.filterValid)}
                </Typography.Text>
              ) : null}
              {chosen !== undefined && (chosen.properties ?? []).length > 0 ? (
                <Typography.Text
                  type="secondary"
                  data-testid={`${testId}-event-properties`}
                >
                  {(chosen.properties ?? []).join(" · ")}
                </Typography.Text>
              ) : null}
            </Flex>

            {/* description */}
            <Flex vertical gap={spacing[1]}>
              <Typography.Text strong>
                {t(WEBHOOKS_I18N_KEYS.formDescription)}
              </Typography.Text>
              <Input
                value={form.fields.description}
                aria-label={t(WEBHOOKS_I18N_KEYS.formDescription)}
                data-testid={`${testId}-description`}
                onChange={(event) => form.setDescription(event.target.value)}
              />
            </Flex>

            <div style={DIALOG_ACTION_BAR_STYLE}>
              <Flex vertical gap={spacing[2]}>
                <ErrorAlert
                  testId={`${testId}-failed`}
                  thrown={editing ? update.error : create.error}
                />

                <GatedButton
                  gate={saveGate}
                  type="primary"
                  block
                  loading={create.isPending || update.isPending}
                  testId={`${testId}-submit`}
                  data-analytics="none"
                  data-analytics-reason="the create/toggle events are emitted by the model layer on success"
                  onClick={submit}
                >
                  {t(
                    editing
                      ? WEBHOOKS_I18N_KEYS.formSave
                      : WEBHOOKS_I18N_KEYS.formSubmit
                  )}
                </GatedButton>
              </Flex>
            </div>
          </Flex>
        )}
      </SkinTheme>
    </SkinDialog>
  );
}
