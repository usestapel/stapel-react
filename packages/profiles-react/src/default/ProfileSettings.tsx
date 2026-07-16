/**
 * `<ProfileSettings/>` — default skin for the "profile" settings screen
 * (owner directive: "затащить в либу компоненты настроек", ironmemo
 * `pages/app/profile.tsx`'s Account+Preferences cards, minus the security
 * surfaces auth-react/default owns). Built entirely on this pair's EXISTING
 * hooks (`useMyProfile`, `useUpdateMyProfile`) plus the documented
 * {@link useAvatarUpload} stopgap — no new backend surface. UX shape (avatar
 * + name + currency/units/theme in one card, a single Save) is an original
 * implementation informed by ironmemo's `ProfilePage`, not copied from it.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Alert, Avatar, Button, Card, Input, Select, Spin, Typography } from "antd";
import { useT } from "@stapel/core";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useAvatarUpload } from "../headless/AvatarUpload.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";

/** A business-action click with no flow machine behind it (a plain PATCH).
 * Marking it `data-analytics="none"` (not `tracked()`) is the architectural
 * choice, not an oversight: `@stapel/analytics` is deliberately NOT a runtime
 * dependency of any `@stapel/*-react` pair (only auth-react's tests reach for
 * it, as a devDependency) — a pair threads the `Analytics` TYPE seam through
 * `@stapel/core` context and leaves `defineEvent`/`tracked()` wiring to the
 * HOST app, which already owns its own event catalog. */
export interface ProfileSettingsProps {
  /**
   * Resolve a stored `avatar` CDN reference (`"<type>/<hash>"`) to a
   * displayable URL. The reference alone isn't a URL — the CDN host/base is
   * deployment-specific (see `useAvatarUpload`'s module doc). Omit to show
   * only the initials fallback until the caller uploads a new avatar (whose
   * preview URL comes back absolute from the server, no resolver needed).
   */
  avatarUrlFor?(ref: string): string;
}

type Units = "metric" | "imperial";
type Theme = "light" | "dark" | "system";

const CURRENCIES = ["USD", "EUR", "GBP", "RUB"] as const;

export function ProfileSettings(props: ProfileSettingsProps): ReactElement {
  const t = useT();
  const query = useMyProfile();
  const mutation = useUpdateMyProfile();
  const avatarUpload = useAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profile = query.data;
  const [displayName, setDisplayName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [units, setUnits] = useState<Units>("metric");
  const [theme, setTheme] = useState<Theme>("system");
  const [pendingAvatarRef, setPendingAvatarRef] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setCurrencyCode(profile.currency_code ?? "USD");
    setUnits(profile.measurement_units === "imperial" ? "imperial" : "metric");
    setTheme(
      profile.theme === "light" || profile.theme === "dark" ? profile.theme : "system"
    );
  }, [profile]);

  async function handleAvatarPick(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ref = await avatarUpload.upload(file);
    if (ref) setPendingAvatarRef(ref);
  }

  function handleSave(): void {
    mutation.mutate({
      display_name: displayName.trim(),
      currency_code: currencyCode,
      measurement_units: units,
      theme,
      ...(pendingAvatarRef ? { avatar: pendingAvatarRef } : {}),
    });
  }

  const avatarSrc =
    avatarUpload.previewUrl ??
    avatarUpload.uploadedUrl ??
    (profile?.avatar && props.avatarUrlFor ? props.avatarUrlFor(profile.avatar) : undefined);

  if (query.isLoading && !profile) {
    return <Spin data-testid="profile-settings-loading" />;
  }

  return (
    <Card data-testid="profile-settings">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(PROFILES_I18N_KEYS.settingsTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.settingsSubtitle)}</Typography.Text>

      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
        <Avatar size={64} src={avatarSrc}>
          {displayName.slice(0, 2).toUpperCase() || "?"}
        </Avatar>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              void handleAvatarPick(e);
            }}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            loading={avatarUpload.isUploading}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
          >
            {avatarUpload.isUploading
              ? t(PROFILES_I18N_KEYS.avatarUploading)
              : t(PROFILES_I18N_KEYS.avatarChange)}
          </Button>
          {avatarUpload.isError && (
            <div>
              <Typography.Text type="danger">
                {t(PROFILES_I18N_KEYS.avatarUploadError)}
              </Typography.Text>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <div>
          <Typography.Text>{t(PROFILES_I18N_KEYS.fieldDisplayName)}</Typography.Text>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div>
            <Typography.Text>{t(PROFILES_I18N_KEYS.fieldCurrency)}</Typography.Text>
            <Select<string>
              value={currencyCode}
              onChange={(v) => setCurrencyCode(v)}
              style={{ width: "100%" }}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <Typography.Text>{t(PROFILES_I18N_KEYS.fieldUnits)}</Typography.Text>
            <Select<Units>
              value={units}
              onChange={(v) => setUnits(v)}
              style={{ width: "100%" }}
              options={[
                { value: "metric", label: t(PROFILES_I18N_KEYS.unitsMetric) },
                { value: "imperial", label: t(PROFILES_I18N_KEYS.unitsImperial) },
              ]}
            />
          </div>
          <div>
            <Typography.Text>{t(PROFILES_I18N_KEYS.fieldTheme)}</Typography.Text>
            <Select<Theme>
              value={theme}
              onChange={(v) => setTheme(v)}
              style={{ width: "100%" }}
              options={[
                { value: "light", label: t(PROFILES_I18N_KEYS.themeLight) },
                { value: "dark", label: t(PROFILES_I18N_KEYS.themeDark) },
                { value: "system", label: t(PROFILES_I18N_KEYS.themeSystem) },
              ]}
            />
          </div>
        </div>
      </div>

      {mutation.error && (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          message={mutation.error.message}
        />
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
