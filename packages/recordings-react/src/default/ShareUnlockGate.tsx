import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Input, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert, SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { LockIcon } from "./icons.js";
import { rowStyle, stackStyle } from "./layout.js";

/**
 * The passcode gate on a protected share link.
 *
 * A STATE of the page, not an error on it: `401 share_passcode_required` is
 * what a locked link is supposed to answer, and rendering it as a failure
 * ("something went wrong") would tell a visitor the link is broken when it is
 * merely locked.
 *
 * `429 share_unlock_throttled` is its own named arm. Guessing is bounded by a
 * persisted lockout server-side, so a visitor who is locked out needs to be
 * told to wait — not shown a generic failure they will answer by trying again
 * immediately, which is exactly what the lockout exists to stop.
 *
 * It mounts `SkinTheme` like every other surface in this package. Without it an
 * anonymous share page — which has no owner chrome above it to inherit from —
 * fell through to antd's stock accent, so the one primary button on the link a
 * customer is sent was a different blue from the rest of the product (visual
 * pass N-8).
 */
export function ShareUnlockGate(props: {
  onUnlock: (passcode: string) => void;
  isUnlocking: boolean;
  /** The unlock attempt's failure, if any. */
  error?: unknown;
  /** Too many attempts — a lockout, not a wrong passcode. */
  throttled?: boolean;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  const [passcode, setPasscode] = useState("");
  const testId = props["data-testid"] ?? "share-unlock";
  const submit = (): void => {
    if (passcode.length > 0) props.onUnlock(passcode);
  };
  return (
    <SkinTheme surface="base">
      <form
        style={{ ...stackStyle, gap: spacing["3"] }}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        data-analytics="none"
        data-analytics-reason="anonymous surface; the pair ships no analytics for it"
        data-testid={testId}
      >
        <div style={{ ...rowStyle, gap: spacing["2"] }}>
          <LockIcon />
          <Typography.Text strong>
            {t(RECORDINGS_I18N_KEYS.shareLockedTitle)}
          </Typography.Text>
        </div>
        <Typography.Text type="secondary">
          {t(RECORDINGS_I18N_KEYS.shareLockedHint)}
        </Typography.Text>
        <label style={{ ...stackStyle, gap: spacing["1"] }}>
          <Typography.Text>
            {t(RECORDINGS_I18N_KEYS.sharePasscodeLabel)}
          </Typography.Text>
          <Input.Password
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
            }}
            autoComplete="one-time-code"
            data-testid={`${testId}-input`}
          />
        </label>
        {props.throttled === true ? (
          <ErrorAlert
            message={t(RECORDINGS_I18N_KEYS.shareThrottled)}
            testId={`${testId}-throttled`}
          />
        ) : (
          <ErrorAlert
            variant="inline"
            thrown={props.error}
            testId={`${testId}-error`}
          />
        )}
        <div style={rowStyle}>
          <Button
            type="primary"
            htmlType="submit"
            loading={props.isUnlocking}
            data-analytics="none"
            data-analytics-reason="anonymous surface; the pair ships no analytics for it"
            data-testid={`${testId}-submit`}
          >
            {props.isUnlocking
              ? t(RECORDINGS_I18N_KEYS.shareUnlocking)
              : t(RECORDINGS_I18N_KEYS.shareUnlock)}
          </Button>
        </div>
      </form>
    </SkinTheme>
  );
}
