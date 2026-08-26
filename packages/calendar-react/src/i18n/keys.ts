import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { calendarErrorBundleEn } from "./generated/errors.gen.js";

/**
 * calendar-react's own translation KEYS (frontend-standard §4.2): no component
 * in this package renders a literal string — the headless layer hands keys to
 * a host, and the default skin resolves them through core's i18n engine
 * (`useT`). Backend error codes flow through the SAME contour: a
 * `StapelApiError.code` is already a key, so the default bundle below ships
 * English fallbacks for both the backend error codes (generated) and the
 * pair's own UI keys. All UI keys live under the `calendar.` namespace.
 *
 * Locales: `ru` and `es` ship as the `@stapel/calendar-react/i18n/ru` and
 * `/i18n/es` subpaths (i18n-shipping.md §2), so a host that does not register
 * them never carries the strings.
 *
 * Keys marked PLURAL FAMILY are rendered with core's `tPlural`, which selects
 * `<key>.<cldr-category>`; the family name is what the code names and what the
 * lint checks, and which categories a language defines is the translation's
 * business (Russian has `few`/`many`, English does not).
 */
export const CALENDAR_I18N_KEYS = {
  unknownError: "calendar.error.unknown",

  // ── blocked-action reasons (ActionAvailability codes) ───────────────────
  // Every one of these is rendered as VISIBLE text beside the switched-off
  // control (GatedControl/GatedButton), never as a tooltip.
  blockedNotOwner: "calendar.blocked.not_owner",
  blockedOwnerUnknown: "calendar.blocked.owner_unknown",
  blockedNotInvited: "calendar.blocked.not_invited",
  blockedEventCancelled: "calendar.blocked.event_cancelled",
  blockedNoChanges: "calendar.blocked.no_changes",
  blockedVirtualOccurrence: "calendar.blocked.virtual_occurrence",
  blockedNoMandate: "calendar.blocked.no_mandate",

  // ── client-side validation (the two 400s this backend documents) ────────
  validationEndBeforeStart: "calendar.validation.end_before_start",
  validationRangeIncomplete: "calendar.validation.range_incomplete",
  validationSlotMinutes: "calendar.validation.slot_minutes",
  validationTitleRequired: "calendar.validation.title_required",

  // ── the calendar screen ─────────────────────────────────────────────────
  viewHeading: "calendar.view.heading",
  viewLoading: "calendar.view.loading",
  viewEmpty: "calendar.view.empty",
  viewEmptyHint: "calendar.view.empty_hint",
  viewError: "calendar.view.error",
  viewRetry: "calendar.view.retry",
  viewToday: "calendar.view.today",
  viewPrevious: "calendar.view.previous",
  viewNext: "calendar.view.next",
  viewModeMonth: "calendar.view.mode.month",
  viewModeWeek: "calendar.view.mode.week",
  viewModeDay: "calendar.view.mode.day",
  viewNewEvent: "calendar.view.new_event",
  viewCancelled: "calendar.view.cancelled",
  viewRepeats: "calendar.view.repeats",
  viewMarker: "calendar.view.marker",
  viewOpenEvent: "calendar.view.open_event",
  /** PLURAL FAMILY — the "+N more" chip in a full month cell. */
  viewMoreCount: "calendar.view.more_count",
  viewUntitled: "calendar.view.untitled",
  /** Names the SHAPE on screen when a month range is drawn as a day-grouped
   * list because the box is too narrow for a grid — the range switch names
   * the range, and on its own it lied about what the reader is looking at. */
  viewAgendaLayout: "calendar.view.agenda_layout",

  // ── agenda / list ───────────────────────────────────────────────────────
  agendaHeading: "calendar.agenda.heading",
  agendaEmpty: "calendar.agenda.empty",
  agendaEmptyHint: "calendar.agenda.empty_hint",
  agendaDayEmpty: "calendar.agenda.day_empty",

  // ── event detail ────────────────────────────────────────────────────────
  detailHeading: "calendar.detail.heading",
  detailNoDescription: "calendar.detail.no_description",
  detailOrganizer: "calendar.detail.organizer",
  /** The event's single time fact, start and end together. Not "Starts": the
   * value is a range, and labelling a range "Starts" is what made the sheet
   * print the start time twice on one line. */
  detailWhen: "calendar.detail.when",
  detailParticipants: "calendar.detail.participants",
  detailNoParticipants: "calendar.detail.no_participants",
  detailRsvpSummary: "calendar.detail.rsvp_summary",
  detailAddToCalendar: "calendar.detail.add_to_calendar",
  detailEdit: "calendar.detail.edit",
  detailClose: "calendar.detail.close",
  detailCancelledBanner: "calendar.detail.cancelled_banner",
  detailSeriesNote: "calendar.detail.series_note",

  // ── RSVP ────────────────────────────────────────────────────────────────
  rsvpHeading: "calendar.rsvp.heading",
  rsvpAccept: "calendar.rsvp.accept",
  rsvpTentative: "calendar.rsvp.tentative",
  rsvpDecline: "calendar.rsvp.decline",
  rsvpResponding: "calendar.rsvp.responding",
  rsvpYourAnswer: "calendar.rsvp.your_answer",
  rsvpNoAnswer: "calendar.rsvp.no_answer",
  rsvpStateInvited: "calendar.rsvp.state.invited",
  rsvpStateAccepted: "calendar.rsvp.state.accepted",
  rsvpStateTentative: "calendar.rsvp.state.tentative",
  rsvpStateDeclined: "calendar.rsvp.state.declined",

  // ── composer / editor (one surface, two arms) ───────────────────────────
  composerCreate: "calendar.composer.create",
  composerCreating: "calendar.composer.creating",
  composerCreated: "calendar.composer.created",
  editorCreateHeading: "calendar.editor.create_heading",
  editorEditHeading: "calendar.editor.edit_heading",
  editorTitle: "calendar.editor.title",
  editorTitlePlaceholder: "calendar.editor.title_placeholder",
  editorDescription: "calendar.editor.description",
  editorStart: "calendar.editor.start",
  editorEnd: "calendar.editor.end",
  editorSave: "calendar.editor.save",
  editorSaving: "calendar.editor.saving",
  editorSaved: "calendar.editor.saved",
  editorDiscard: "calendar.editor.discard",
  editorMarkerHint: "calendar.editor.marker_hint",
  editorCancelEvent: "calendar.editor.cancel_event",
  editorCancelQuestion: "calendar.editor.cancel_question",
  editorCancelBody: "calendar.editor.cancel_body",
  editorCancelConfirm: "calendar.editor.cancel_confirm",

  // ── recurrence ──────────────────────────────────────────────────────────
  recurrenceLabel: "calendar.recurrence.label",
  recurrenceInterval: "calendar.recurrence.interval",
  recurrenceWeekdays: "calendar.recurrence.weekdays",
  recurrenceEnds: "calendar.recurrence.ends",
  recurrenceEndNever: "calendar.recurrence.end.never",
  recurrenceEndUntil: "calendar.recurrence.end.until",
  recurrenceEndCount: "calendar.recurrence.end.count",
  recurrenceUntilLabel: "calendar.recurrence.until_label",
  recurrenceCountLabel: "calendar.recurrence.count_label",
  recurrenceExclusiveHint: "calendar.recurrence.exclusive_hint",
  recurrencePresetNone: "calendar.recurrence.preset.none",
  recurrencePresetDaily: "calendar.recurrence.preset.daily",
  recurrencePresetWeekdays: "calendar.recurrence.preset.weekdays",
  recurrencePresetWeekly: "calendar.recurrence.preset.weekly",
  recurrencePresetBiweekly: "calendar.recurrence.preset.biweekly",
  recurrencePresetMonthly: "calendar.recurrence.preset.monthly",
  recurrencePresetCustom: "calendar.recurrence.preset.custom",

  // ── participants (replace-set) ──────────────────────────────────────────
  participantsHeading: "calendar.participants.heading",
  participantsAdd: "calendar.participants.add",
  participantsAddPlaceholder: "calendar.participants.add_placeholder",
  participantsRemove: "calendar.participants.remove",
  participantsResultHeading: "calendar.participants.result_heading",
  participantsReplaceWarning: "calendar.participants.replace_warning",
  participantsNobody: "calendar.participants.nobody",
  participantsSave: "calendar.participants.save",
  participantsSaving: "calendar.participants.saving",
  participantsSaved: "calendar.participants.saved",
  participantsReset: "calendar.participants.reset",
  /** PLURAL FAMILY — "N will be invited". */
  participantsAddedCount: "calendar.participants.added_count",
  /** PLURAL FAMILY — "N will lose their invitation". */
  participantsRemovedCount: "calendar.participants.removed_count",

  // ── delete (a different verb from cancel) ───────────────────────────────
  deleteAction: "calendar.delete.action",
  deleteQuestion: "calendar.delete.question",
  deleteBody: "calendar.delete.body",
  deleteOccurrenceBody: "calendar.delete.occurrence_body",
  deleteConfirm: "calendar.delete.confirm",
  deleteDeleting: "calendar.delete.deleting",

  // ── availability ────────────────────────────────────────────────────────
  availabilityHeading: "calendar.availability.heading",
  availabilitySlotLength: "calendar.availability.slot_length",
  availabilitySlots: "calendar.availability.slots",
  /** The button on a slot row. The section heading ("Open slots") was being
   * reused as the label of the button under it — a caption repeated as its
   * own control (visual pass M-10). */
  availabilityPick: "calendar.availability.pick",
  availabilityBusy: "calendar.availability.busy",
  availabilityNoBusy: "calendar.availability.no_busy",
  availabilityNoWindows: "calendar.availability.no_windows",
  availabilityNoWindowsHint: "calendar.availability.no_windows_hint",
  availabilityTruncated: "calendar.availability.truncated",
  availabilityTruncatedHint: "calendar.availability.truncated_hint",
  availabilityRefresh: "calendar.availability.refresh",
  availabilityLoading: "calendar.availability.loading",
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

  // Backend refusals a person reads, in sentences rather than registry
  // shorthand. The 503 became REACHABLE when stapel-calendar moved the event
  // endpoints onto `HasWorkspaceMandateIfScoped`: it is not "an error", it is
  // "we could not ask whether you may", and it must not read as a denial.
  "error.503.mandate_unavailable":
    "We couldn't check your workspace access just now. Try again in a moment.",
  "error.403.calendar_not_event_owner":
    "Only the person who created this event can change it.",
  "error.404.calendar_not_invited": "You're not invited to this event.",
  "error.400.calendar_invalid_range": "That time range doesn't work — the end is before the start.",
  "error.400.calendar_invalid_slot_minutes":
    "Slot length must be a whole number of minutes, at least 1.",
  "error.400.calendar_invalid_recurrence":
    "That repeat rule doesn't work. Check the interval, the days and how the series ends.",
  "error.400.calendar_invalid_rsvp":
    "An answer can only be accept, maybe or decline.",
  "error.404.calendar_event_not_found": "That event no longer exists.",

  // calendar-react UI
  "calendar.error.unknown": "Something went wrong. Please try again.",

  "calendar.blocked.not_owner":
    "Only the person who created this event can change it.",
  "calendar.blocked.owner_unknown":
    "We can't tell whether this event is yours, so editing is off.",
  "calendar.blocked.not_invited":
    "You're not on the invitee list, so there's nothing to answer.",
  "calendar.blocked.event_cancelled": "This event was cancelled.",
  "calendar.blocked.no_changes": "Nothing has changed yet.",
  "calendar.blocked.virtual_occurrence":
    "This time comes from a repeating series — open the series to change it.",
  "calendar.blocked.no_mandate":
    "This calendar belongs to a workspace you're not a member of.",

  "calendar.validation.end_before_start": "The end time is before the start time.",
  "calendar.validation.range_incomplete": "Pick a start and an end time.",
  "calendar.validation.slot_minutes":
    "Slot length must be a whole number of minutes, at least 1.",
  "calendar.validation.title_required": "Give the event a title.",

  "calendar.view.heading": "Calendar",
  "calendar.view.loading": "Loading your calendar…",
  "calendar.view.empty": "Nothing scheduled in this range.",
  "calendar.view.empty_hint": "Anything you create will show up here.",
  "calendar.view.error": "Couldn't load your calendar.",
  "calendar.view.retry": "Try again",
  "calendar.view.today": "Today",
  "calendar.view.previous": "Previous",
  "calendar.view.next": "Next",
  "calendar.view.mode.month": "Month",
  "calendar.view.mode.week": "Week",
  "calendar.view.mode.day": "Day",
  "calendar.view.new_event": "New event",
  "calendar.view.cancelled": "Cancelled",
  "calendar.view.repeats": "Part of a series",
  "calendar.view.marker": "Marker",
  "calendar.view.open_event": "Open event",
  "calendar.view.more_count.one": "{count} more",
  "calendar.view.more_count.other": "{count} more",
  "calendar.view.untitled": "Untitled event",
  "calendar.view.agenda_layout": "Agenda",

  "calendar.agenda.heading": "Agenda",
  "calendar.agenda.empty": "Nothing scheduled.",
  "calendar.agenda.empty_hint": "Your next events will appear here.",
  "calendar.agenda.day_empty": "Nothing on this day",

  "calendar.detail.heading": "Event",
  "calendar.detail.no_description": "No description",
  "calendar.detail.organizer": "Organizer",
  "calendar.detail.when": "When",
  "calendar.detail.participants": "Invitees",
  "calendar.detail.no_participants": "Nobody is invited yet.",
  "calendar.detail.rsvp_summary":
    "{accepted} accepted · {tentative} maybe · {declined} declined · {invited} no answer",
  "calendar.detail.add_to_calendar": "Add to calendar",
  "calendar.detail.edit": "Edit",
  "calendar.detail.close": "Close",
  "calendar.detail.cancelled_banner":
    "This event was cancelled. It stays on the calendar so everyone can see it was called off.",
  "calendar.detail.series_note": "One time in a repeating series.",

  "calendar.rsvp.heading": "Will you be there?",
  "calendar.rsvp.accept": "Accept",
  "calendar.rsvp.tentative": "Maybe",
  "calendar.rsvp.decline": "Decline",
  "calendar.rsvp.responding": "Saving your response…",
  "calendar.rsvp.your_answer": "Your answer: {answer}",
  "calendar.rsvp.no_answer": "You haven't answered yet.",
  "calendar.rsvp.state.invited": "No answer yet",
  "calendar.rsvp.state.accepted": "Going",
  "calendar.rsvp.state.tentative": "Maybe",
  "calendar.rsvp.state.declined": "Not going",

  "calendar.composer.create": "Create event",
  "calendar.composer.creating": "Creating…",
  "calendar.composer.created": "Event created.",
  "calendar.editor.create_heading": "New event",
  "calendar.editor.edit_heading": "Edit event",
  "calendar.editor.title": "Title",
  "calendar.editor.title_placeholder": "What is it?",
  "calendar.editor.description": "Description",
  "calendar.editor.start": "Starts",
  "calendar.editor.end": "Ends",
  "calendar.editor.save": "Save changes",
  "calendar.editor.saving": "Saving…",
  "calendar.editor.saved": "Saved.",
  "calendar.editor.discard": "Discard",
  "calendar.editor.marker_hint":
    "Start and end are the same — this is saved as a marker and takes up no time.",
  "calendar.editor.cancel_event": "Cancel event",
  "calendar.editor.cancel_question": "Cancel this event?",
  "calendar.editor.cancel_body":
    "It stays on everyone's calendar marked cancelled, and stops taking up time. This is not the same as deleting it.",
  "calendar.editor.cancel_confirm": "Cancel the event",

  "calendar.recurrence.label": "Repeats",
  "calendar.recurrence.interval": "Every",
  "calendar.recurrence.weekdays": "On these days",
  "calendar.recurrence.ends": "Ends",
  "calendar.recurrence.end.never": "Never",
  "calendar.recurrence.end.until": "On a date",
  "calendar.recurrence.end.count": "After a number of times",
  "calendar.recurrence.until_label": "Last date",
  "calendar.recurrence.count_label": "Number of times",
  "calendar.recurrence.exclusive_hint":
    "A series ends on a date or after a number of times — never both.",
  "calendar.recurrence.preset.none": "Doesn't repeat",
  "calendar.recurrence.preset.daily": "Every day",
  "calendar.recurrence.preset.weekdays": "Every weekday",
  "calendar.recurrence.preset.weekly": "Every week",
  "calendar.recurrence.preset.biweekly": "Every two weeks",
  "calendar.recurrence.preset.monthly": "Every month",
  "calendar.recurrence.preset.custom": "Custom…",

  "calendar.participants.heading": "Invitees",
  "calendar.participants.add": "Invite",
  "calendar.participants.add_placeholder": "User id",
  "calendar.participants.remove": "Remove",
  "calendar.participants.result_heading": "After saving, exactly these people are invited",
  "calendar.participants.replace_warning":
    "Saving replaces the whole invitee list with the one above — anyone not listed loses their invitation.",
  "calendar.participants.nobody": "Nobody would be invited.",
  "calendar.participants.save": "Save invitees",
  "calendar.participants.saving": "Saving…",
  "calendar.participants.saved": "Invitees saved.",
  "calendar.participants.reset": "Undo changes",
  "calendar.participants.added_count.one": "{count} will be invited",
  "calendar.participants.added_count.other": "{count} will be invited",
  "calendar.participants.removed_count.one": "{count} will lose their invitation",
  "calendar.participants.removed_count.other": "{count} will lose their invitation",

  "calendar.delete.action": "Delete event",
  "calendar.delete.question": "Delete this event?",
  "calendar.delete.body":
    "It disappears from everyone's calendar. To call it off but keep it visible, cancel it instead.",
  "calendar.delete.occurrence_body":
    "This is one time in a repeating series. Deleting it removes that time for good — it will not come back the next time the series is drawn.",
  "calendar.delete.confirm": "Delete",
  "calendar.delete.deleting": "Deleting…",

  "calendar.availability.heading": "Free time",
  "calendar.availability.slot_length": "Slot length (minutes)",
  "calendar.availability.slots": "Open slots",
  "calendar.availability.pick": "Book this slot",
  "calendar.availability.busy": "Busy",
  "calendar.availability.no_busy": "Nothing booked in this range.",
  "calendar.availability.no_windows": "No bookable time in this range.",
  "calendar.availability.no_windows_hint":
    "Open slots come from availability windows. None are set, so there is nothing to book yet — this does not mean the time is taken.",
  "calendar.availability.truncated": "This answer is incomplete.",
  "calendar.availability.truncated_hint":
    "A repeating series was too long to expand in full, so later times here may already be taken even though they look free. Narrow the range to get a complete answer.",
  "calendar.availability.refresh": "Refresh",
  "calendar.availability.loading": "Checking your free time…",
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
 * For `ru`/`es`, import the matching `registerCalendarI18n<Locale>` from the
 * `./i18n/ru` / `./i18n/es` subpaths — they are opt-in so a host that ships
 * one language does not carry three.
 */
export function registerCalendarI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, calendarI18nBundleEn);
}
