/**
 * `<SecretRotation>` — rotate one subscription's signing secret.
 *
 * Three states, and each of them is a sentence rather than a shape:
 *
 *  1. **Not offered.** A `ws`, `notification` or `custom` subscription carries
 *     no signature, so there is no secret to rotate and the backend answers
 *     400 `webhooks_not_signed_type`. The control is GATED with that as its
 *     stated reason, beside it — not hidden (a control that vanishes teaches
 *     nothing) and not offered-then-refused.
 *  2. **Confirm.** There is **no overlap window**: the old secret dies the
 *     instant the new one is issued, so every delivery fails until the
 *     receiver is updated, and enough failures switch the subscription off.
 *     That is what the confirm says — in full, as the body — because "are you
 *     sure?" over an irreversible break in a live integration is not a
 *     question anybody can answer.
 *  3. **Shown once.** The new secret goes to `<SecretReveal>` in a dialog whose
 *     only exit is the acknowledgement, and is dropped from memory after.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import {
  ErrorAlert,
  GatedButton,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useSecretRotation } from "../model/subscriptions.js";
import { SecretReveal } from "./SecretReveal.js";
import type { ThemeModeProp } from "./types.js";

export interface SecretRotationProps extends ThemeModeProp {
  /** The rule whose secret is rotated. */
  readonly subscriptionId: string;
  /** Its delivery type — decides whether rotation exists at all. */
  readonly deliveryType: string;
  /** `has_secret` off the presenter, for the one-line state above the button. */
  readonly hasSecret?: boolean;
  /** The host's "how to verify the signature" page, passed to the reveal. */
  readonly docsHref?: string;
  readonly testId?: string;
}

export function SecretRotation(props: SecretRotationProps): ReactElement {
  const t = useT();
  const rotation = useSecretRotation(props.subscriptionId, props.deliveryType);
  const testId = props.testId ?? "webhooks-rotate";

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
    >
      <Flex vertical gap={spacing[2]} data-testid={testId}>
        {props.hasSecret !== undefined ? (
          <Typography.Text type="secondary">
            {t(
              props.hasSecret
                ? WEBHOOKS_I18N_KEYS.secretPresent
                : WEBHOOKS_I18N_KEYS.secretAbsent
            )}
          </Typography.Text>
        ) : null}

        <GatedButton
          gate={rotation.rotate}
          danger
          testId={`${testId}-button`}
          data-analytics="none"
          data-analytics-reason="opens the confirm; the rotation itself is tracked on success"
          onClick={rotation.ask}
        >
          {t(WEBHOOKS_I18N_KEYS.secretRotate)}
        </GatedButton>

        <ErrorAlert
          testId={`${testId}-failed`}
          thrown={rotation.error}
          variant="inline"
        />

        <SkinConfirm
          open={rotation.confirming}
          danger
          title={t(WEBHOOKS_I18N_KEYS.secretRotateConfirm)}
          body={t(WEBHOOKS_I18N_KEYS.secretRotateConfirmBody)}
          confirmLabel={t(WEBHOOKS_I18N_KEYS.secretRotate)}
          confirming={rotation.isPending}
          onConfirm={rotation.run}
          onCancel={rotation.cancel}
          data-testid={`${testId}-confirm`}
        />

        <SkinDialog
          open={rotation.secret !== undefined}
          onClose={rotation.acknowledge}
          title={t(WEBHOOKS_I18N_KEYS.secretTitle)}
          dismissLabel={t(WEBHOOKS_I18N_KEYS.dialogDismiss)}
          // The body holds the only exit ON PURPOSE — see SecretReveal's doc.
          dismissible={false}
          data-testid={`${testId}-reveal`}
        >
          {rotation.secret !== undefined ? (
            <SecretReveal
              secret={rotation.secret}
              onAcknowledge={rotation.acknowledge}
              {...(props.docsHref !== undefined
                ? { docsHref: props.docsHref }
                : {})}
              testId={`${testId}-secret`}
            />
          ) : null}
        </SkinDialog>
      </Flex>
    </SkinTheme>
  );
}
