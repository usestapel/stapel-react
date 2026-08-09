/**
 * The one error surface this pair's default skins render, so the split copy
 * core produces reaches a screen the same way everywhere.
 *
 * Core's `describeFlowError` splits a failure into the sentence a person
 * reads and the technical detail a support agent quotes (owner report
 * 2026-08-09: the status used to be spliced into the sentence, which ended
 * in a bare `" (500)"` — and a product does not read a protocol number out to
 * a person). The split is only worth anything if a
 * skin actually renders both halves at their own weights: `message` at
 * normal weight, `detail` muted and small, where an eye skips it and a
 * support agent finds it.
 *
 * `undefined` in — including a `detail` that core left `undefined` because
 * there was nothing worth quoting — renders nothing rather than an empty
 * muted line.
 */
import { Alert, Typography } from "antd";
import type { CSSProperties, ReactElement } from "react";
import type { FlowErrorDisplay } from "@stapel/core";

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
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {error.detail}
              </Typography.Text>
            ),
          }
        : {})}
    />
  );
}
