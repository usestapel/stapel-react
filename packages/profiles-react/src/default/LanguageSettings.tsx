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
import { Button, Card, Checkbox, ConfigProvider, Select, Spin, Typography } from "antd";
import { resolveThemeMode, toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { loadStateFromQuery, matchList, useErrorDisplay, useT } from "@stapel/core";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useLanguages } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";

const AUTO = "auto";

export interface LanguageSettingsProps {
  /**
   * Light or dark. The theme is derived from `@stapel/tokens` via
   * `toAntdThemeConfig(mode)` — no manual token wiring, same self-theming
   * contract as `AuthPanel`. Defaults to the mode the HOST's document
   * declares (`resolveThemeMode()` — the `data-theme` attribute
   * `@stapel/tokens`' `tokens.css` keys its dark block on), not to a
   * hardcoded `"light"`: a light default is a wrong answer on every dark
   * deployment, and it rendered an unreadable error Alert on a live sandbox
   * (owner report 2026-08-09 — antd's light algorithm derived a near-white
   * `colorErrorBg` while `colorText` came live off the host's dark tokens).
   * Pass it explicitly to pin a side.
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
  // See ProfileSettings: never the raw `.message` (owner report 2026-08-09).
  const errorDisplay = useErrorDisplay(PROFILES_I18N_KEYS.unknownError);
  const theme = useMemo(() => toAntdThemeConfig(props.mode ?? resolveThemeMode()), [props.mode]);
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

  // The catalogue is what BOTH rows are made of, so both live inside one
  // `matchList`: a picker built out of a failed read used to look like a
  // working control offering a single raw language code, and the
  // "languages you understand" block simply vanished (owner ruling
  // 2026-08-09 — the absence of a result is not a result).
  const catalogue = loadStateFromQuery(languages);
  const pickerValue = useDeviceLanguage ? AUTO : appLanguage;
  const mutationError = errorDisplay(mutation.error);

  return (
    <ConfigProvider theme={theme}>
      <Card data-testid="language-settings">
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {t(PROFILES_I18N_KEYS.languageTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.languageSubtitle)}</Typography.Text>

        <div style={{ display: "grid", gap: 12, maxWidth: 480, marginTop: 16 }}>
          {matchList(catalogue, {
            loading: () => <Spin data-testid="language-catalogue-loading" />,
            failed: (error) => (
              <div data-testid="language-catalogue-failed">
                <ErrorAlert error={errorDisplay(error)} />
                <Button
                  onClick={() => {
                    void languages.refetch();
                  }}
                  style={{ marginTop: 8 }}
                  data-analytics="none"
                  data-analytics-reason="retry of a failed read (no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
                >
                  {t(PROFILES_I18N_KEYS.actionRetry)}
                </Button>
              </div>
            ),
            empty: () => (
              <Typography.Text type="secondary" data-testid="language-catalogue-empty">
                {t(PROFILES_I18N_KEYS.languagesEmpty)}
              </Typography.Text>
            ),
            ready: (options) => (
              <>
                <div>
                  <Typography.Text>{t(PROFILES_I18N_KEYS.fieldAppLanguage)}</Typography.Text>
                  <Select<string>
                    value={pickerValue}
                    onChange={pickAppLanguage}
                    style={{ width: "100%" }}
                    options={[
                      { value: AUTO, label: t(PROFILES_I18N_KEYS.languageAuto) },
                      ...options.map((l) => ({
                        value: l.code,
                        label: `${l.name} (${l.code.toUpperCase()})`,
                      })),
                    ]}
                  />
                </div>

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
              </>
            ),
          })}
        </div>

        <ErrorAlert error={mutationError} style={{ marginTop: 12 }} />
      </Card>
    </ConfigProvider>
  );
}
