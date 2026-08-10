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
 *
 * `onRetry` puts the way out next to the bad news: a read that failed is
 * usually one button away from succeeding, and a screen that states a failure
 * without offering the retry leaves the person with nothing to do.
 */
import { Alert, Button, Typography } from "antd";
import type { CSSProperties, ReactElement } from "react";
import type { FlowErrorDisplay } from "@stapel/core";
import { useT } from "@stapel/core";
import { AUTH_I18N_KEYS } from "../i18n/keys.js";

export function ErrorAlert(props: {
  error: FlowErrorDisplay | undefined;
  style?: CSSProperties | undefined;
  testId?: string | undefined;
  /** Re-run the failed read. Omit where there is nothing to re-run. */
  onRetry?: (() => void) | undefined;
}): ReactElement | null {
  const t = useT();
  const { error, onRetry } = props;
  if (!error) return null;
  return (
    <Alert
      type="error"
      showIcon
      {...(props.style ? { style: props.style } : {})}
      {...(props.testId ? { "data-testid": props.testId } : {})}
      message={error.message}
      {...(onRetry
        ? {
            action: (
              <Button size="small" onClick={onRetry} data-analytics="flow">
                {t(AUTH_I18N_KEYS.uiRetry)}
              </Button>
            ),
          }
        : {})}
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
