/** Initial setup — headless first-run form (workspaces-org-program §B5). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { InitialSetupPrompt } from "../src/index.js";
import {
  ProfilesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

/** A first-run profile: no display name yet, setup not passed — exactly the
 * state `useInitialSetupGate` fires on. */
const FIRST_RUN_PROFILE = {
  user_id: "b3f1c0de-0000-4000-8000-000000000002",
  display_name: "",
  avatar: "",
  location_id: 0,
  location_display_name_narrow: "",
  location_display_name_broad: "",
  theme: "system",
  app_language: { code: "en", name: "English", flag: null },
  understands: ["en"],
  use_device_language: true,
  auto_detected_language: "en",
  auto_translate_content: false,
  email_messages: true,
  email_system: true,
  push_messages: true,
  push_system: true,
  essential_cookies_accepted: true,
  initial_setup_passed: false,
  followers_count: 0,
  following_count: 0,
  rating: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/** The prompt body — mounted INSIDE the harness (providers available). */
function InitialSetupPromptBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="InitialSetupPrompt">
      <InitialSetupPrompt>
        {({ displayName, theme, submit, skip, canSubmit, isLoading, isSaving, isSubmitted }) => (
          <>
            <StepBadge
              step={
                isLoading
                  ? "loading"
                  : isSubmitted
                    ? "submitted"
                    : `${displayName.value || "—"}/${theme.value}`
              }
            />
            {isSubmitted ? (
              <span style={{ color: cssVar("text-muted") }}>
                {t("profiles.profile.saved")}
              </span>
            ) : null}
            <DemoActions>
              <DemoButton
                run={() => {
                  displayName.set("Ada Lovelace");
                  theme.set("dark");
                }}
                labelKey="demo.action.start"
              />
              <DemoButton
                run={() => {
                  if (canSubmit) submit();
                }}
                labelKey={
                  isSaving
                    ? "profiles.initialSetup.saving"
                    : "profiles.initialSetup.save"
                }
              />
              <DemoButton run={skip} labelKey="profiles.initialSetup.skip" />
            </DemoActions>
          </>
        )}
      </InitialSetupPrompt>
    </DemoCard>
  );
}

function InitialSetupPromptDemo(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={{ "/me": FIRST_RUN_PROFILE }}>
      <InitialSetupPromptBody />
    </ProfilesDemoHarness>
  );
}

/**
 * Demonstrates the headless first-run setup form (§B5): the canned handler
 * returns a profile with no display name and `initial_setup_passed: false`;
 * "Start" drafts a name + theme, "Continue" submits the single PATCH carrying
 * `initial_setup_passed: true`, "Maybe later" records the skip without a
 * PATCH. Bring your own modal UI — the component is renderless (the antd
 * default skin is `InitialSetupModal` in `/default`).
 */
export default defineDemo({
  id: "profiles.initial_setup_prompt",
  title: "Initial setup",
  description:
    "The headless InitialSetupPrompt wraps the first-run setup form (display name, theme, app language): drafts seeded from the profile, one submit() PATCH that also sets initial_setup_passed, and a skip() that records 'maybe later' without a PATCH. Pair it with useInitialSetupGate to decide when to show it.",
  component: InitialSetupPrompt,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <InitialSetupPromptDemo /> },
  },
});
