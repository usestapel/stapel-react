/** My profile — headless view + partial-update of the caller's own profile. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { MyProfile } from "../src/index.js";
import {
  ProfilesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** The profile the canned GET /me + PATCH /me handler returns. */
const DEMO_PROFILE = {
  user_id: "b3f1c0de-0000-4000-8000-000000000001",
  display_name: "Ada Lovelace",
  avatar: "avatar/ada",
  location_id: 0,
  location_display_name_narrow: "London",
  location_display_name_broad: "United Kingdom",
  currency_code: "GBP",
  measurement_units: "metric",
  theme: "system",
  app_language: "en",
  understands: ["en"],
  use_device_language: true,
  auto_detected_language: "en",
  auto_translate_content: false,
  email_messages: true,
  email_system: true,
  push_messages: true,
  push_system: true,
  essential_cookies_accepted: true,
  initial_setup_passed: true,
  followers_count: 12,
  following_count: 7,
  rating: 4.8,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

/** The profile body — mounted INSIDE the harness (providers available). */
function MyProfileBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="MyProfile">
      <MyProfile>
        {({ profile, isLoading, isSaving, isSaved, save }) => (
          <>
            <StepBadge
              step={isLoading ? "loading" : (profile?.display_name ?? "—")}
            />
            {isSaved ? (
              <span style={{ color: cssVar("color-text-secondary") }}>
                {t("profiles.profile.saved")}
              </span>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => {
                  save({ display_name: "Ada, Countess of Lovelace" });
                }}
                labelKey={
                  isSaving ? "profiles.profile.saving" : "profiles.profile.save"
                }
              />
            </DemoActions>
          </>
        )}
      </MyProfile>
    </DemoCard>
  );
}

function MyProfileDemo(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={{ "/me": DEMO_PROFILE }}>
      <MyProfileBody />
    </ProfilesDemoHarness>
  );
}

/**
 * Demonstrates the headless "my profile" surface: the canned handler returns the
 * caller's profile for GET /me and echoes an updated one for PATCH /me, so
 * pressing "save" flips the bag into its `isSaved` state. Bring your own form —
 * the component is renderless.
 */
export default defineDemo({
  id: "profiles.my_profile",
  title: "My profile",
  description:
    "The headless MyProfile wraps the read + partial-update of the caller's own profile and exposes loading / saving / saved / error state. Bring your own form UI — the component is renderless.",
  component: MyProfile,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <MyProfileDemo /> },
  },
});
