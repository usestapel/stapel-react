/**
 * The full sentence one instant says, whether or not the layout has room to
 * show it: the time, the title, and the two facts a glyph would otherwise
 * carry alone (it repeats, it was cancelled).
 *
 * It is the accessible name of a grid chip in every density and of an agenda
 * row — a strike-through and a dot are invisible to a screen reader. It lives
 * in its own module because both the grid and the agenda need it and the grid
 * now falls back to the agenda in a narrow box: keeping it in either one
 * would make the two import each other.
 */
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatTime } from "../model/format.js";
import type { CalendarInstance } from "../model/occurrences.js";

export function instanceLabel(
  instance: CalendarInstance,
  locale: string,
  t: (key: string) => string
): string {
  const title =
    instance.title.length > 0
      ? instance.title
      : t(CALENDAR_I18N_KEYS.viewUntitled);
  const parts = [formatTime(instance.start, locale), title];
  if (instance.isVirtual) parts.push(t(CALENDAR_I18N_KEYS.viewRepeats));
  if (instance.status === "cancelled") {
    parts.push(t(CALENDAR_I18N_KEYS.viewCancelled));
  }
  return parts.join(" · ");
}
