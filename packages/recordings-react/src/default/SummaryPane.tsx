import type { ReactElement, ReactNode } from "react";
import { Typography } from "antd";
import { useT } from "@stapel/core";
import { EmptyState } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { Recording } from "../api/types.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { rowStyle, stackStyle } from "./layout.js";

/**
 * The recording's LLM summary.
 *
 * `unavailable` is the honest half of a gap in the contract. `SUMMARIZE_ENABLED`
 * is a deployment axis and there is **no capability endpoint to ask it** — the
 * only signal a client ever gets is a `503
 * recording_summarize_unavailable` in response to an attempt. So a host that
 * knows its deployment has summaries switched off passes `unavailable`, and
 * this pane does not exist at all rather than showing an empty card beside a
 * button that cannot work (§83: a control offering something meaningless).
 * Raising a capability read with the module owner is in this pair's REQUESTS;
 * until then the flag is the only way to be right.
 */
export function SummaryPane(props: {
  recording: Pick<Recording, "summary">;
  /** The re-summarize control, when the host wants one here. */
  action?: ReactNode;
  /** This deployment does not do summaries — render nothing at all. */
  unavailable?: boolean;
  "data-testid"?: string;
}): ReactElement | null {
  const t = useT();
  if (props.unavailable === true) return null;
  const summary = props.recording.summary;
  return (
    <section
      style={stackStyle}
      data-testid={props["data-testid"] ?? "summary-pane"}
    >
      <div style={{ ...rowStyle, justifyContent: "space-between" }}>
        <Typography.Text strong>
          {t(RECORDINGS_I18N_KEYS.summaryHeading)}
        </Typography.Text>
        {props.action}
      </div>
      {summary !== null && summary !== "" ? (
        <Typography.Paragraph
          style={{ marginBottom: spacing["0"], whiteSpace: "pre-wrap" }}
        >
          {summary}
        </Typography.Paragraph>
      ) : (
        <EmptyState
          title={t(RECORDINGS_I18N_KEYS.summaryEmpty)}
          compact
          testId="summary-pane-empty"
        />
      )}
    </section>
  );
}
