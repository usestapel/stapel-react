/**
 * `<ProfileSettings/>` — default skin for the "profile" settings screen
 * (owner directive: "затащить в либу компоненты настроек", ironmemo
 * `pages/app/profile.tsx`'s Account+Preferences cards, minus the security
 * surfaces auth-react/default owns). Built entirely on this pair's EXISTING
 * hooks (`useMyProfile`, `useUpdateMyProfile`) plus the documented
 * {@link useAvatarUpload} stopgap — no new backend surface. UX shape (avatar
 * + name + currency/theme in one card) is an original implementation
 * informed by ironmemo's `ProfilePage`, not copied from it.
 *
 * INTERACTION CANON (owner UX audit 2026-07-17; codified in
 * `docs/pending/frontend-guidelines.md` §8 "Интеракции настроек"):
 *  - PICKERS (currency/theme/units) apply REACTIVELY — no "Save" button.
 *    Every `Select.onChange` fires the PATCH immediately; `useUpdateMyProfile`
 *    itself is optimistic (cache updates before the round trip lands) and
 *    rolls back on failure, so a rejected pick visibly snaps back.
 *  - TEXT FIELDS (display name) render read-only with an edit affordance;
 *    clicking it opens a `Modal` (desktop) / bottom `Drawer` (phone,
 *    `useBreakpoint`) to edit + save, instead of an inline `Input` sitting in
 *    a batched form.
 * There is no longer a single "Save changes" button for this screen — every
 * field commits on its own.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import { Alert, Avatar, Button, Card, Drawer, Flex, Input, Modal, Segmented, Select, Spin, Typography } from "antd";
import { useBreakpoint, useT } from "@stapel/core";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useAvatarUpload } from "../headless/AvatarUpload.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { EditPencilIcon } from "./icons.js";

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
  /**
   * Render the measurement-units (metric/imperial) picker. Default `false`
   * (owner directive point 2, 2026-07-17): units only matter to
   * convertible catalog attributes — that belongs in projection/catalog UI,
   * not a personal-profile screen, and the default skin no longer renders
   * it. The field stays in the backend contract (`measurement_units` is
   * still readable/writable via `useMyProfile`/`useUpdateMyProfile`
   * directly) for a host that has an actual reason to show it here.
   */
  showUnits?: boolean;
}

type Units = "metric" | "imperial";
type Theme = "light" | "dark" | "system";

const CURRENCIES = ["USD", "EUR", "GBP", "RUB"] as const;

/**
 * One setting per row (owner UX audit 2026-07-17 — folded into
 * `docs/pending/frontend-guidelines.md` §8): a subtitle-style label ABOVE
 * its own picker, stacked top to bottom — never several pickers crammed
 * side by side into one row. Every row in this screen uses this wrapper.
 */
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

/**
 * A read-only text row with an edit affordance (owner UX audit 2026-07-17,
 * "Интеракции настроек" canon): click the pencil to open a `Modal`
 * (desktop) / bottom `Drawer` (phone) with the value editable, instead of a
 * bare `Input` sitting inline in a batched form.
 */
function EditableTextRow(props: {
  label: string;
  value: string;
  saveCta: string;
  saving: boolean;
  errorText?: string | undefined;
  onSave: (next: string) => void;
}): ReactElement {
  const isPhone = useBreakpoint() === "phone";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.value);

  function openEditor(): void {
    setDraft(props.value);
    setOpen(true);
  }

  function commit(): void {
    props.onSave(draft.trim());
  }

  // Close the dialog once a save actually lands (not on every keystroke —
  // only when the mutation stops being in flight AND didn't error).
  useEffect(() => {
    if (open && !props.saving && !props.errorText && draft.trim() === props.value) {
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately re-runs only on `saving` edge (see comment above), not on every `draft`/`value` change
  }, [props.saving]);

  const body: ReactNode = (
    <Flex vertical gap="middle">
      {props.errorText && <Alert type="error" showIcon message={props.errorText} />}
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={commit}
        disabled={props.saving}
      />
      <Button type="primary" onClick={commit} loading={props.saving} data-analytics="flow">
        {props.saveCta}
      </Button>
    </Flex>
  );

  return (
    <div>
      <Typography.Text>{props.label}</Typography.Text>
      <Flex align="center" gap={8}>
        <Typography.Text strong data-testid="profile-display-name-value">
          {props.value || "—"}
        </Typography.Text>
        <Button
          type="text"
          size="small"
          icon={<EditPencilIcon />}
          aria-label={props.label}
          onClick={openEditor}
          data-analytics="none"
          data-analytics-reason="local-ui-open-edit-dialog"
        />
      </Flex>
      {isPhone ? (
        <Drawer open={open} title={props.label} onClose={() => setOpen(false)} placement="bottom" size="large" destroyOnHidden>
          {body}
        </Drawer>
      ) : (
        <Modal open={open} title={props.label} onCancel={() => setOpen(false)} footer={null} destroyOnHidden>
          {body}
        </Modal>
      )}
    </div>
  );
}

export function ProfileSettings(props: ProfileSettingsProps): ReactElement {
  const t = useT();
  const query = useMyProfile();
  const mutation = useUpdateMyProfile();
  const avatarUpload = useAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profile = query.data;
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [units, setUnits] = useState<Units>("metric");
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    if (!profile) return;
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
    if (ref) mutation.mutate({ avatar: ref });
  }

  const avatarSrc =
    avatarUpload.previewUrl ??
    avatarUpload.uploadedUrl ??
    (profile?.avatar && props.avatarUrlFor ? props.avatarUrlFor(profile.avatar) : undefined);

  if (query.isLoading && !profile) {
    return <Spin data-testid="profile-settings-loading" />;
  }

  const mutationErrorText = mutation.isError ? mutation.error.message : undefined;

  return (
    <Card data-testid="profile-settings">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(PROFILES_I18N_KEYS.settingsTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.settingsSubtitle)}</Typography.Text>

      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
        <Avatar size={64} src={avatarSrc}>
          {(profile?.display_name ?? "").slice(0, 2).toUpperCase() || "?"}
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

      <Flex vertical gap={20} style={{ maxWidth: 480 }}>
        <EditableTextRow
          label={t(PROFILES_I18N_KEYS.fieldDisplayName)}
          value={profile?.display_name ?? ""}
          saveCta={t(PROFILES_I18N_KEYS.profileSave)}
          saving={mutation.isPending}
          errorText={mutationErrorText}
          onSave={(next) => mutation.mutate({ display_name: next })}
        />

        <SettingRow label={t(PROFILES_I18N_KEYS.fieldCurrency)}>
          <Select<string>
            value={currencyCode}
            onChange={(v) => {
              setCurrencyCode(v);
              mutation.mutate({ currency_code: v });
            }}
            style={{ width: "100%" }}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </SettingRow>

        {props.showUnits && (
          <SettingRow label={t(PROFILES_I18N_KEYS.fieldUnits)}>
            <Segmented<Units>
              value={units}
              onChange={(v) => {
                setUnits(v);
                mutation.mutate({ measurement_units: v });
              }}
              block
              options={[
                { value: "metric", label: t(PROFILES_I18N_KEYS.unitsMetric) },
                { value: "imperial", label: t(PROFILES_I18N_KEYS.unitsImperial) },
              ]}
            />
          </SettingRow>
        )}

        <SettingRow label={t(PROFILES_I18N_KEYS.fieldTheme)}>
          <Segmented<Theme>
            value={theme}
            onChange={(v) => {
              setTheme(v);
              mutation.mutate({ theme: v });
            }}
            block
            options={[
              { value: "light", label: t(PROFILES_I18N_KEYS.themeLight) },
              { value: "dark", label: t(PROFILES_I18N_KEYS.themeDark) },
              { value: "system", label: t(PROFILES_I18N_KEYS.themeSystem) },
            ]}
          />
        </SettingRow>
      </Flex>

      {mutationErrorText && (
        <Alert style={{ marginTop: 12 }} type="error" showIcon message={mutationErrorText} />
      )}
    </Card>
  );
}
