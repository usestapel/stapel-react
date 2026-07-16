/**
 * `<LanguageSettings/>` — default skin for the "language" settings screen
 * (owner directive: language/locale is a settings surface in its own right,
 * split out from `<ProfileSettings/>` per the brief). Built on this pair's
 * EXISTING hooks (`useLanguages`, `useMyProfile`, `useUpdateMyProfile`) — no
 * new backend surface. UX (app-language picker + "use device language" +
 * understood-languages checklist) is informed by ironmemo's `ProfilePage`
 * language picker, not copied from it; reloading translations for the newly
 * picked language is the HOST's job (see `onSaved`), not this pair's — a
 * headless pair doesn't know which i18n loader (e.g. stapel-translate) the
 * host wired up.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Card, Checkbox, Select, Spin, Switch, Typography } from "antd";
import { useT } from "@stapel/core";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useLanguages } from "../model/queries.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

export interface LanguageSettingsProps {
  /** Called after a successful save with the newly picked app language code —
   * the hook the host uses to reload its i18n engine (e.g.
   * `loadTranslations(code)`, stapel-translate-driven). Not called when the
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

  function handleSave(): void {
    const previous = profile?.app_language?.code;
    mutation.mutate(
      {
        app_language: appLanguage,
        use_device_language: useDeviceLanguage,
        understands,
      },
      {
        onSuccess: () => {
          if (appLanguage !== previous) props.onSaved?.(appLanguage);
        },
      }
    );
  }

  if (query.isLoading && !profile) {
    return <Spin data-testid="language-settings-loading" />;
  }

  const options = languages.data ?? [];

  return (
    <Card data-testid="language-settings">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(PROFILES_I18N_KEYS.languageTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.languageSubtitle)}</Typography.Text>

      <div style={{ display: "grid", gap: 12, maxWidth: 480, marginTop: 16 }}>
        <div>
          <Typography.Text>{t(PROFILES_I18N_KEYS.fieldAppLanguage)}</Typography.Text>
          <Select<string>
            value={appLanguage}
            onChange={(v) => setAppLanguage(v)}
            disabled={useDeviceLanguage}
            style={{ width: "100%" }}
            options={
              options.length > 0
                ? options.map((l) => ({ value: l.code, label: `${l.name} (${l.code.toUpperCase()})` }))
                : [{ value: appLanguage, label: appLanguage.toUpperCase() }]
            }
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Switch checked={useDeviceLanguage} onChange={setUseDeviceLanguage} />
          <Typography.Text>{t(PROFILES_I18N_KEYS.fieldUseDeviceLanguage)}</Typography.Text>
        </div>

        {options.length > 0 && (
          <div>
            <Typography.Text>{t(PROFILES_I18N_KEYS.fieldUnderstands)}</Typography.Text>
            <div>
              <Checkbox.Group
                value={understands}
                onChange={(v) => setUnderstands(v as string[])}
                options={options.map((l) => ({ value: l.code, label: l.name }))}
              />
            </div>
          </div>
        )}
      </div>

      {mutation.error && (
        <Alert style={{ marginTop: 12 }} type="error" showIcon message={mutation.error.message} />
      )}

      <Button
        type="primary"
        style={{ marginTop: 16 }}
        loading={mutation.isPending}
        onClick={handleSave}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
      >
        {mutation.isPending ? t(PROFILES_I18N_KEYS.profileSaving) : t(PROFILES_I18N_KEYS.profileSave)}
      </Button>
    </Card>
  );
}
