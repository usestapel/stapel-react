/**
 * `<SecretReveal>` — the one screen in this pair that shows a secret, and the
 * only time it will ever be shown.
 *
 * `SubscriptionPresenterDTO` carries `has_secret`, never `secret`: the backend
 * keeps a hash, and create (201) and rotate (200) are the two responses that
 * ever contain the plaintext. So this component is the last place the value
 * exists outside the receiver that will verify with it — which is why:
 *
 *  - the warning is ABOVE the value, not below it, and says what "once" means;
 *  - the copy control is a real button with an `aria-label`, not a decorative
 *    icon, because copying is the whole task;
 *  - closing is gated by an explicit acknowledgement rather than a ✕ somebody
 *    can hit before reading. A dialog with no dismissal affordance is normally
 *    a trap; here the body IS the only exit, deliberately, and it is the exact
 *    case `SkinDialog`'s `dismissible={false}` was written for;
 *  - acknowledging DROPS the value from the hook's state (`useSecretRotation`),
 *    so nothing in this process keeps a copy after the person says they have
 *    it.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Checkbox, Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

export interface SecretRevealProps extends ThemeModeProp {
  /** The plaintext, straight off the 201/200. */
  readonly secret: string;
  /** Called when the person confirms they have stored it. */
  readonly onAcknowledge: () => void;
  /** The host's own "how to verify the signature" page, if it has one. */
  readonly docsHref?: string;
  readonly testId?: string;
}

/** Best-effort clipboard write. A browser that refuses (no permission, an
 * insecure origin) leaves the value selectable on screen, which is why the
 * secret is rendered as text and not behind a button. */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function SecretReveal(props: SecretRevealProps): ReactElement {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const testId = props.testId ?? "webhooks-secret";

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="bare"
    >
      <Flex vertical gap={spacing[3]} data-testid={testId}>
        {/* Composed rather than an antd `Alert`: the heading prop was renamed
            between antd 5 and 6, and this is the one banner in the pair that
            must never silently render without its heading. */}
        <Flex vertical gap={spacing[1]} data-testid={`${testId}-warning`}>
          <Typography.Text type="warning" strong>
            {t(WEBHOOKS_I18N_KEYS.secretTitle)}
          </Typography.Text>
          <Typography.Text type="warning">
            {t(WEBHOOKS_I18N_KEYS.secretShownOnce)}
          </Typography.Text>
        </Flex>
        <Flex gap={spacing[2]} align="center" wrap>
          <Typography.Text code data-testid={`${testId}-value`}>
            {props.secret}
          </Typography.Text>
          <Button
            size="small"
            aria-label={t(WEBHOOKS_I18N_KEYS.secretCopy)}
            data-testid={`${testId}-copy`}
            data-analytics="none"
            data-analytics-reason="copying a secret is the person's own act, and the value must not reach a collector"
            onClick={() => {
              void copyToClipboard(props.secret).then(setCopied);
            }}
          >
            {t(
              copied
                ? WEBHOOKS_I18N_KEYS.secretCopied
                : WEBHOOKS_I18N_KEYS.secretCopy
            )}
          </Button>
        </Flex>
        {props.docsHref !== undefined ? (
          <Typography.Link
            href={props.docsHref}
            target="_blank"
            rel="noreferrer"
            data-testid={`${testId}-docs`}
          >
            {t(WEBHOOKS_I18N_KEYS.secretDocs)}
          </Typography.Link>
        ) : null}
        <Checkbox
          checked={acknowledged}
          data-testid={`${testId}-ack`}
          onChange={(event) => setAcknowledged(event.target.checked)}
        >
          {t(WEBHOOKS_I18N_KEYS.secretAck)}
        </Checkbox>
        <Button
          type="primary"
          block
          disabled={!acknowledged}
          data-disabled-reason={t(WEBHOOKS_I18N_KEYS.secretAck)}
          data-testid={`${testId}-done`}
          data-analytics="none"
          data-analytics-reason="closes the reveal; the rotation itself is the tracked event"
          onClick={props.onAcknowledge}
        >
          {t(WEBHOOKS_I18N_KEYS.secretClose)}
        </Button>
      </Flex>
    </SkinTheme>
  );
}
