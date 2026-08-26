/**
 * `<MandateNotice>` — the 503 that is not about the person.
 *
 * Every route of stapel-webhooks is guarded by `HasWorkspaceMandateIfScoped`
 * (`views.py`), and in a multi-tenant deployment that guard can answer
 * **503 `error.503.mandate_unavailable`**: we could not check whether you
 * belong to this workspace. It is not a permission failure — nothing about the
 * person or their request is wrong — and it is not a fault in their webhook
 * configuration, which is the conclusion an ordinary red error banner invites
 * on a developer-settings tab.
 *
 * So it gets a named arm of its own, in the one voice that fits: this is on our
 * side, it is temporary, here is the retry. Every read in this pair routes its
 * `failed` arm through it.
 *
 * It is built on the substrate's `EmptyState` rather than a raw antd `Alert`:
 * `EmptyState` already carries `role="status"` — the right announcement for
 * "we could not check", which is a STATE and not an error — and already draws
 * a title/hint/action in the fleet's spacing. A raw `Alert` here would be one
 * more private copy of a surface the substrate already owns.
 */
import type { ReactElement } from "react";
import { Button } from "antd";
import { EmptyState, SkinTheme } from "@stapel/tokens-antd/skin";
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

export interface MandateNoticeProps extends ThemeModeProp {
  readonly onRetry?: () => void;
  readonly testId?: string;
}

export function MandateNotice(props: MandateNoticeProps): ReactElement {
  const t = useT();
  const testId = props.testId ?? "webhooks-mandate";
  return (
    // `bare`, because this is normally inset in a pane that has already
    // painted its surface — but it is still a SkinTheme, so a host that mounts
    // the notice on its own gets the theme rather than the browser default.
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
    >
      <EmptyState
      testId={testId}
      title={t(WEBHOOKS_I18N_KEYS.mandate)}
      hint={t(WEBHOOKS_I18N_KEYS.mandateHint)}
      {...(props.onRetry !== undefined
        ? {
            action: (
              <Button
                size="small"
                data-testid={`${testId}-retry`}
                data-analytics="none"
                data-analytics-reason="re-reads a failed query; nothing is decided by the person here"
                onClick={props.onRetry}
              >
                {t(STAPEL_UI_KEYS.retry)}
              </Button>
            ),
          }
        : {})}
      />
    </SkinTheme>
  );
}
