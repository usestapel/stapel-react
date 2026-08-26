/**
 * `@stapel/calendar-react` — the headless React flow pair for stapel-calendar
 * (frontend-standard §2). Business + state only, zero visual opinion. Built on
 * `@stapel/core`'s StapelClient (verification-403 interception, token refresh,
 * i18n, analytics, query layer).
 *
 * Scaffolded by `stapel-new-react-lib`. Layers: api → model → flows → headless
 * → i18n. Generated surfaces (flows registry, error map, manifest, llms.txt)
 * are produced by the monorepo `gen:*` drivers and stand under drift gates.
 */

// ── api ──────────────────────────────────────────────────────────────────────
export { createCalendarApi } from "./api/calendarApi.js";
export type { CalendarApi } from "./api/calendarApi.js";
export {
  eventIcsUrl,
  isSubmittableRsvp,
  SUBMITTABLE_RSVPS,
} from "./api/extensions.js";
export type {
  Schemas,
  CalendarEvent,
  EventCreateRequest,
  EventUpdateRequest,
  ParticipantsReplaceRequest,
  CalendarResponse,
  Occurrence,
  AvailabilityResponse,
  Interval,
  Participant,
  Rsvp,
  ParticipantRsvp,
  EventStatus,
  RecurrenceType,
  CalendarRangeParams,
  AvailabilityParams,
} from "./api/types.js";

// ── flows ────────────────────────────────────────────────────────────────────
// The flow-machine primitive lives in `@stapel/core` (one reviewed copy for
// every pair — frontend-core-architecture §4b). Re-exported for ergonomics.
export { createFlowMachine, useFlow, isErrorCode } from "@stapel/core";
export type {
  FlowMachine,
  FlowMachineOptions,
  FlowStateBase,
  FlowError,
} from "@stapel/core";
export { toFlowError } from "./flows/errors.js";
export { CALENDAR_FLOWS, flowEndpoints } from "./flows/registry.js";
export type {
  CalendarFlowId,
  CalendarFlowSpec,
  FlowEndpoint,
} from "./flows/registry.js";

// ── model (runtime wiring, query keys, context) ──────────────────────────────
export { createCalendarRuntime } from "./model/runtime.js";
export type {
  CalendarRuntime,
  CreateCalendarRuntimeOptions,
} from "./model/runtime.js";
export {
  CalendarRuntimeContext,
  useCalendarRuntime,
  useCalendarApi,
  useCalendarAnalytics,
} from "./model/context.js";
export { calendarQueryKeys } from "./model/queryKeys.js";
export {
  useCalendar,
  useEvents,
  useEvent,
  useAvailability,
} from "./model/queries.js";
export {
  useCreateEvent,
  useUpdateEvent,
  useReplaceParticipants,
  useDeleteEvent,
  useRespondToEvent,
} from "./model/mutations.js";
export type {
  RespondVariables,
  UpdateEventVariables,
  ReplaceParticipantsVariables,
} from "./model/mutations.js";

// ── headless (renderless components) ─────────────────────────────────────────
export { CalendarProvider } from "./headless/CalendarProvider.js";
export { CalendarView } from "./headless/CalendarView.js";
export type {
  CalendarViewBag,
  CalendarRangeData,
} from "./headless/CalendarView.js";
export { EventComposer } from "./headless/EventComposer.js";
export type { EventComposerBag } from "./headless/EventComposer.js";
export { EventRsvp } from "./headless/EventRsvp.js";
export type { EventRsvpBag } from "./headless/EventRsvp.js";
export { EventList } from "./headless/EventList.js";
export type { EventListBag } from "./headless/EventList.js";
export { EventDetail } from "./headless/EventDetail.js";
export type { EventDetailBag, RsvpRollUp } from "./headless/EventDetail.js";
export { EventEditor } from "./headless/EventEditor.js";
export type { EventEditorBag } from "./headless/EventEditor.js";
export { EventDelete } from "./headless/EventDelete.js";
export type { EventDeleteBag } from "./headless/EventDelete.js";
export { ParticipantsEditor } from "./headless/ParticipantsEditor.js";
export type { ParticipantsEditorBag } from "./headless/ParticipantsEditor.js";
export { Availability } from "./headless/Availability.js";
export type { AvailabilityBag, AvailabilityData } from "./headless/Availability.js";

// ── model (formatting, range arithmetic, the wire-contract dedup) ─────────────
export {
  dedupeCalendarRange,
  instancesFromEvents,
} from "./model/occurrences.js";
export type { CalendarInstance, DedupedRange } from "./model/occurrences.js";
export {
  CalendarPeopleProvider,
  useUserName,
  nameInitials,
} from "./model/people.js";
export type {
  UserNameResolver,
  CalendarPeopleProviderProps,
} from "./model/people.js";
export {
  formatTime,
  formatDateTime,
  formatDayHeading,
  formatMonthLabel,
  formatDayNumber,
  formatTimeRange,
  weekdayNames,
  toLocalInput,
  fromLocalInput,
  toDateInput,
  fromDateInput,
} from "./model/format.js";
export {
  viewDays,
  viewRange,
  shiftAnchor,
  isSameDay,
  isOutsideMonth,
  weekdayIndex,
  groupByDay,
} from "./model/range.js";
export type { CalendarViewMode, CalendarRange } from "./model/range.js";
export {
  checkInterval,
  checkSlotMinutes,
  checkTitle,
  DEFAULT_SLOT_MINUTES,
} from "./model/validation.js";
export {
  isMandateDenied,
  isMandateUnavailable,
  isEventNotFound,
} from "./model/refusals.js";
export {
  CALENDAR_RECURRENCE_PRESETS,
  RECURRENCE_ENDS,
  RECURRENCE_LABEL_PREFIX,
  NO_RECURRENCE,
  recurrenceLabelKey,
  recurrenceEndPatch,
  isRecurring,
} from "./model/recurrence.js";
export type {
  RecurrencePreset,
  RecurrenceEnd,
  RecurrenceValue,
  RecurrencePatch,
} from "./model/recurrence.js";

// ── nav manifest (scripted-fullstack navigation) ───────────────────────
export { navEntries } from "./nav/manifest.js";

// ── i18n ─────────────────────────────────────────────────────────────────────
export {
  CALENDAR_I18N_KEYS,
  calendarI18nBundleEn,
  registerCalendarI18n,
} from "./i18n/keys.js";
export type { CalendarI18nKey } from "./i18n/keys.js";

// ── errors map (code → status/params/remediation/en; generated) ──────────────
export {
  CALENDAR_ERRORS,
  CALENDAR_ERROR_CODES,
  calendarErrorBundleEn,
  explainCalendarError,
} from "./i18n/errorsMap.js";
export type {
  CalendarErrorCode,
  CalendarErrorSpec,
  Remediation,
} from "./i18n/errorsMap.js";
