/**
 * `<LanguageSettings/>` — default skin for the "language" settings screen
 * (owner directive: language/locale is a settings surface in its own right,
 * split out from `<ProfileSettings/>` per the brief). Built on this pair's
 * EXISTING hooks (`useLanguages`, `useMyProfile`, `useUpdateMyProfile`) — no
 * new backend surface.
 *
 * INTERACTION CANON (owner UX audit 2026-07-17, point 5 +
 * `docs/pending/frontend-guidelines.md` §8): "Auto" is the FIRST item of the
 * app-language picker itself (not a separate switch next to it) — picking
 * it PATCHes `use_device_language: true`; picking an actual language PATCHes
 * `app_language: <code>, use_device_language: false`. Every pick applies
 * REACTIVELY (no "Save" button) — `useUpdateMyProfile` is itself optimistic
 * and rolls back on failure. The "languages you understand" checklist is
 * reactive the same way: each toggle PATCHes immediately. Reloading
 * translations for the newly picked language is still the HOST's job (see
 * `onSaved`), not this pair's.
 */
import { spacing } from "@stapel/tokens";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Card, Checkbox, Select, Spin, Typography } from "antd";
import { ErrorAlert, EmptyState, LoadList, SkinTheme } from "@stapel/tokens-antd/skin";
import type { SkinSurface } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { loadStateFromQuery, useT } from "@stapel/core";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useLanguages } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { SettingRow } from "./parts.js";

const AUTO = "auto";

/** The settings measure: one column of controls, comfortable to read, sized
 * in `rem` so it follows the root type rather than pinning a pixel box. */
export const SETTINGS_MAX_WIDTH = "30rem";

export interface LanguageSettingsProps {
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
  /**
   * What the theme root paints. Default `"bare"` — this component draws its
   * own antd `Card`. `"base"` when it is mounted as a page of its own (the
   * `profiles.language` route).
   */
  readonly surface?: SkinSurface;
  /** Called after a successfully-applied pick with the newly picked app
   * language code — the hook the host uses to reload its i18n engine (e.g.
   * `loadTranslations(code)`, stapel-translate-driven). Not called when
   * "Auto" was picked (there is no fixed code to reload with) or when the
   * app language didn't change. */
  onSaved?(appLanguageCode: string): void;
}

export function LanguageSettings(props: LanguageSettingsProps): ReactElement {
  const t = useT();
  const query = useMyProfile();
  const languages = useLanguages();
  const mutation = useUpdateMyProfile();

  const profile = query.data;
  const [appLanguage, setAppLanguage] = useState("en");
  const [useDeviceLanguage, setUseDeviceLanguage] = useState(false);
  const [understands, setUnderstands] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setAppLanguage(profile.app_language?.code ?? "en");
    setUseDeviceLanguage(profile.use_device_language ?? false);
    setUnderstands(profile.understands ?? []);
  }, [profile]);

  function pickAppLanguage(value: string): void {
    const previous = profile?.app_language?.code;
    if (value === AUTO) {
      setUseDeviceLanguage(true);
      mutation.mutate({ use_device_language: true });
      return;
    }
    setUseDeviceLanguage(false);
    setAppLanguage(value);
    mutation.mutate(
      { app_language: value, use_device_language: false },
      {
        onSuccess: () => {
          if (value !== previous) props.onSaved?.(value);
        },
      }
    );
  }

  function toggleUnderstands(next: string[]): void {
    setUnderstands(next);
    mutation.mutate({ understands: next });
  }

  if (query.isLoading && !profile) {
    return (
      <SkinTheme
        surface={props.surface ?? "bare"}
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
      >
        <Spin data-testid="language-settings-loading" />
      </SkinTheme>
    );
  }

  // The catalogue is what BOTH rows are made of, so both live inside one
  // `matchList`: a picker built out of a failed read used to look like a
  // working control offering a single raw language code, and the
  // "languages you understand" block simply vanished (owner ruling
  // 2026-08-09 — the absence of a result is not a result).
  const catalogue = loadStateFromQuery(languages);
  const pickerValue = useDeviceLanguage ? AUTO : appLanguage;

  return (
    <SkinTheme
      surface={props.surface ?? "bare"}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Card data-testid="language-settings" style={{ width: "100%" }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {t(PROFILES_I18N_KEYS.languageTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.languageSubtitle)}</Typography.Text>

        <div
          style={{
            display: "grid",
            gap: spacing[3],
            maxWidth: SETTINGS_MAX_WIDTH,
            marginTop: spacing[4],
          }}
        >
          <LoadList
            state={catalogue}
            onRetry={() => {
              void languages.refetch();
            }}
            testId="language-catalogue"
            empty={
              <EmptyState
                compact
                title={t(PROFILES_I18N_KEYS.languagesEmpty)}
                testId="language-catalogue-empty-state"
              />
            }
          >
            {(options) => (
              <>
                <SettingRow label={t(PROFILES_I18N_KEYS.fieldAppLanguage)}>
                  <Select<string>
                    value={pickerValue}
                    onChange={pickAppLanguage}
                    style={{ width: "100%" }}
                    aria-label={t(PROFILES_I18N_KEYS.fieldAppLanguage)}
                    options={[
                      { value: AUTO, label: t(PROFILES_I18N_KEYS.languageAuto) },
                      ...options.map((l) => ({
                        value: l.code,
                        label: `${l.name} (${l.code.toUpperCase()})`,
                      })),
                    ]}
                  />
                </SettingRow>

                <SettingRow label={t(PROFILES_I18N_KEYS.fieldUnderstands)}>
                  <Checkbox.Group
                    value={understands}
                    onChange={(v) => toggleUnderstands(v as string[])}
                    options={options.map((l) => ({ value: l.code, label: l.name }))}
                  />
                </SettingRow>
              </>
            )}
          </LoadList>
        </div>

        <ErrorAlert
          thrown={mutation.error}
          style={{ marginTop: spacing[3] }}
          testId="language-settings-error"
        />
      </Card>
    </SkinTheme>
  );
}
