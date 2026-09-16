import type { ReactElement, ReactNode } from "react";
import { Alert, Typography } from "antd";
import { SlotPlaceholder, useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { isKnownNeedsPaymentReason } from "../api/types.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { CreditIcon } from "./icons.js";
import { stackStyle } from "./layout.js";

const REASON_KEYS: Readonly<Record<string, string>> = {
  insufficient_credits: RECORDINGS_I18N_KEYS.needsPaymentReasonInsufficientCredits,
  free_minutes_exhausted: RECORDINGS_I18N_KEYS.needsPaymentReasonFreeMinutesExhausted,
};

/**
 * A recording's OWN park (`status === "needs_payment"`, stapel-recordings
 * 0.25.0) rendered as the specific sentence its `needs_payment_reason`
 * names — "top up to finish this recording" in place of the generic
 * "unknown state" chip a needs_payment recording rendered as before this
 * pin bump.
 *
 * Distinct from {@link PaymentRequiredNotice}: that answers a MUTATION's
 * `error.402.recording_payment_required` refusal, thrown before the action
 * does anything. This answers a RECORDING sitting in that state right now —
 * the pipeline already ran out of runway on it and parked, and a person's
 * top-up (not a retry button — `resume_after_payment` is server-triggered
 * when the payment lands) is what moves it next. Same visual treatment
 * (warning, the credit icon, the same top-up slot) so the two read as one
 * idea rather than two different screens about money.
 *
 * The reason vocabulary is not closed: {@link isKnownNeedsPaymentReason}
 * decides between a specific sentence and the generic fallback, so a code
 * this build has never seen still reads as a sentence, never a raw
 * snake_case key.
 */
export function RecordingNeedsPaymentNotice(props: {
  /** `RecordingDTO.needs_payment_reason` off the wire, straight through. */
  reason: string | null;
  /** The host's route to billing — a link, a button, a drawer trigger. */
  renderTopUpAction?: ReactNode;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const { reason } = props;
  const reasonKey =
    reason !== null && isKnownNeedsPaymentReason(reason)
      ? REASON_KEYS[reason]
      : RECORDINGS_I18N_KEYS.needsPaymentReasonUnknown;
  return (
    <SkinTheme surface="bare">
      <Alert
        type="warning"
        showIcon
        icon={<CreditIcon />}
        title={t(RECORDINGS_I18N_KEYS.needsPaymentTitle)}
        description={
          <div style={{ ...stackStyle, gap: spacing["2"] }}>
            <Typography.Text type="secondary">
              {t(reasonKey ?? RECORDINGS_I18N_KEYS.needsPaymentReasonUnknown)}
            </Typography.Text>
            {props.renderTopUpAction ?? (
              <SlotPlaceholder name="renderTopUpAction" />
            )}
          </div>
        }
        data-testid={props["data-testid"] ?? "recording-needs-payment"}
      />
    </SkinTheme>
  );
}
