import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { calendarErrorBundleEn } from "./generated/errors.gen.js";

/**
 * calendar-react's own translation KEYS (frontend-standard §4.2): headless
 * components never render literal strings — hosts resolve these via core's i18n
 * engine (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. Point core's `loadLocale` at stapel-translate to override
 * per locale. All UI keys live under the `calendar.` namespace.
 */
export const CALENDAR_I18N_KEYS = {
  unknownError: "calendar.error.unknown",
  // Calendar view (CalendarView headless)
  viewLoading: "calendar.view.loading",
  viewEmpty: "calendar.view.empty",
  viewError: "calendar.view.error",
  viewRetry: "calendar.view.retry",
  // Event composer (EventComposer headless)
  composerCreate: "calendar.composer.create",
  composerCreating: "calendar.composer.creating",
  composerCreated: "calendar.composer.created",
  // RSVP (EventRsvp headless)
  rsvpAccept: "calendar.rsvp.accept",
  rsvpTentative: "calendar.rsvp.tentative",
  rsvpDecline: "calendar.rsvp.decline",
  rsvpResponding: "calendar.rsvp.responding",
} as const;

export type CalendarI18nKey =
  (typeof CALENDAR_I18N_KEYS)[keyof typeof CALENDAR_I18N_KEYS];

/**
 * English fallback bundle for calendar-react UI keys + backend error codes.
 * The generated `calendarErrorBundleEn` (from stapel-calendar's error registry,
 * `pnpm gen:errors`) is spread FIRST so every backend `error.*` key has a
 * fallback — a `StapelApiError.code` never renders as a raw key. Hand-polished
 * copy below then OVERRIDES the generated English for the keys users see most.
 */
export const calendarI18nBundleEn: I18nDictionary = {
  // Backend error codes — generated en fallbacks (coverage by construction).
  ...calendarErrorBundleEn,

  // calendar-react UI
  "calendar.error.unknown": "Something went wrong. Please try again.",
  "calendar.view.loading": "Loading your calendar…",
  "calendar.view.empty": "Nothing scheduled in this range.",
  "calendar.view.error": "Couldn't load your calendar.",
  "calendar.view.retry": "Try again",
  "calendar.composer.create": "Create event",
  "calendar.composer.creating": "Creating…",
  "calendar.composer.created": "Event created.",
  "calendar.rsvp.accept": "Accept",
  "calendar.rsvp.tentative": "Maybe",
  "calendar.rsvp.decline": "Decline",
  "calendar.rsvp.responding": "Saving your response…",
};

/**
 * Register calendar-react's key bundle into a core i18n engine (call once at
 * startup). Registers under the given locale (default `"en"`); a later
 * `loadLocale` from stapel-translate can layer localized overrides on top.
 *
 * MERGE-PRIORITY CONVENTION (i18n-shipping.md §3): registration order is
 * override priority — later wins per key. The generated en floor is registered
 * UNDER the pair's polish copy here (coverage by construction), and a HOST
 * bundle registered AFTER this call overrides any pair text without a fork.
 * stapel-calendar ships no locale catalogs yet, so this pair is en-only; a
 * `./i18n/<locale>` subpath follows the notifications etalon once it does.
 */
export function registerCalendarI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, calendarI18nBundleEn);
}
