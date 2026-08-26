/**
 * `<WebhooksSettingsPane>` — the prop-free developer-settings page the nav
 * manifest's `account.webhooks` entry mounts.
 *
 * It sits under the account's settings, beside `auth.security`, because that
 * is what it is: a thing you configure about your own account/workspace, not a
 * product surface. The page is a full-page screen, so it paints
 * `surface="base"` and the panes inside it paint their own raised cards.
 *
 * The only chrome it adds to `<SubscriptionsPane>` is a sentence saying what a
 * webhook is and a link to the host's receiver documentation. Both matter on
 * the FIRST visit, which for this feature is the visit that decides whether
 * anybody uses it: the signing scheme, the header names and the tolerance
 * window live in `signing.py` and are served nowhere (BACKEND-GAP W-6), so
 * without the host's link a person has a secret and no way to check it.
 */
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useWebhooksRuntime } from "../model/context.js";
import { SETTINGS_MAX_WIDTH } from "./layout.js";
import { SubscriptionsPane } from "./SubscriptionsPane.js";
import type { ThemeModeProp } from "./types.js";

export type WebhooksSettingsPaneProps = ThemeModeProp;

export function WebhooksSettingsPane(
  props: WebhooksSettingsPaneProps
): ReactElement {
  const t = useT();
  const runtime = useWebhooksRuntime();

  return (
    <SkinTheme
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      surface="base"
    >
      <Flex
        vertical
        gap={spacing[4]}
        style={{ maxWidth: SETTINGS_MAX_WIDTH }}
        data-testid="webhooks-settings"
      >
        <Flex vertical gap={spacing[1]}>
          <Typography.Title level={3}>
            {t(WEBHOOKS_I18N_KEYS.title)}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t(WEBHOOKS_I18N_KEYS.intro)}
          </Typography.Text>
          {runtime.docsHref !== undefined ? (
            <Typography.Link
              href={runtime.docsHref}
              target="_blank"
              rel="noreferrer"
              data-testid="webhooks-settings-docs"
            >
              {t(WEBHOOKS_I18N_KEYS.docs)}
            </Typography.Link>
          ) : null}
        </Flex>

        <SubscriptionsPane
          {...(props.mode !== undefined ? { mode: props.mode } : {})}
        />
      </Flex>
    </SkinTheme>
  );
}
