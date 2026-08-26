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
 * `skippable={false}`: no Skip button, and no dismissal — the mask, Esc, the
 * ✕ and the sheet's swipe are all inert, so Save is the only way out, exactly
 * like the reference modal.
 *
 * SURFACE: this is a dialog, not a modal-shaped component. Which shape it
 * takes is the fleet rule stated once in `@stapel/tokens-antd/skin` — a
 * bottom sheet on a phone, a centred modal on tablet/desktop (owner ruling
 * 2026-08-24) — so the name `<InitialSetupModal/>` is now historical, kept
 * because it is the pair's published export. Blocking mode (`skippable=
 * false` — the guest who genuinely cannot join a call nameless) passes
 * `dismissible={false}`, which draws no dismissal affordance at all and
 * disarms Esc and the mask with it: Save is visibly the only exit, rather
 * than a ✕ that is offered and silently does nothing.
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
import { spacing } from "@stapel/tokens";
import type { ReactElement } from "react";
import { Button, Flex, Input, Segmented, Select, Spin, Typography } from "antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { ErrorAlert, SkinDialog, SkinTheme } from "@stapel/tokens-antd/skin";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  matchList,
  useActionGate,
  useT,
} from "@stapel/core";
import { InitialSetupPrompt } from "../headless/InitialSetupPrompt.js";
import type {
  InitialSetupFieldName,
  InitialSetupPromptBag,
} from "../headless/InitialSetupPrompt.js";
import { useLanguages } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { SettingRow, SEGMENTED_TRACK } from "./parts.js";
import type { MyProfile } from "../api/types.js";

export interface InitialSetupModalProps {
  /**
   * Light or dark. Omitted — the normal case — the skin follows the mode the
   * host's document declares, LIVE, through `SkinTheme`/`useThemeMode`.
   *
   * Two failures this replaces, both already paid for: a hardcoded `"light"`
   * default rendered an unreadable error Alert on a dark sandbox (owner
   * report 2026-08-09 — antd's light algorithm derived a near-white
   * `colorErrorBg` while `colorText` came live off the host's dark tokens),
   * and `resolveThemeMode()` SAMPLES the document once per render, so a host
   * that flips `data-theme` at runtime left mounted skins on the old side.
   * Pass it explicitly to pin a side.
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

/**
 * Why Save is off, if it is. The bag's `canSubmit` folds two unrelated
 * situations into one bit; only one of them is something the person can act
 * on, so only that one states a reason ("a PATCH is in flight" keeps the
 * spinner it always had).
 */
function useSubmitGate(bag: InitialSetupPromptBag): ReturnType<typeof useActionGate> {
  return useActionGate(
    bag.displayName.enabled && bag.displayName.value.trim().length === 0
      ? actionBlocked(PROFILES_I18N_KEYS.initialSetupNameRequired)
      : actionAvailable()
  );
}

function ModalBody(props: { bag: InitialSetupPromptBag }): ReactElement {
  const t = useT();
  const languages = useLanguages();
  const { bag } = props;
  const catalogue = loadStateFromQuery(languages);

  if (bag.isLoading) {
    return <Spin data-testid="initial-setup-loading" />;
  }

  return (
    <Flex vertical gap={spacing[5]}>
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
            style={SEGMENTED_TRACK}
            options={[
              { value: "light", label: t(PROFILES_I18N_KEYS.themeLight) },
              { value: "dark", label: t(PROFILES_I18N_KEYS.themeDark) },
              { value: "system", label: t(PROFILES_I18N_KEYS.themeSystem) },
            ]}
          />
        </SettingRow>
      )}

      {bag.language.enabled &&
        matchList(catalogue, {
          loading: () => <Spin data-testid="initial-setup-languages-loading" />,
          failed: (error) => (
            <ErrorAlert thrown={error} testId="initial-setup-languages-failed" />
          ),
          // Nothing to pick, and nothing broken — first run goes on without
          // the row rather than showing an empty dropdown.
          empty: () => null,
          ready: (options) => (
            <SettingRow label={t(PROFILES_I18N_KEYS.fieldAppLanguage)}>
              <Select<string>
                value={bag.language.value.length > 0 ? bag.language.value : null}
                onChange={(v) => bag.language.set(v)}
                style={{ width: "100%" }}
                options={options.map((l) => ({
                  value: l.code,
                  label: `${l.name} (${l.code.toUpperCase()})`,
                }))}
              />
            </SettingRow>
          ),
        })}

      <ErrorAlert thrown={bag.isError ? bag.error : undefined} />
    </Flex>
  );
}

/**
 * The actions, as the dialog's FOOTER rather than the last thing in its body.
 *
 * A sheet is a scrolling box with a fixed height, so anything at the bottom of
 * its content is below the fold until you scroll — and the visual pass caught
 * exactly that: first run cut off at "App language" with no Continue visible
 * anywhere on the screen. antd pins a Drawer's `footer` outside the scrolling
 * body and a Modal's below it, so moving the row here puts the primary action
 * on screen at 390px without either surface having to know it did.
 */
function ModalFooter(props: {
  bag: InitialSetupPromptBag;
  skippable: boolean;
}): ReactElement | null {
  const t = useT();
  const { bag } = props;
  const submitGate = useSubmitGate(bag);
  if (bag.isLoading) return null;

  return (
    <Flex gap={spacing[2]} justify="flex-end" align="center" wrap="wrap">
      {/* A switched-off control must say why, as TEXT: a disabled button
          gets no pointer events, so a tooltip on it is a reason nobody can
          read (@stapel/core actionGate.ts). */}
      {submitGate.reason && (
        <Typography.Text
          type="secondary"
          data-testid="initial-setup-submit-reason"
          style={{ marginRight: "auto" }}
        >
          {submitGate.reason}
        </Typography.Text>
      )}
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
        disabled={submitGate.disabled || bag.isSaving}
        data-analytics="none"
        data-analytics-reason="business action (a plain PATCH, no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
      >
        {bag.isSaving
          ? t(PROFILES_I18N_KEYS.initialSetupSaving)
          : t(PROFILES_I18N_KEYS.initialSetupSave)}
      </Button>
    </Flex>
  );
}

export function InitialSetupModal(props: InitialSetupModalProps): ReactElement {
  const t = useT();
  const skippable = props.skippable ?? true;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <InitialSetupPrompt
        {...(props.fields !== undefined ? { fields: props.fields } : {})}
        onSubmitted={(profile) => {
          props.onSubmitted?.(profile);
          props.onClose?.();
        }}
        onSkip={() => props.onClose?.()}
      >
        {(bag) => (
          <SkinDialog
            open={props.open}
            title={t(PROFILES_I18N_KEYS.initialSetupTitle)}
            dismissLabel={t(PROFILES_I18N_KEYS.actionClose)}
            // Blocking mode draws NO way out — not an inert one. `dismissible`
            // turns off the close button, the grab handle, Esc and the mask
            // together, so Save is visibly the only exit. (It is a prop on the
            // shared skin rather than a branch here: re-taking the surface
            // decision per component is what the fleet rule exists to stop.)
            dismissible={skippable}
            onClose={() => {
              // ✕ / Esc / mask / swipe — an implicit skip: record it like the
              // button does. Unreachable in blocking mode, where no dismissal
              // affordance is drawn at all; kept as the belt to that braces.
              if (!skippable) return;
              bag.skip();
            }}
            footer={<ModalFooter bag={bag} skippable={skippable} />}
            destroyOnHidden
          >
            <ModalBody bag={bag} />
          </SkinDialog>
        )}
      </InitialSetupPrompt>
    </SkinTheme>
  );
}
