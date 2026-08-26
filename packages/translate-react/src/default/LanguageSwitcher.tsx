/**
 * `<LanguageSwitcher/>` — the control this pair exists to put on screen.
 *
 * ── Two surfaces, one rule ─────────────────────────────────────────────────
 *
 * On tablet and desktop it is an antd `Select` with search. On a PHONE it is a
 * button that opens a `SkinDialog` bottom sheet with a scrollable list: a
 * native `Select` dropdown on a 390px screen is the desktop-surface-on-phone
 * defect — a twenty-row popup anchored to a control near the bottom of the
 * viewport, with 24px hit targets. The surface decision comes from
 * `useDialogSurface()`, the same one `SkinDialog` itself reads, so the two can
 * never disagree.
 *
 * `compact` is the header form: a globe and the current code, opening the same
 * sheet on every width. It is what a container drops into `AppShell`'s
 * `headerExtra` slot — this pair contributes no top-level nav entry for it,
 * because a language switcher is chrome, not a destination.
 *
 * ── A switch that half worked says so ──────────────────────────────────────
 *
 * The bundle download can fail while the switch itself succeeds (the loader
 * falls back to the copy built into the app). The control does not hide that:
 * the choice applies, AND a line beside it says some texts may still read in
 * English. Beside — never in a tooltip, which a person on a phone cannot open
 * at all.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Flex, List, Select, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinDialog, SkinTheme, useDialogSurface } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { TRANSLATE_I18N_KEYS } from "../i18n/keys.js";
import { useLanguage } from "../headless/useLanguage.js";
import { GlobeIcon } from "./icons.js";
import type { ThemeModeProp } from "./types.js";

export interface LanguageSwitcherProps extends ThemeModeProp {
  /** The header form: a globe and the current code, sheet on every width. */
  readonly compact?: boolean;
  /** Accessible name. Defaults to the pair's "Language". */
  readonly label?: string;
  readonly "data-testid"?: string;
}

export function LanguageSwitcher(props: LanguageSwitcherProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const surface = useDialogSurface();
  const [open, setOpen] = useState(false);
  const label = props.label ?? t(TRANSLATE_I18N_KEYS.switcherLabel);
  const compact = props.compact === true;
  const asSheet = compact || surface === "sheet";

  const current = language.options.find((option) => option.code === language.code);
  const currentName =
    current !== undefined
      ? t(current.labelKey)
      : t(TRANSLATE_I18N_KEYS.switcherPlaceholder);

  const pick = (code: string): void => {
    language.setCode(code);
    setOpen(false);
  };

  const partial =
    language.partial ? (
      <Typography.Text type="secondary" data-stapel-translate="partial">
        {t(TRANSLATE_I18N_KEYS.switcherPartial)}
      </Typography.Text>
    ) : null;

  const control = asSheet ? (
    <>
      <Button
        block={!compact}
        aria-label={compact ? t(TRANSLATE_I18N_KEYS.switcherOpen) : label}
        loading={language.switching}
        onClick={() => {
          setOpen(true);
        }}
        data-analytics="none"
        data-analytics-reason="opens the language sheet; the change itself is tracked in useLanguage"
        data-testid="translate-switcher-trigger"
      >
        <Flex align="center" gap={spacing[2]}>
          <GlobeIcon />
          <span>{compact ? language.code.toUpperCase() : currentName}</span>
        </Flex>
      </Button>
      <SkinDialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={label}
        dismissLabel={t(TRANSLATE_I18N_KEYS.dialogDismiss)}
        data-testid="translate-switcher-sheet"
      >
        <List
          dataSource={[...language.options]}
          renderItem={(option) => (
            <List.Item
              onClick={() => {
                pick(option.code);
              }}
              aria-current={option.code === language.code}
              style={{ cursor: "pointer" }}
              data-analytics="none"
              data-analytics-reason="the language change is tracked once, in useLanguage"
            >
              {t(option.labelKey)}
            </List.Item>
          )}
        />
      </SkinDialog>
    </>
  ) : (
    <Select
      showSearch
      value={language.code}
      aria-label={label}
      loading={language.switching}
      style={{ width: "100%" }}
      placeholder={t(TRANSLATE_I18N_KEYS.switcherPlaceholder)}
      optionFilterProp="label"
      onChange={pick}
      options={language.options.map((option) => ({
        value: option.code,
        label: t(option.labelKey),
      }))}
      data-testid="translate-switcher-select"
    />
  );

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
    >
      <Flex vertical gap={spacing[1]}>
        {control}
        {partial}
      </Flex>
    </SkinTheme>
  );
}
