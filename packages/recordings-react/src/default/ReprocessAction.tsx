import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, GatedButton, SkinConfirm } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { ReprocessControl } from "../headless/ReprocessControl.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { PaymentRequiredNotice } from "./PaymentRequiredNotice.js";
import { RefreshIcon } from "./icons.js";
import { stackStyle } from "./layout.js";

/**
 * "Transcribe again" — the staff-shaped verb, confirmed before it costs money.
 *
 * Reprocess re-runs the WHOLE pipeline: a second transcription, a second
 * diarization, a second bill, and the current transcript and summary replaced.
 * That is not a thing to do on a stray click, so it goes through
 * `SkinConfirm` — which is a bottom sheet on a phone and a centred modal above
 * 768px, once, for the whole fleet — and the confirmation NAMES the cost
 * rather than asking "are you sure?".
 *
 * The refusal arms are first-class because the authority (`can_reprocess`) is
 * only discoverable by trying: `402` is a top-up prompt, `403
 * recording_action_denied` is "this deployment does not let you", and the
 * `409` from a recording that is not `completed` is answered before the
 * round-trip by the gate.
 */
export function ReprocessAction(props: {
  recording: Pick<Recording, "id" | "status">;
  /** Where the host sends someone to add credit (fills the 402 prompt's slot). */
  renderTopUpAction?: ReactNode;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "reprocess";
  const [confirming, setConfirming] = useState(false);
  return (
    <ReprocessControl recording={props.recording}>
      {(bag) => (
        <div style={{ ...stackStyle, gap: spacing["2"] }} data-testid={testId}>
          <GatedButton
            gate={bag.gate}
            danger
            icon={<RefreshIcon />}
            loading={bag.isSending}
            onClick={() => {
              setConfirming(true);
            }}
            testId={`${testId}-button`}
            data-analytics="none"
            data-analytics-reason="opens the cost confirmation; the act happens there"
          >
            {bag.isSending
              ? t(RECORDINGS_I18N_KEYS.reprocessRunning)
              : t(RECORDINGS_I18N_KEYS.reprocessAction)}
          </GatedButton>
          <SkinConfirm
            open={confirming}
            danger
            title={t(RECORDINGS_I18N_KEYS.reprocessConfirmTitle)}
            body={t(RECORDINGS_I18N_KEYS.reprocessConfirmBody)}
            confirmLabel={t(RECORDINGS_I18N_KEYS.reprocessConfirmOk)}
            confirming={bag.isSending}
            onConfirm={() => {
              bag.run();
              setConfirming(false);
            }}
            onCancel={() => {
              setConfirming(false);
            }}
            data-testid={`${testId}-confirm`}
          />
          {bag.recording !== null ? (
            <Typography.Text type="secondary" data-testid={`${testId}-queued`}>
              {t(RECORDINGS_I18N_KEYS.reprocessQueued)}
            </Typography.Text>
          ) : null}
          {bag.isPaymentRequired ? (
            <PaymentRequiredNotice
              {...(props.renderTopUpAction !== undefined
                ? { renderTopUpAction: props.renderTopUpAction }
                : {})}
              data-testid={`${testId}-payment`}
            />
          ) : (
            <ErrorAlert
              variant="inline"
              thrown={bag.error}
              onDismiss={bag.reset}
              testId={`${testId}-error`}
            />
          )}
        </div>
      )}
    </ReprocessControl>
  );
}
