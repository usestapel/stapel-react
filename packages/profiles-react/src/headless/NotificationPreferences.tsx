import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { MyProfile, ProfileUpdate } from "../api/types.js";
import { useMyProfile } from "../model/queries.js";
import { useUpdateMyProfile } from "../model/mutations.js";

/**
 * Notification preferences live on `Profile`/`ProfileUpdate` itself
 * (`email_messages`/`email_system`/`push_messages`/`push_system`) — NOT on
 * stapel-notifications, which only owns push-device registration + the
 * in-app feed (see `@stapel/notifications-react`'s `DeviceRegistration` /
 * `NotificationFeed`). This headless view models the four fields as a
 * CATEGORY × CHANNEL matrix rather than four flat booleans (per
 * settings-inventory-compare.md's marketplace `NotificationSettingsPage`
 * — a richer category-per-row × channel-per-column shape than a flat
 * checkbox list): stapel-profiles exposes 2 categories (`messages`,
 * `system`) × 2 channels (`email`, `push`) TODAY, but the matrix shape means a
 * third category the backend adds later is one more row, not a new component
 * or a new prop. The default skin is free to render it plainly (a small
 * table) — the matrix lives here, in the headless model, per the brief.
 */
export type NotificationCategory = "messages" | "system";
export type NotificationChannel = "email" | "push";

const CATEGORIES: readonly NotificationCategory[] = ["messages", "system"];
const CHANNELS: readonly NotificationChannel[] = ["email", "push"];

/** One matrix cell's `Profile`/`ProfileUpdate` field name. Mechanical —
 * `${channel}_${category}` matches the four backend fields 1:1 — but kept as
 * an explicit table (not a template-literal cast) so this pair's exhaustive
 * `keyof ProfileUpdate` typing catches a future backend field rename. */
const FIELD: Readonly<
  Record<
    NotificationCategory,
    Readonly<
      Record<
        NotificationChannel,
        "email_messages" | "email_system" | "push_messages" | "push_system"
      >
    >
  >
> = {
  messages: { email: "email_messages", push: "push_messages" },
  system: { email: "email_system", push: "push_system" },
};

/** Render-prop bag for {@link NotificationPreferences}. */
export interface NotificationPrefsBag {
  /** The matrix's rows, in display order. */
  readonly categories: readonly NotificationCategory[];
  /** The matrix's columns, in display order. */
  readonly channels: readonly NotificationChannel[];
  /** Is `category`'s `channel` toggle on? `false` before the profile loads. */
  isEnabled(category: NotificationCategory, channel: NotificationChannel): boolean;
  /** Flip one cell — PATCHes just that field. */
  toggle(category: NotificationCategory, channel: NotificationChannel): void;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

/**
 * Headless notification-preferences matrix — a renderless view + toggle
 * control over the caller's profile-level notification fields. Wires
 * {@link useMyProfile} + {@link useUpdateMyProfile} and hands a
 * {@link NotificationPrefsBag} to `children`; bring your own grid/list UI.
 * Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <NotificationPreferences>
 *   {({ categories, channels, isEnabled, toggle }) => ( ... )}
 * </NotificationPreferences>
 * ```
 */
export function NotificationPreferences(props: {
  children: (bag: NotificationPrefsBag) => ReactNode;
}): ReactNode {
  const query = useMyProfile();
  const mutation = useUpdateMyProfile();
  const profile: MyProfile | undefined = query.data;

  return props.children({
    categories: CATEGORIES,
    channels: CHANNELS,
    isEnabled: (category, channel) => {
      if (!profile) return false;
      return Boolean(profile[FIELD[category][channel]]);
    },
    toggle: (category, channel) => {
      if (!profile) return;
      const field = FIELD[category][channel];
      const patch: ProfileUpdate = { [field]: !profile[field] };
      mutation.mutate(patch);
    },
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
  });
}
