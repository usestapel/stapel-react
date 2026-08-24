import type { ReactElement, ReactNode } from "react";
import { Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, GatedButton } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { ResummarizeControl } from "../headless/ResummarizeControl.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { PaymentRequiredNotice } from "./PaymentRequiredNotice.js";
import { RefreshIcon } from "./icons.js";
import { stackStyle } from "./layout.js";

/**
 * "Rewrite summary" — the user's own cheap verb, with every refusal named.
 *
 * Three behaviours make this more than a button:
 *
 *  - **the reason is beside the control, never in a hover.** A disabled button
 *    receives no pointer events, so a tooltip on it is an explanation nobody
 *    can read. `GatedButton` puts the sentence next to it and points the
 *    button's `aria-describedby` at it.
 *  - **`202` is rendered as a receipt.** Accepted is not finished: the button
 *    stays blocked while the job is in flight, so a double click reads as one
 *    action — which is what the backend already does, and what the UI has to
 *    look like for the person to believe it.
 *  - **`402` becomes a top-up prompt.** The module answers a spent balance
 *    with its own code precisely so this is possible.
 */
export function ResummarizeAction(props: {
  recording: Pick<Recording, "id" | "status" | "is_processing" | "segments_count">;
  /** Where the host sends someone to add credit (fills the 402 prompt's slot). */
  renderTopUpAction?: ReactNode;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "resummarize";
  return (
    <ResummarizeControl recording={props.recording}>
      {(bag) => (
        <div style={{ ...stackStyle, gap: spacing["2"] }} data-testid={testId}>
          <GatedButton
            gate={bag.gate}
            icon={<RefreshIcon />}
            loading={bag.isSending}
            onClick={bag.run}
            testId={`${testId}-button`}
            data-analytics="none"
            data-analytics-reason="a metered action with its own receipt; not a funnel step"
          >
            {bag.isSending
              ? t(RECORDINGS_I18N_KEYS.resummarizeRunning)
              : t(RECORDINGS_I18N_KEYS.resummarizeAction)}
          </GatedButton>
          {bag.job !== null ? (
            <Typography.Text type="secondary" data-testid={`${testId}-receipt`}>
              {t(RECORDINGS_I18N_KEYS.resummarizeAccepted)}
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
            // Every other refusal already HAS a sentence: the module ships
            // `error.409.recording_no_transcript` and
            // `error.503.recording_summarize_unavailable` in en/ru/es, and the
            // substrate resolves a thrown value through the same dialect. This
            // wave is why — eleven of the seventeen codes had no English text
            // at all before it, so each of these rendered as a raw key.
            <ErrorAlert
              variant="inline"
              thrown={bag.error}
              onDismiss={bag.reset}
              testId={`${testId}-error`}
            />
          )}
        </div>
      )}
    </ResummarizeControl>
  );
}
