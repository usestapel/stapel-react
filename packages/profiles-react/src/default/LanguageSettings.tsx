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
import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Card, Checkbox, ConfigProvider, Select, Spin, Typography } from "antd";
import { toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useLanguages } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

const AUTO = "auto";

export interface LanguageSettingsProps {
  /**
   * Light or dark. The theme is derived from `@stapel/tokens` via
   * `toAntdThemeConfig(mode)` — no manual token wiring, same self-theming
   * contract as `AuthPanel`. Default `"light"`.
   */
  readonly mode?: ThemeMode;
  /** Called after a successfully-applied pick with the newly picked app
   * language code — the hook the host uses to reload its i18n engine (e.g.
   * `loadTranslations(code)`, stapel-translate-driven). Not called when
   * "Auto" was picked (there is no fixed code to reload with) or when the
   * app language didn't change. */
  onSaved?(appLanguageCode: string): void;
}

export function LanguageSettings(props: LanguageSettingsProps): ReactElement {
  const t = useT();
  const theme = useMemo(() => toAntdThemeConfig(props.mode ?? "light"), [props.mode]);
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
      <ConfigProvider theme={theme}>
        <Spin data-testid="language-settings-loading" />
      </ConfigProvider>
    );
  }

  const options = languages.data ?? [];
  const pickerValue = useDeviceLanguage ? AUTO : appLanguage;
  const mutationErrorText = mutation.isError ? mutation.error.message : undefined;

  return (
    <ConfigProvider theme={theme}>
      <Card data-testid="language-settings">
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {t(PROFILES_I18N_KEYS.languageTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.languageSubtitle)}</Typography.Text>

        <div style={{ display: "grid", gap: 12, maxWidth: 480, marginTop: 16 }}>
          <div>
            <Typography.Text>{t(PROFILES_I18N_KEYS.fieldAppLanguage)}</Typography.Text>
            <Select<string>
              value={pickerValue}
              onChange={pickAppLanguage}
              style={{ width: "100%" }}
              options={[
                { value: AUTO, label: t(PROFILES_I18N_KEYS.languageAuto) },
                ...(options.length > 0
                  ? options.map((l) => ({ value: l.code, label: `${l.name} (${l.code.toUpperCase()})` }))
                  : [{ value: appLanguage, label: appLanguage.toUpperCase() }]),
              ]}
            />
          </div>

          {options.length > 0 && (
            <div>
              <Typography.Text>{t(PROFILES_I18N_KEYS.fieldUnderstands)}</Typography.Text>
              <div>
                <Checkbox.Group
                  value={understands}
                  onChange={(v) => toggleUnderstands(v as string[])}
                  options={options.map((l) => ({ value: l.code, label: l.name }))}
                />
              </div>
            </div>
          )}
        </div>

        {mutationErrorText && (
          <Alert style={{ marginTop: 12 }} type="error" showIcon message={mutationErrorText} />
        )}
      </Card>
    </ConfigProvider>
  );
}
