import type { ReactElement, ReactNode } from "react";
import { Alert, Typography } from "antd";
import { SlotPlaceholder, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";
import { CreditIcon } from "./icons.js";
import { stackStyle } from "./layout.js";

/**
 * The metered host's out-of-credit refusal, rendered as the thing it was
 * designed to become.
 *
 * `error.402.recording_payment_required` exists because the module's object
 * policy answers a spent balance with its OWN status and key instead of the
 * bare `404` — specifically so a UI could turn it into a top-up prompt. Before
 * this wave the code had no English string at all in this pair: a paying
 * customer who ran out of credit saw a raw key, or "this recording does not
 * exist".
 *
 * Where the money is topped up is not this module's business, so the action is
 * a SLOT. Unfilled, it is a named box in development and nothing in
 * production — never a silent hole where the only useful control belongs.
 */
export function PaymentRequiredNotice(props: {
  /** The host's route to billing — a link, a button, a drawer trigger. */
  renderTopUpAction?: ReactNode;
  "data-testid"?: string;
}): ReactElement {
  const t = useT();
  return (
    <Alert
      type="warning"
      showIcon
      icon={<CreditIcon />}
      title={t(RECORDINGS_I18N_KEYS.paymentTitle)}
      description={
        <div style={{ ...stackStyle, gap: spacing["2"] }}>
          <Typography.Text type="secondary">
            {t(RECORDINGS_I18N_KEYS.paymentHint)}
          </Typography.Text>
          {props.renderTopUpAction ?? (
            <SlotPlaceholder name="renderTopUpAction" />
          )}
        </div>
      }
      data-testid={props["data-testid"] ?? "payment-required"}
    />
  );
}
