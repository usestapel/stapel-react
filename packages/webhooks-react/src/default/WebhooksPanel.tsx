/**
 * `<WebhooksPanel/>` — the skin skeleton this pair ships from `./default`.
 *
 * It is a SKELETON and says so: a themed surface, the three states every
 * screen owes a person (loading, empty, refusal), and the provider check that
 * makes a missing `<WebhooksProvider>` a loud error instead of a blank box.
 * Replace the body as the pair grows read hooks — keep the frame:
 *
 *  - one `<SkinTheme>` from `@stapel/tokens-antd/skin`, never a local
 *    `ConfigProvider` (that forks the token bridge per pair) and never a
 *    `mode = "light"` default (that ignores the host's theme);
 *  - every user-visible string through an i18n key with en/ru/es texts;
 *  - a dialog, if this screen ever opens one, through `SkinDialog` — the
 *    fleet's "bottom sheet on a phone, modal above 768px" rule lives there
 *    once (`stapel/no-bare-dialog` refuses a bare antd Modal/Drawer here).
 */
import type { ReactElement } from "react";
import { Card, Empty, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { WEBHOOKS_I18N_KEYS } from "../i18n/keys.js";
import { useWebhooksRuntime } from "../model/context.js";
import type { ThemeModeProp } from "./types.js";

export interface WebhooksPanelProps extends ThemeModeProp {
  /** Rendered while the screen's own data is in flight. */
  readonly loading?: boolean;
}

export function WebhooksPanel(props: WebhooksPanelProps): ReactElement {
  const t = useT();
  // Reads the runtime purely so that mounting this panel OUTSIDE
  // <WebhooksProvider> throws the context error with the provider's name in
  // it, at the place the mistake was made.
  useWebhooksRuntime();

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card title={t(WEBHOOKS_I18N_KEYS.navOverview)} data-testid="webhooks-panel">
        {props.loading === true ? (
          <Typography.Paragraph>
            {t(WEBHOOKS_I18N_KEYS.panelLoading)}
          </Typography.Paragraph>
        ) : (
          <Empty description={t(WEBHOOKS_I18N_KEYS.panelEmpty)} />
        )}
      </Card>
    </SkinTheme>
  );
}
