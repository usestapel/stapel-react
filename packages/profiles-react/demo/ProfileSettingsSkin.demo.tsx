/** Profile settings — the DEFAULT SKIN (the product), not the render bench. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import {
  ProfileSettings,
  LanguageSettings,
  NotificationPreferences,
} from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import { FIELD_MANIFEST, LANGUAGES, MY_PROFILE } from "./_fixtures.js";

/** Order matters: `mockFetch` takes the FIRST key the url contains, and
 * `/me` is a substring of every `/me/*` path. */
const READY = {
  "/field-manifest": FIELD_MANIFEST,
  "/languages/": LANGUAGES,
  "/me": MY_PROFILE,
} as const;

/** The manifest read fails; the profile read does not. The hard-core rows
 * stay, and the manifest-driven block says what went wrong with a retry —
 * rather than the screen silently having fewer fields than the host selected. */
const MANIFEST_FAILED = {
  "/field-manifest": [500, { detail: "boom" }] as const,
  "/languages/": LANGUAGES,
  "/me": MY_PROFILE,
} as const;

function Settings(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={READY}>
      <ProfileSettings />
    </ProfilesDemoHarness>
  );
}

/** The other wiring: the two sections mounted as pages of their own, which is
 * what `showLanguage={false}` / `showNotifications={false}` plus the
 * `profiles.language` / `profiles.notifications` submenu routes give a host
 * that prefers three pages to one. */
function Sections(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={READY}>
      <LanguageSettings surface="base" />
      <NotificationPreferences surface="base" />
    </ProfilesDemoHarness>
  );
}

function ManifestFailed(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={MANIFEST_FAILED}>
      <ProfileSettings />
    </ProfilesDemoHarness>
  );
}

/**
 * The composed settings page: the profile card (avatar, display name, theme,
 * one row per field-manifest entry) with `<LanguageSettings/>` and
 * `<NotificationPreferences/>` below it — the two finished screens that had no
 * route and no parent until this wave.
 */
export default defineDemo({
  id: "profiles.settings-skin",
  title: "Profile settings (skin)",
  description:
    "The default skin the nav manifest mounts at profiles.settings: a data-driven profile card whose rows come from GET /field-manifest, with the language picker and the notification matrix composed underneath — the same composition auth-react's SecuritySettings uses. Every field commits on its own (no batched Save); a rejected pick snaps back, because the PATCH is optimistic with rollback.",
  component: ProfileSettings,
  // The headless twins the deleted `_harness` stories used to stand for:
  // `MyProfile` is the read this whole card is made of and `ProfilesProvider`
  // is what mounts it, so they are covered by the screen that USES them
  // rather than by a debug card that printed their step chip (§54/VC-A1).
  covers: [
    "LanguageSettings",
    "NotificationPreferences",
    "MyProfile",
    "ProfilesProvider",
  ],
  tokens: ["surface-raised", "text", "border-subtle"],
  variants: {
    settings: {
      description: "Everything landed: profile, manifest fields, languages, notifications.",
      viewport: "phone",
      step: "ready",
      render: () => <Settings />,
    },
    sections: {
      description:
        "The same two screens routed separately (profiles.language / profiles.notifications) instead of composed. The notification matrix is switches with accessible names, and it reflows from two columns to stacked rows on its own container width.",
      viewport: "desktop",
      step: "sections",
      render: () => <Sections />,
    },
    "manifest-failed": {
      description:
        "GET /field-manifest failed. The hard-core rows still render; the manifest block states the failure and offers a retry instead of quietly showing fewer fields.",
      viewport: "desktop",
      step: "failed",
      render: () => <ManifestFailed />,
    },
  },
});
