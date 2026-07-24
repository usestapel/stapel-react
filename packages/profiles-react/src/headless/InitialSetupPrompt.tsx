/**
 * `InitialSetupPrompt` — headless first-run setup form (workspaces-org-program
 * §B5; port of ironmemo's `onboarding-modal.tsx` initial-setup mode into the
 * pair as a canon). Renderless (frontend-standard §2): wires the pair's
 * EXISTING hooks (`useMyProfile` + `useUpdateMyProfile`) into a render-prop
 * bag of the three first-run fields — display name, theme, app language —
 * plus `submit()` / `skip()`; bring your own modal/inputs (the antd default
 * skin is `InitialSetupModal` in `/default`).
 *
 * `submit()` PATCHes `{display_name, theme, app_language,
 * initial_setup_passed: true}` in ONE request — only the fields the host
 * enabled via `fields` (default: all three). `initial_setup_passed: true` is
 * the whole point of the canon: it is what flips
 * `useInitialSetupGate({ require: "initialSetup" })` off for good. The PATCH
 * flows through `ProfileUpdate`'s open envelope (api/types.ts) — a host whose
 * project selected extra manifest fields extends the same submit via
 * `submit(extra)` with no fork (§66 tier 1).
 *
 * `skip()` records the skip (it refreshes the §B5 daily stamp,
 * `stapel.profiles.initialSetup.lastPromptAt`, through `@stapel/core`'s
 * repository) and fires `onSkip` — it deliberately issues NO PATCH: "maybe
 * later" must leave `initial_setup_passed` untouched so the prompt can come
 * back.
 *
 * When the prompt should appear at all is the gate's job —
 * {@link useInitialSetupGate} (`mode: "always" | "daily"`, `require:
 * "displayName" | "initialSetup"`).
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { MyProfile, ProfileUpdate } from "../api/types.js";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";
import { recordInitialSetupPrompt } from "../model/initialSetupStorage.js";

/** The first-run fields a host can enable (all three by default). */
export type InitialSetupFieldName = "displayName" | "theme" | "language";

/** One first-run field in the {@link InitialSetupPromptBag}. */
export interface InitialSetupField {
  /** The host enabled this field (via the `fields` prop) — a disabled field
   * is never sent by `submit()` and its `save()` is a no-op. */
  readonly enabled: boolean;
  /** Current draft value (seeded from the loaded profile). For `language`
   * this is the bare code (`app_language` PATCHes as a code, reads back as
   * the full `{code, name, flag}` object). */
  readonly value: string;
  /** Update the draft (no network). */
  set(next: string): void;
  /** Persist JUST this field now (a plain PATCH, no
   * `initial_setup_passed`) — for hosts that commit per-field instead of one
   * final `submit()`. */
  save(): void;
}

/** Render-prop bag for {@link InitialSetupPrompt}. */
export interface InitialSetupPromptBag {
  readonly displayName: InitialSetupField;
  readonly theme: InitialSetupField;
  readonly language: InitialSetupField;
  /**
   * PATCH the enabled fields + `initial_setup_passed: true` in one request.
   * `extra` extends the same PATCH with host fields (`ProfileUpdate` is an
   * open envelope — §66 tier 1); `initial_setup_passed: true` always wins.
   * No-op while `canSubmit` is false.
   */
  submit(extra?: ProfileUpdate): void;
  /** Record the skip (refreshes the §B5 daily stamp) and fire `onSkip` —
   * deliberately NO PATCH. */
  skip(): void;
  /** `submit()` would be accepted: not already saving, and the display name
   * draft is non-blank when that field is enabled (ironmemo's `canSave`). */
  readonly canSubmit: boolean;
  /** The profile read is still in flight (drafts not seeded yet). */
  readonly isLoading: boolean;
  /** A save/submit PATCH is in flight. */
  readonly isSaving: boolean;
  /** The read or the save failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** The last `submit()`/`save()` landed (the modal host closes on this —
   * or on `onSubmitted`). */
  readonly isSubmitted: boolean;
}

export interface InitialSetupPromptProps {
  /** Which first-run fields this host collects. Default: all three. */
  readonly fields?: readonly InitialSetupFieldName[];
  /** Fired once a `submit()` PATCH lands, with the updated profile. */
  onSubmitted?(profile: MyProfile): void;
  /** Fired by `skip()` (after the skip is recorded). */
  onSkip?(): void;
  children(bag: InitialSetupPromptBag): ReactNode;
}

export function InitialSetupPrompt(props: InitialSetupPromptProps): ReactNode {
  const enabled = props.fields ?? ["displayName", "theme", "language"];
  const query = useMyProfile();
  const mutation = useUpdateMyProfile();
  const profile = query.data;

  const [displayName, setDisplayName] = useState("");
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("");

  // Seed the drafts from the loaded profile (LanguageSettings' pattern) —
  // re-seeds on refetch so an outside edit isn't silently overwritten by a
  // stale draft.
  useEffect(() => {
    if (!profile) return;
    const name = profile["display_name"];
    setDisplayName(typeof name === "string" ? name : "");
    const currentTheme = profile["theme"];
    setTheme(typeof currentTheme === "string" ? currentTheme : "system");
    setLanguage(profile.app_language?.code ?? "");
  }, [profile]);

  const has = (field: InitialSetupFieldName): boolean =>
    enabled.includes(field);

  /** The enabled fields' drafts as a wire patch (blank language omitted — a
   * profile that never had `app_language` must not PATCH an empty code). */
  function draftPatch(): ProfileUpdate {
    const patch: ProfileUpdate = {};
    if (has("displayName")) patch.display_name = displayName.trim();
    if (has("theme")) patch.theme = theme;
    if (has("language") && language.length > 0) patch.app_language = language;
    return patch;
  }

  const canSubmit =
    !mutation.isPending && (!has("displayName") || displayName.trim().length > 0);

  function submit(extra?: ProfileUpdate): void {
    if (!canSubmit) return;
    mutation.mutate(
      // Host `extra` layers over the drafts (open-envelope extension seam);
      // `initial_setup_passed: true` is the canon's non-negotiable last word.
      { ...draftPatch(), ...extra, initial_setup_passed: true },
      { onSuccess: (updated) => props.onSubmitted?.(updated) }
    );
  }

  function fieldBag(
    field: InitialSetupFieldName,
    value: string,
    set: (next: string) => void,
    patch: () => ProfileUpdate
  ): InitialSetupField {
    return {
      enabled: has(field),
      value,
      set,
      save: () => {
        if (!has(field)) return;
        mutation.mutate(patch());
      },
    };
  }

  return props.children({
    displayName: fieldBag("displayName", displayName, setDisplayName, () => ({
      display_name: displayName.trim(),
    })),
    theme: fieldBag("theme", theme, setTheme, () => ({ theme })),
    language: fieldBag("language", language, setLanguage, () => ({
      app_language: language,
    })),
    submit,
    skip: () => {
      void recordInitialSetupPrompt();
      props.onSkip?.();
    },
    canSubmit,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
    isSubmitted: mutation.isSuccess,
  });
}
