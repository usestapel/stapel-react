/**
 * The one error surface this pair's default skins render, so the split copy
 * core produces reaches a screen the same way everywhere.
 *
 * Core's `describeFlowError` splits a failure into the sentence a person reads
 * and the technical detail a support agent quotes. The split is only worth
 * anything if a skin renders both halves at their own weights: `message` at
 * normal weight, `detail` muted and small, where an eye skips it and a support
 * agent finds it.
 *
 * `undefined` in — including a `detail` core left `undefined` because there
 * was nothing worth quoting — renders nothing rather than an empty muted line.
 */
import { Alert, Typography } from "antd";
import type { CSSProperties, ReactElement } from "react";
import type { FlowErrorDisplay } from "@stapel/core";

/** One step under body text — a one-off type decision, named so it is one. */
const DETAIL_FONT_SIZE_PX = 12;
const DETAIL_TEXT_STYLE: CSSProperties = { fontSize: DETAIL_FONT_SIZE_PX };

export function ErrorAlert(props: {
  error: FlowErrorDisplay | undefined;
  style?: CSSProperties | undefined;
  testId?: string | undefined;
}): ReactElement | null {
  const { error } = props;
  if (!error) return null;
  return (
    <Alert
      type="error"
      showIcon
      {...(props.style ? { style: props.style } : {})}
      {...(props.testId ? { "data-testid": props.testId } : {})}
      message={error.message}
      {...(error.detail
        ? {
            description: (
              <Typography.Text type="secondary" style={DETAIL_TEXT_STYLE}>
                {error.detail}
              </Typography.Text>
            ),
          }
        : {})}
    />
  );
}
