/**
 * The one error surface this pair's default skin renders, so the split copy
 * core produces reaches a screen the same way everywhere (mirrors the
 * docs/notifications/workspaces etalon).
 *
 * Core's `describeFlowError` splits a failure into the sentence a person
 * reads and the technical detail a support agent quotes (owner report
 * 2026-08-09: the status used to be spliced into the sentence, ending in a
 * bare `" (500)"`). The split only helps if a skin renders both halves at
 * their own weights: `message` at normal weight, `detail` muted and small.
 *
 * `undefined` in — including a `detail` core left `undefined` because there
 * was nothing worth quoting — renders nothing rather than an empty line.
 */
import { Alert, Typography } from "antd";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { FlowErrorDisplay } from "@stapel/core";

export function ErrorAlert(props: {
  error: FlowErrorDisplay | undefined;
  style?: CSSProperties | undefined;
  testId?: string | undefined;
  action?: ReactNode;
}): ReactElement | null {
  const { error } = props;
  if (!error) return null;
  return (
    <Alert
      type="error"
      showIcon
      {...(props.style ? { style: props.style } : {})}
      {...(props.testId ? { "data-testid": props.testId } : {})}
      {...(props.action ? { action: props.action } : {})}
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
