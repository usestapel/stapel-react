/**
 * `<InitialSetupModal/>` — default antd skin for the InitialSetupPrompt canon
 * (workspaces-org-program §B5; ironmemo `onboarding-modal.tsx` ported to this
 * pair's default-skin conventions, see `ProfileSettings.tsx`). Built entirely
 * on the pair's headless {@link InitialSetupPrompt} + `useLanguages` — no new
 * backend surface.
 *
 * WHEN it opens is the host's wiring, through the pair's gate:
 *
 * ```tsx
 * const gate = useInitialSetupGate({ mode: "daily", require: "initialSetup" });
 * <InitialSetupModal open={gate.shouldShow} onClose={gate.dismiss} />
 * ```
 *
 * The meettoday blocking case (`mode: "always"`, `require: "displayName"` —
 * the ex-`GuestNameModal`: a guest cannot join a call nameless) passes
 * `skippable={false}`: no Skip button, no ✕, no Esc/mask dismiss — Save is
 * the only way out, exactly like the reference modal.
 *
 * Rows follow the settings-skin canon (frontend-guidelines §8, one labelled
 * row per field, stacked): display name `Input`; the EXACT theme row
 * `<ProfileSettings/>` renders (a block `Segmented` with the pair's
 * `profiles.settings.theme.*` i18n keys); app language as a `Select` fed by
 * the pair's `useLanguages` (no "Auto" first item here — first-run picks an
 * explicit language; `LanguageSettings` owns the Auto affordance). Unlike the
 * settings screens' reactive pickers, this form commits ONCE via the bag's
 * `submit()` — the §B5 single PATCH carrying `initial_setup_passed: true`.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  ConfigProvider,
  Flex,
  Input,
  Modal,
  Segmented,
  Select,
  Spin,
  Typography,
} from "antd";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { InitialSetupPrompt } from "../headless/InitialSetupPrompt.js";
import type {
  InitialSetupFieldName,
  InitialSetupPromptBag,
} from "../headless/InitialSetupPrompt.js";
import { useLanguages } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import type { MyProfile } from "../api/types.js";

export interface InitialSetupModalProps {
  /**
   * Light or dark. The theme is derived from `@stapel/tokens` via
   * `toAntdThemeConfig(mode)` — no manual token wiring, same self-theming
   * contract as `AuthPanel`. Default `"light"`.
   */
  readonly mode?: ThemeMode;
  /** Show the modal — typically `useInitialSetupGate(...).shouldShow`. */
  readonly open: boolean;
  /**
   * Called whenever the modal wants to close: after a successful Save, after
   * Skip, or on ✕/Esc/mask (the latter three only when `skippable`) —
   * typically the gate's `dismiss`. Skip/close bookkeeping (the §B5 daily
   * stamp) is already done by the headless `skip()` before this fires.
   */
  onClose?(): void;
  /**
   * Default `true`: a Skip ("maybe later") button plus the usual ✕/Esc/mask
   * dismissal. `false` is the blocking mode (§B5 `always`+`displayName`,
   * meettoday's join-a-call case): Save is the only way out.
   */
  readonly skippable?: boolean;
  /** Which first-run fields to collect — forwarded to the headless
   * {@link InitialSetupPrompt} (default: all three). */
  readonly fields?: readonly InitialSetupFieldName[];
  /** Fired with the updated profile after a successful Save (before
   * `onClose`). */
  onSubmitted?(profile: MyProfile): void;
}

/** The settings-canon row wrapper (label above its control — mirrors
 * `ProfileSettings.tsx`'s `SettingRow`). */
function SettingRow(props: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
        {props.label}
      </Typography.Text>
      {props.children}
    </div>
  );
}

function ModalBody(props: {
  bag: InitialSetupPromptBag;
  skippable: boolean;
}): ReactElement {
  const t = useT();
  const languages = useLanguages();
  const { bag } = props;

  if (bag.isLoading) {
    return <Spin data-testid="initial-setup-loading" />;
  }

  const languageOptions = languages.data ?? [];

  return (
    <Flex vertical gap={20}>
      <Typography.Text type="secondary">
        {t(PROFILES_I18N_KEYS.initialSetupSubtitle)}
      </Typography.Text>

      {bag.displayName.enabled && (
        <SettingRow label={t(PROFILES_I18N_KEYS.fieldDisplayName)}>
          <Input
            autoFocus
            value={bag.displayName.value}
            onChange={(e) => bag.displayName.set(e.target.value)}
            onPressEnter={() => bag.submit()}
            placeholder={t(PROFILES_I18N_KEYS.initialSetupNamePlaceholder)}
            disabled={bag.isSaving}
            data-testid="initial-setup-display-name"
          />
        </SettingRow>
      )}

      {bag.theme.enabled && (
        // The exact theme row canon from <ProfileSettings/> (same widget,
        // same i18n keys) — first-run and settings must read identically.
        <SettingRow label={t(PROFILES_I18N_KEYS.fieldTheme)}>
          <Segmented<string>
            value={bag.theme.value}
            onChange={(v) => bag.theme.set(v)}
            block
            options={[
              { value: "light", label: t(PROFILES_I18N_KEYS.themeLight) },
              { value: "dark", label: t(PROFILES_I18N_KEYS.themeDark) },
              { value: "system", label: t(PROFILES_I18N_KEYS.themeSystem) },
            ]}
          />
        </SettingRow>
      )}

      {bag.language.enabled && languageOptions.length > 0 && (
        <SettingRow label={t(PROFILES_I18N_KEYS.fieldAppLanguage)}>
          <Select<string>
            value={bag.language.value.length > 0 ? bag.language.value : null}
            onChange={(v) => bag.language.set(v)}
            style={{ width: "100%" }}
            options={languageOptions.map((l) => ({
              value: l.code,
              label: `${l.name} (${l.code.toUpperCase()})`,
            }))}
          />
        </SettingRow>
      )}

      {bag.isError && bag.error && (
        <Alert type="error" showIcon message={bag.error.message} />
      )}

      <Flex gap={8} justify="flex-end">
        {props.skippable && (
          <Button
            onClick={bag.skip}
            data-analytics="none"
            data-analytics-reason="business action (skip records via the pair's storage seam, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
          >
            {t(PROFILES_I18N_KEYS.initialSetupSkip)}
          </Button>
        )}
        <Button
          type="primary"
          onClick={() => bag.submit()}
          loading={bag.isSaving}
          disabled={!bag.canSubmit}
          data-analytics="none"
          data-analytics-reason="business action (a plain PATCH, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
        >
          {bag.isSaving
            ? t(PROFILES_I18N_KEYS.initialSetupSaving)
            : t(PROFILES_I18N_KEYS.initialSetupSave)}
        </Button>
      </Flex>
    </Flex>
  );
}

export function InitialSetupModal(props: InitialSetupModalProps): ReactElement {
  const t = useT();
  const skippable = props.skippable ?? true;
  const theme = useMemo(() => toAntdThemeConfig(props.mode ?? "light"), [props.mode]);

  return (
    <ConfigProvider theme={theme}>
      <InitialSetupPrompt
        {...(props.fields !== undefined ? { fields: props.fields } : {})}
        onSubmitted={(profile) => {
          props.onSubmitted?.(profile);
          props.onClose?.();
        }}
        onSkip={() => props.onClose?.()}
      >
        {(bag) => (
          <Modal
            open={props.open}
            title={t(PROFILES_I18N_KEYS.initialSetupTitle)}
            footer={null}
            closable={skippable}
            // antd 6 deprecates `maskClosable` for `mask={{ closable }}` — but
            // the object form doesn't exist in antd 5 and this pair's peer
            // range spans both (>=5.20 <7), so the still-functional legacy
            // prop is the one spelling that behaves on every supported major.
            maskClosable={skippable}
            keyboard={skippable}
            onCancel={() => {
              // ✕ / Esc / mask — an implicit skip: record it like the button
              // (only reachable when skippable).
              bag.skip();
            }}
            destroyOnHidden
          >
            <ModalBody bag={bag} skippable={skippable} />
          </Modal>
        )}
      </InitialSetupPrompt>
    </ConfigProvider>
  );
}
