/** Notification preferences — headless category × channel matrix (2×2 today). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import {
  NotificationPreferences,
  type NotificationCategory,
  type NotificationChannel,
} from "../src/index.js";
import { PROFILES_I18N_KEYS } from "../src/i18n/keys.js";
import {
  ProfilesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

const CATEGORY_KEY: Record<NotificationCategory, "notifCategoryMessages" | "notifCategorySystem"> = {
  messages: "notifCategoryMessages",
  system: "notifCategorySystem",
};
const CHANNEL_KEY: Record<NotificationChannel, "notifChannelEmail" | "notifChannelPush"> = {
  email: "notifChannelEmail",
  push: "notifChannelPush",
};

/** The profile the canned GET/PATCH /me handler returns — only the four
 * notification fields matter here; the rest mirror MyProfile.demo.tsx's shape. */
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
  email_system: false,
  push_messages: true,
  push_system: false,
  essential_cookies_accepted: true,
  initial_setup_passed: true,
  followers_count: 12,
  following_count: 7,
  rating: 4.8,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

/** The matrix body — mounted INSIDE the harness (providers available). */
function NotificationPreferencesBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="NotificationPreferences">
      <NotificationPreferences>
        {({ categories, channels, isEnabled, toggle, isLoading, isSaving }) => (
          <>
            <StepBadge step={isLoading ? "loading" : `${categories.length}x${channels.length}`} />
            <table>
              <thead>
                <tr>
                  <th />
                  {channels.map((channel) => (
                    <th key={channel}>{t(PROFILES_I18N_KEYS[CHANNEL_KEY[channel]])}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category}>
                    <td>{t(PROFILES_I18N_KEYS[CATEGORY_KEY[category]])}</td>
                    {channels.map((channel) => (
                      <td key={channel}>
                        {isEnabled(category, channel) ? "on" : "off"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <DemoActions>
              <DemoButton
                run={() => toggle("messages", "email")}
                labelKey={
                  isSaving ? "profiles.profile.saving" : "profiles.profile.save"
                }
              />
            </DemoActions>
          </>
        )}
      </NotificationPreferences>
    </DemoCard>
  );
}

function NotificationPreferencesDemo(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={{ "/me": DEMO_PROFILE }}>
      <NotificationPreferencesBody />
    </ProfilesDemoHarness>
  );
}

/**
 * Demonstrates the headless category × channel notification matrix: the
 * canned handler returns the caller's profile for GET /me and echoes an
 * updated one for PATCH /me, so toggling a cell flips its on/off state.
 * Bring your own grid/list UI — the component is renderless.
 */
export default defineDemo({
  id: "profiles.notification_preferences",
  title: "Notification preferences",
  description:
    "Headless category (messages/system) x channel (email/push) notification matrix over the caller's profile fields. Bring your own grid — the component is renderless.",
  component: NotificationPreferences,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <NotificationPreferencesDemo /> },
  },
});
