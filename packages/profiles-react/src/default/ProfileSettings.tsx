/**
 * `<ProfileSettings/>` — default skin for the "profile" settings screen
 * (owner directive: "затащить в либу компоненты настроек", ironmemo
 * `pages/app/profile.tsx`'s Account+Preferences cards, minus the security
 * surfaces auth-react/default owns). Built entirely on this pair's EXISTING
 * hooks (`useMyProfile`, `useUpdateMyProfile`, `useAvatarUpload`) plus the
 * NEW {@link useProfileFieldManifest} — no new backend surface beyond the
 * field-manifest endpoint itself.
 *
 * DATA-DRIVEN (§66 "Дополнение владельца" tier 1, `docs/pending/
 * profile-fields.md`): `stapel-profiles` 0.5.0 shrank the hard `Profile`
 * model to a core every project needs (avatar, language, notifications,
 * onboarding, consent) and moved identity/theme/currency/measurement_units
 * out into a per-project STANDARD_FIELDS/custom_fields manifest a host may
 * or may not select. This skin no longer hardcodes ANY of those fields — it
 * renders one row per `GET /field-manifest` entry, widget picked by
 * `entry.kind`, so a host's manifest selection is reflected here with zero
 * frontend code changes. The avatar block below stays hardcoded because
 * avatar IS part of the hard core (never absent, no manifest entry for it).
 *
 * INTERACTION CANON (owner UX audit 2026-07-17; codified in
 * `docs/pending/frontend-guidelines.md` §8 "Интеракции настроек", extended
 * to the data-driven skin by kind):
 *  - `bool` → a `Switch`, applies REACTIVELY (no "Save" button).
 *  - `enum` → a reactive `Segmented` when there are few choices (reads like
 *    the pre-manifest theme picker), else a reactive `Select` for a longer
 *    choice list.
 *  - `model_ref` → a reactive `Select`. The only model_ref field this pair
 *    ships an options source for today is `currency_code` (see
 *    `MODEL_REF_OPTIONS` below — `stapel-currencies` is a live DB catalog,
 *    not a fixed enum, and this pair carries no currencies-react dependency
 *    to fetch it); an unrecognized model_ref falls back to a text edit so
 *    the field stays usable rather than silently disappearing.
 *  - `text` (and `geohash`, a raw string) → read-only with an edit
 *    affordance; clicking it opens a `Modal` (desktop) / bottom `Drawer`
 *    (phone, `useBreakpoint`) to edit + save, instead of an inline `Input`
 *    sitting in a batched form.
 *  - `geohash` is HIDDEN by default (`showGeohash` opts in) — a raw geohash
 *    string is not a friendly settings row on its own.
 * `useUpdateMyProfile` is itself optimistic (cache updates before the round
 * trip lands) and rolls back on failure, so a rejected pick visibly snaps
 * back. There is no single "Save changes" button for this screen — every
 * field commits on its own.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Drawer,
  Flex,
  Input,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Typography,
} from "antd";
import { useBreakpoint, useT } from "@stapel/core";
import { useMyProfile, useProfileFieldManifest } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useAvatarUpload } from "../headless/AvatarUpload.js";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { EditPencilIcon } from "./icons.js";
import type { MyProfile, ProfileFieldManifestEntry, ProfileUpdate } from "../api/types.js";

/**
 * `enum` fields with this many choices or fewer render as a `Segmented`
 * (reads like a tab strip — good for 2-4 options, e.g. the pre-manifest
 * theme picker's light/dark/system); more choices fall to a `Select`
 * dropdown instead of an ever-widening segmented control.
 */
const SEGMENTED_MAX_OPTIONS = 4;

/**
 * Options source for `model_ref` fields this skin knows how to render as a
 * picker. `stapel-currencies.Currency` is a live DB-backed catalog, not a
 * fixed enum (`docs/pending/profile-fields.md` §0) — this pair has no
 * currencies-react dependency to fetch it live, so `currency_code` gets the
 * same fixed contract list the pre-manifest skin hardcoded. A project with
 * a richer/different currency catalog gets it via the §66 tier-2 path (its
 * own regenerated typed client + its own skin for that one field), not by
 * forking this file.
 */
const MODEL_REF_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  currency_code: ["USD", "EUR", "GBP", "RUB"],
};

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
   * Render a `geohash`-kind manifest field, if the active manifest has one.
   * Default `false`: a raw geohash string (point-level proximity data, see
   * `docs/pending/profile-fields.md` §2) isn't a friendly personal-settings
   * row on its own — a host with an actual reason to expose/edit it here
   * opts in.
   */
  showGeohash?: boolean;
}

/**
 * One setting per row (owner UX audit 2026-07-17 — folded into
 * `docs/pending/frontend-guidelines.md` §8): a subtitle-style label ABOVE
 * its own picker, stacked top to bottom — never several pickers crammed
 * side by side into one row. Every row in this screen uses this wrapper.
 * The label text IS `entry.docstring` for manifest-driven rows — the
 * backend's field description doubles as the row's subtitle, so a custom
 * field a host adds to its manifest gets a readable label with zero
 * frontend translation work.
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
 * bare `Input` sitting inline in a batched form. Generic over any
 * manifest-supplied field name — `valueTestId` lets a caller give each row
 * a stable, per-field test selector.
 */
function EditableTextRow(props: {
  label: string;
  value: string;
  saveCta: string;
  saving: boolean;
  errorText?: string | undefined;
  valueTestId?: string | undefined;
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
        <Typography.Text strong {...(props.valueTestId ? { "data-testid": props.valueTestId } : {})}>
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

/**
 * One manifest entry rendered as its `kind`-appropriate widget. Reads the
 * current value off `profile[entry.name]` and writes back through
 * `onPatch({[entry.name]: value})` — both go through `MyProfile`/
 * `ProfileUpdate`'s open envelope (`api/types.ts`), so a field name the
 * pair's OWN generated schema never declares (an identity/standard/custom
 * field a host's manifest selected) still type-checks with no cast at the
 * call site.
 */
function FieldRow(props: {
  entry: ProfileFieldManifestEntry;
  profile: MyProfile | undefined;
  saveCta: string;
  saving: boolean;
  errorText?: string | undefined;
  onPatch: (patch: ProfileUpdate) => void;
}): ReactElement {
  const { entry, profile } = props;
  const rawValue = profile ? profile[entry.name] : undefined;

  switch (entry.kind) {
    case "bool":
      return (
        <SettingRow label={entry.docstring}>
          <Switch
            checked={Boolean(rawValue)}
            onChange={(checked) => props.onPatch({ [entry.name]: checked } as ProfileUpdate)}
          />
        </SettingRow>
      );

    case "enum": {
      const options = entry.enum_values ?? [];
      const value = typeof rawValue === "string" ? rawValue : (options[0] ?? "");
      if (options.length > 0 && options.length <= SEGMENTED_MAX_OPTIONS) {
        return (
          <SettingRow label={entry.docstring}>
            <Segmented<string>
              value={value}
              onChange={(v) => props.onPatch({ [entry.name]: v } as ProfileUpdate)}
              block
              options={options.map((o) => ({ value: o, label: o }))}
            />
          </SettingRow>
        );
      }
      return (
        <SettingRow label={entry.docstring}>
          <Select<string>
            value={value}
            onChange={(v) => props.onPatch({ [entry.name]: v } as ProfileUpdate)}
            style={{ width: "100%" }}
            options={options.map((o) => ({ value: o, label: o }))}
          />
        </SettingRow>
      );
    }

    case "model_ref": {
      const options = MODEL_REF_OPTIONS[entry.name];
      if (options) {
        const value = typeof rawValue === "string" ? rawValue : (options[0] ?? "");
        return (
          <SettingRow label={entry.docstring}>
            <Select<string>
              value={value}
              onChange={(v) => props.onPatch({ [entry.name]: v } as ProfileUpdate)}
              style={{ width: "100%" }}
              options={options.map((o) => ({ value: o, label: o }))}
            />
          </SettingRow>
        );
      }
      // No known options source for this model_ref — fall back to a text
      // edit rather than silently dropping the field.
      return (
        <EditableTextRow
          label={entry.docstring}
          value={typeof rawValue === "string" ? rawValue : ""}
          saveCta={props.saveCta}
          saving={props.saving}
          errorText={props.errorText}
          valueTestId={`profile-field-${entry.name}-value`}
          onSave={(next) => props.onPatch({ [entry.name]: next } as ProfileUpdate)}
        />
      );
    }

    case "text":
    case "geohash":
    default:
      return (
        <EditableTextRow
          label={entry.docstring}
          value={typeof rawValue === "string" ? rawValue : ""}
          saveCta={props.saveCta}
          saving={props.saving}
          errorText={props.errorText}
          valueTestId={`profile-field-${entry.name}-value`}
          onSave={(next) => props.onPatch({ [entry.name]: next } as ProfileUpdate)}
        />
      );
  }
}

export function ProfileSettings(props: ProfileSettingsProps): ReactElement {
  const t = useT();
  const query = useMyProfile();
  const manifest = useProfileFieldManifest();
  const mutation = useUpdateMyProfile();
  const avatarUpload = useAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profile = query.data;

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

  const avatarInitials =
    typeof profile?.["display_name"] === "string" && profile["display_name"]
      ? (profile["display_name"] as string).slice(0, 2).toUpperCase()
      : "?";

  if (query.isLoading && !profile) {
    return <Spin data-testid="profile-settings-loading" />;
  }

  const mutationErrorText = mutation.isError ? mutation.error.message : undefined;

  // Declaration order from the backend (identity, then standard_fields, then
  // custom_fields) IS the order to render in — `order` is carried mainly so
  // a consumer of the raw manifest can re-sort defensively; sort by it here
  // too rather than trust array order blindly.
  const entries = [...(manifest.data ?? [])].sort((a, b) => a.order - b.order);
  const visibleEntries = entries.filter((entry) => entry.kind !== "geohash" || props.showGeohash);

  return (
    <Card data-testid="profile-settings">
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        {t(PROFILES_I18N_KEYS.settingsTitle)}
      </Typography.Title>
      <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.settingsSubtitle)}</Typography.Text>

      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
        <Avatar size={64} src={avatarSrc}>
          {avatarInitials}
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
        {visibleEntries.map((entry) => (
          <FieldRow
            key={entry.name}
            entry={entry}
            profile={profile}
            saveCta={t(PROFILES_I18N_KEYS.profileSave)}
            saving={mutation.isPending}
            errorText={mutationErrorText}
            onPatch={(patch) => mutation.mutate(patch)}
          />
        ))}
      </Flex>

      {mutationErrorText && (
        <Alert style={{ marginTop: 12 }} type="error" showIcon message={mutationErrorText} />
      )}
    </Card>
  );
}
