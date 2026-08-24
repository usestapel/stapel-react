/**
 * `@stapel/calendar-react/default` — the antd skin over the headless pair: the
 * screens a PERSON sees.
 *
 * A separate entry point (the convention every pair's `/default` follows) so a
 * host rendering its own calendar never pulls `antd` into its bundle. The main
 * entry has no visual opinion at all and no import path from it reaches this
 * directory — size-limit and the bundle-purity test are the teeth on that.
 *
 * ```tsx
 * import { createCalendarRuntime, CalendarProvider } from "@stapel/calendar-react";
 * import { Calendar } from "@stapel/calendar-react/default";
 * ```
 *
 * `<Calendar>` is the wired screen the nav manifest points at (`calendar.month`);
 * `<AvailabilityPane>` is the second (`calendar.availability`). Everything else
 * is exported so a host can place a part in its own layout.
 *
 * There is deliberately NO `CalendarSkinTheme` and NO local `ErrorAlert` here:
 * both live once in `@stapel/tokens-antd/skin` (`SkinTheme`, `ErrorAlert`) and
 * a fifteenth copy of either is the thing the shared substrate exists to end.
 */
export { Calendar } from "./Calendar.js";
export type { CalendarProps } from "./Calendar.js";
export { CalendarMonthGrid } from "./CalendarMonthGrid.js";
export type { CalendarMonthGridProps } from "./CalendarMonthGrid.js";
export { CalendarAgenda } from "./CalendarAgenda.js";
export type { CalendarAgendaProps } from "./CalendarAgenda.js";
export { EventSheet } from "./EventSheet.js";
export type { EventSheetProps } from "./EventSheet.js";
export { EventEditorSheet } from "./EventEditorSheet.js";
export type { EventEditorSheetProps } from "./EventEditorSheet.js";
export { RecurrenceField } from "./RecurrenceField.js";
export type { RecurrenceFieldProps } from "./RecurrenceField.js";
export { ParticipantsField } from "./ParticipantsField.js";
export type { ParticipantsFieldProps } from "./ParticipantsField.js";
export { RsvpControl } from "./RsvpControl.js";
export type { RsvpControlProps } from "./RsvpControl.js";
export { DeleteEventAction } from "./DeleteEventAction.js";
export type { DeleteEventActionProps } from "./DeleteEventAction.js";
export { AvailabilityPane } from "./AvailabilityPane.js";
export type { AvailabilityPaneProps } from "./AvailabilityPane.js";
export { useElementWidth, GRID_MIN_WIDTH, CELL_DENSE_WIDTH } from "./useElementWidth.js";
