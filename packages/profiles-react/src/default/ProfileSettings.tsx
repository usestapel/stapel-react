/**
 * `<ProfileSettings/>` — default skin for the "profile" settings screen
 * (owner directive: pull the settings components into the lib, ironmemo
 * `pages/app/profile.tsx`'s Account+Preferences cards, minus the security
 * surfaces auth-react/default owns). Built entirely on this pair's EXISTING
 * hooks (`useMyProfile`, `useUpdateMyProfile`, `useAvatarUpload`) plus the
 * NEW {@link useProfileFieldManifest} — no new backend surface beyond the
 * field-manifest endpoint itself.
 *
 * DATA-DRIVEN (§66 "Owner Addendum" tier 1, `docs/pending/
 * profile-fields.md`): `stapel-profiles` 0.5.0 shrank the hard `Profile`
 * model to a core every project needs (avatar, language, notifications,
 * onboarding, consent) and moved identity/theme/currency/measurement_units
 * out into a per-project STANDARD_FIELDS/custom_fields manifest a host may
 * or may not select. This skin renders one row per `GET /field-manifest`
 * entry, widget picked by `entry.kind`, so a host's manifest selection is
 * reflected here with zero frontend code changes. The avatar block stays
 * hardcoded because avatar IS part of the hard core (never absent, no
 * manifest entry for it) — and since stapel-profiles 0.7.0 (owner
 * 2026-07-22) `display_name` + `theme` moved BACK into that hard core, so
 * they render as fixed rows too, toggleable via `showDisplayName`/`showTheme`
 * and replaceable via `displayNameRow`/`themeRow` (owner: even the default
 * skin must let a host customize or disable them).
 *
 * INTERACTION CANON (owner UX audit 2026-07-17; codified in
 * `docs/pending/frontend-guidelines.md` §8 "Settings Interactions", extended
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
 *    affordance; clicking it opens a dialog to edit + save, instead of an
 *    inline `Input` sitting in a batched form. WHICH surface that dialog
 *    takes is no longer this skin's decision: `@stapel/tokens-antd/skin`'s
 *    `SkinDialog` states the fleet rule once — a bottom sheet on a phone, a
 *    centred modal on tablet/desktop (owner ruling 2026-08-24) — and every
 *    default skin inherits it. The hand-rolled `isPhone ? <Drawer> : <Modal>`
 *    branch this file used to carry is exactly what that rule replaced, and
 *    `stapel/no-bare-dialog` now fails lint on writing it again.
 *  - `geohash` is HIDDEN by default (`showGeohash` opts in) — a raw geohash
 *    string is not a friendly settings row on its own.
 * `useUpdateMyProfile` is itself optimistic (cache updates before the round
 * trip lands) and rolls back on failure, so a rejected pick visibly snaps
 * back. There is no single "Save changes" button for this screen — every
 * field commits on its own.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import {
  Avatar,
  Button,
  Card,
  ConfigProvider,
  Flex,
  Input,
  Segmented,
  Select,
  Spin,
  Switch,
  Typography,
} from "antd";
import { resolveThemeMode, toAntdThemeConfig } from "@stapel/tokens-antd";
import type { ThemeMode } from "@stapel/tokens-antd";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import {
  loadStateFromQuery,
  mapLoad,
  matchList,
  useErrorDisplay,
  useT,
} from "@stapel/core";
import type { FlowErrorDisplay } from "@stapel/core";
import { useMyProfile, useProfileFieldManifest } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { useSetAvatar } from "../headless/AvatarUpload.js";
import { Image } from "@stapel/image";
import type { StapelImage } from "@stapel/image";
import { PROFILES_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
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
  /**
   * Render the hard-core `display_name` row (stapel-profiles ≥0.7.0 put
   * display_name/theme back into the `ProfileCore` model — owner 2026-07-22 —
   * so they never appear in the field manifest and this skin renders them
   * itself, like the avatar block). Default `true`; a host whose product has
   * no user-facing name turns the row off here instead of forking the skin.
   */
  showDisplayName?: boolean;
  /** Render the hard-core `theme` row. Default `true` — see
   * {@link ProfileSettingsProps.showDisplayName} for why it's core-rendered. */
  showTheme?: boolean;
  /**
   * Replace the default `display_name` row with the host's own node (a
   * custom widget still positioned in this screen's core-fields slot).
   * Takes precedence over the default row; `showDisplayName: false` still
   * hides the slot entirely.
   */
  displayNameRow?: ReactNode;
  /** Replace the default `theme` row with the host's own node — same
   * contract as {@link ProfileSettingsProps.displayNameRow}. */
  themeRow?: ReactNode;
}

/**
 * The `theme` column's value set — `stapel_profiles.field_defs.Theme` is a
 * fixed `TextChoices` (light/dark/system), part of the hard core since
 * profiles 0.7.0, so the skin may carry it as a constant the same way the
 * backend model does. Labels resolve through the pair's own i18n keys (a
 * hard-core field has no manifest docstring to borrow).
 */
const THEME_VALUES = ["light", "dark", "system"] as const;

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
 * "Settings Interactions" canon): click the pencil to open a {@link SkinDialog}
 * with the value editable, instead of a bare `Input` sitting inline in a
 * batched form. Generic over any manifest-supplied field name —
 * `valueTestId` lets a caller give each row a stable, per-field test selector.
 */
function EditableTextRow(props: {
  label: string;
  value: string;
  saveCta: string;
  saving: boolean;
  error?: FlowErrorDisplay | undefined;
  valueTestId?: string | undefined;
  onSave: (next: string) => void;
}): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.value);
  /**
   * The value THIS row asked to write, until that write is answered — the one
   * thing the dismissal hangs off.
   *
   * It used to hang off `draft.trim() === props.value` alone, an equality that
   * is ALREADY TRUE the moment the dialog opens: a "save" that changed nothing
   * therefore issued a PATCH *and* closed as if something had happened. And
   * `saving` is the SHARED `mutation.isPending` of the whole screen, so the
   * same equality also closed this dialog when a SIBLING row saved. With the
   * request latched, the equality below stops being an accident of the
   * starting state and becomes the confirmation of a write this row made.
   */
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  /** Is there anything to write? A draft equal to the stored value is not an
   * edit, and a PATCH carrying it is a write with no change behind it. */
  const changed = draft.trim() !== props.value;

  function openEditor(): void {
    setDraft(props.value);
    setPendingValue(null);
    setOpen(true);
  }

  function closeEditor(): void {
    setPendingValue(null);
    setOpen(false);
  }

  function commit(): void {
    if (!changed || props.saving) return;
    const next = draft.trim();
    setPendingValue(next);
    props.onSave(next);
  }

  // Close the dialog once the save THIS row asked for has landed — never on
  // every keystroke, and never on a request nobody made.
  useEffect(() => {
    if (pendingValue === null || props.saving) return;
    if (props.error) {
      // A failed save keeps the dialog open, with the error inside it; the
      // optimistic write has already rolled itself back.
      setPendingValue(null);
      return;
    }
    if (props.value === pendingValue) {
      setPendingValue(null);
      setOpen(false);
    }
  }, [pendingValue, props.saving, props.error, props.value]);

  const body: ReactNode = (
    <Flex vertical gap="middle">
      <ErrorAlert error={props.error} />
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={commit}
        disabled={props.saving}
      />
    </Flex>
  );

  // The action row, as the dialog's footer — the sheet and the modal each
  // place it where their own surface puts actions.
  const footer: ReactNode = (
    <Button
      type="primary"
      onClick={commit}
      loading={props.saving}
      // No live Save for a draft that would write the value already stored.
      // Stated by switching the control off rather than in text: unlike a
      // blocked action whose reason is invisible, the reason here is the row
      // itself — the field still reads exactly what it read before.
      disabled={!changed}
      data-analytics="flow"
    >
      {props.saveCta}
    </Button>
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
      <SkinDialog
        open={open}
        title={props.label}
        onClose={closeEditor}
        dismissLabel={t(PROFILES_I18N_KEYS.actionClose)}
        footer={footer}
      >
        {body}
      </SkinDialog>
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
  error?: FlowErrorDisplay | undefined;
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
          error={props.error}
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
          error={props.error}
          valueTestId={`profile-field-${entry.name}-value`}
          onSave={(next) => props.onPatch({ [entry.name]: next } as ProfileUpdate)}
        />
      );
  }
}

export function ProfileSettings(props: ProfileSettingsProps): ReactElement {
  const t = useT();
  // Never `mutation.error.message` (owner report 2026-08-09): for a failure
  // with no error envelope — a 500 rendered by the server as HTML, which is
  // exactly what a live sandbox returned — that string is
  // `parseErrorEnvelope`'s own diagnostic, `"Request failed with status
  // 500"`. English, transport-shaped, on a Russian UI. `useErrorText` folds
  // any thrown value into the ONE dialect and resolves it through the i18n
  // engine, which since @stapel/core 0.x carries a floor for core's own
  // synthesized `stapel.http.*` codes.
  const errorDisplay = useErrorDisplay(PROFILES_I18N_KEYS.unknownError);
  const theme = useMemo(() => toAntdThemeConfig(props.mode ?? resolveThemeMode()), [props.mode]);
  const query = useMyProfile();
  const manifest = useProfileFieldManifest();
  const mutation = useUpdateMyProfile();
  // ONE operation: upload + store the ref WITH its source. The two-call
  // shape this replaced (`upload()` then `mutate({avatar})`) is exactly how
  // the meettoday stand ended up with CDN refs tagged `file` — see
  // `useSetAvatar`'s module doc.
  const avatarUpload = useSetAvatar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profile = query.data;

  async function handleAvatarPick(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await avatarUpload.setAvatar(file);
  }

  // A fresh upload shows its local preview immediately; once /me refetches,
  // the backend's `avatar_image` descriptor takes over.
  const uploadPreview = avatarUpload.previewUrl ?? avatarUpload.uploadedUrl;
  // Prefer the backend's source-agnostic descriptor — it renders the right
  // ladder tier + blur-up via <Image> for a CDN/file/link avatar alike
  // (stapel-profiles ≥0.6.0). The generated schema types `source` as a plain
  // string; @stapel/image's StapelImage narrows it — a safe structural cast.
  const avatarImage = (profile as { avatar_image?: unknown } | undefined)
    ?.avatar_image as StapelImage | null | undefined;
  // Deprecated fallback for hosts still wiring their own URL resolver.
  const legacyAvatarSrc =
    profile?.avatar && props.avatarUrlFor ? props.avatarUrlFor(profile.avatar) : undefined;

  const avatarInitials =
    typeof profile?.["display_name"] === "string" && profile["display_name"]
      ? (profile["display_name"] as string).slice(0, 2).toUpperCase()
      : "?";

  if (query.isLoading && !profile) {
    return (
      <ConfigProvider theme={theme}>
        <Spin data-testid="profile-settings-loading" />
      </ConfigProvider>
    );
  }

  const mutationError = errorDisplay(mutation.error);

  const showDisplayName = props.showDisplayName ?? true;
  const showTheme = props.showTheme ?? true;
  // Dedupe against a pre-0.7.0 backend whose registry still emits
  // display_name/theme as manifest entries — when the core row renders, a
  // manifest twin must not produce a second row for the same column.
  const coreRendered = new Set<string>([
    ...(showDisplayName ? ["display_name"] : []),
    ...(showTheme ? ["theme"] : []),
  ]);
  // Declaration order from the backend (identity, then standard_fields, then
  // custom_fields) IS the order to render in — `order` is carried mainly so
  // a consumer of the raw manifest can re-sort defensively; sort by it here
  // too rather than trust array order blindly. The sort/filter happens INSIDE
  // the load state: a manifest that could not be read is not a manifest with
  // no fields.
  const visibleEntries = mapLoad(loadStateFromQuery(manifest), (entries) =>
    [...entries]
      .sort((a, b) => a.order - b.order)
      .filter(
        (entry) =>
          (entry.kind !== "geohash" || props.showGeohash) && !coreRendered.has(entry.name)
      )
  );

  const displayNameValue =
    typeof profile?.["display_name"] === "string" ? (profile["display_name"] as string) : "";
  const themeValue =
    typeof profile?.["theme"] === "string" && (THEME_VALUES as readonly string[]).includes(profile["theme"] as string)
      ? (profile["theme"] as string)
      : "system";

  return (
    <ConfigProvider theme={theme}>
      <Card data-testid="profile-settings">
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          {t(PROFILES_I18N_KEYS.settingsTitle)}
        </Typography.Title>
        <Typography.Text type="secondary">{t(PROFILES_I18N_KEYS.settingsSubtitle)}</Typography.Text>

        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
          {uploadPreview ? (
            <Avatar size={64} src={uploadPreview}>
              {avatarInitials}
            </Avatar>
          ) : avatarImage ? (
            <Image
              meta={avatarImage}
              fit="cover"
              alt=""
              style={{ width: 64, height: 64, borderRadius: "50%" }}
            />
          ) : (
            <Avatar size={64} src={legacyAvatarSrc}>
              {avatarInitials}
            </Avatar>
          )}
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
              loading={avatarUpload.isPending}
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked(); pairs carry no @stapel/analytics runtime dependency by architecture"
            >
              {avatarUpload.isPending
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
          {/* Hard-core rows first (display_name, theme) — model columns since
              stapel-profiles 0.7.0, never in the manifest, so they render here
              like the avatar block: hardcoded but host-toggleable/replaceable. */}
          {showDisplayName &&
            (props.displayNameRow ?? (
              <EditableTextRow
                label={t(PROFILES_I18N_KEYS.fieldDisplayName)}
                value={displayNameValue}
                saveCta={t(PROFILES_I18N_KEYS.profileSave)}
                saving={mutation.isPending}
                error={mutationError}
                valueTestId="profile-field-display_name-value"
                onSave={(next) => mutation.mutate({ display_name: next } as ProfileUpdate)}
              />
            ))}
          {showTheme &&
            (props.themeRow ?? (
              <SettingRow label={t(PROFILES_I18N_KEYS.fieldTheme)}>
                <Segmented<string>
                  value={themeValue}
                  onChange={(v) => mutation.mutate({ theme: v } as ProfileUpdate)}
                  block
                  options={[
                    { value: "light", label: t(PROFILES_I18N_KEYS.themeLight) },
                    { value: "dark", label: t(PROFILES_I18N_KEYS.themeDark) },
                    { value: "system", label: t(PROFILES_I18N_KEYS.themeSystem) },
                  ]}
                />
              </SettingRow>
            ))}
          {matchList(visibleEntries, {
            loading: () => <Spin data-testid="profile-fields-loading" />,
            failed: (error) => (
              <div data-testid="profile-fields-failed">
                <ErrorAlert error={errorDisplay(error)} />
                <Button
                  onClick={() => {
                    void manifest.refetch();
                  }}
                  style={{ marginTop: 8 }}
                  data-analytics="none"
                  data-analytics-reason="retry of a failed read (no flow machine) — pairs carry no @stapel/analytics runtime dependency; the host instruments at its own call site"
                >
                  {t(PROFILES_I18N_KEYS.actionRetry)}
                </Button>
              </div>
            ),
            // A manifest a project selected nothing into is a real answer:
            // the hard-core rows above ARE the screen, so there is nothing to
            // add and nothing to announce.
            empty: () => null,
            ready: (entries) => (
              <>
                {entries.map((entry) => (
                  <FieldRow
                    key={entry.name}
                    entry={entry}
                    profile={profile}
                    saveCta={t(PROFILES_I18N_KEYS.profileSave)}
                    saving={mutation.isPending}
                    error={mutationError}
                    onPatch={(patch) => mutation.mutate(patch)}
                  />
                ))}
              </>
            ),
          })}
        </Flex>

        <ErrorAlert error={mutationError} style={{ marginTop: 12 }} />
      </Card>
    </ConfigProvider>
  );
}
