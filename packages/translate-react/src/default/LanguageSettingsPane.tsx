/**
 * `<LanguageSettingsPane/>` — the account-level screen the nav entry mounts.
 *
 * The switcher itself belongs in the header (chrome, reachable from every
 * page), but a person looking for "where do I change the language?" looks in
 * their settings, and a setting with no page has no address to link to, no
 * route for a scaffold to build and nowhere to explain what the choice does.
 * So this is a real screen: the control, one sentence saying what it affects,
 * and the status line an operator needs when a translation looks wrong.
 *
 * `menuVisibleDefault` is `true` for this entry (see `src/nav/manifest.ts`):
 * unlike a profile field composed into a bigger settings page, nothing else in
 * the fleet renders this control on a page of its own.
 */
import type { ReactElement } from "react";
import { Card, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { TRANSLATE_I18N_KEYS } from "../i18n/keys.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { TranslationStatus } from "./TranslationStatus.js";
import type { ThemeModeProp } from "./types.js";

export interface LanguageSettingsPaneProps extends ThemeModeProp {
  readonly "data-testid"?: string;
}

export function LanguageSettingsPane(
  props: LanguageSettingsPaneProps
): ReactElement {
  const t = useT();

  return (
    <SkinTheme
      surface="base"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <Card
        title={t(TRANSLATE_I18N_KEYS.settingsHeading)}
        style={{ width: "100%", maxWidth: "32rem" }}
        data-testid="translate-language-settings"
      >
        <Flex vertical gap={spacing[3]}>
          <Typography.Text type="secondary">
            {t(TRANSLATE_I18N_KEYS.settingsHint)}
          </Typography.Text>
          <LanguageSwitcher />
          <TranslationStatus />
        </Flex>
      </Card>
    </SkinTheme>
  );
}
