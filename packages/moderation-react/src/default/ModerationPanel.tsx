/**
 * `<ModerationPanel/>` — the skin skeleton this pair ships from `./default`.
 *
 * It is a SKELETON and says so: a themed surface, the three states every
 * screen owes a person (loading, empty, refusal), and the provider check that
 * makes a missing `<ModerationProvider>` a loud error instead of a blank box.
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
import { STAPEL_UI_KEYS, useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useModerationRuntime } from "../model/context.js";
import type { ThemeModeProp } from "./types.js";

export interface ModerationPanelProps extends ThemeModeProp {
  /** Rendered while the screen's own data is in flight. */
  readonly loading?: boolean;
}

export function ModerationPanel(props: ModerationPanelProps): ReactElement {
  const t = useT();
  // Reads the runtime purely so that mounting this panel OUTSIDE
  // <ModerationProvider> throws the context error with the provider's name in
  // it, at the place the mistake was made.
  useModerationRuntime();

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Card title={t(MODERATION_I18N_KEYS.consoleTitle)} data-testid="moderation-panel">
        {props.loading === true ? (
          <Typography.Paragraph>
            {t(STAPEL_UI_KEYS.loading)}
          </Typography.Paragraph>
        ) : (
          <Empty description={t(MODERATION_I18N_KEYS.queueEmpty)} />
        )}
      </Card>
    </SkinTheme>
  );
}
