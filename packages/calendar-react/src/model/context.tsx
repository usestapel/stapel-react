import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { CalendarApi } from "../api/calendarApi.js";
import type { CalendarRuntime } from "./runtime.js";

/**
 * The wired CalendarRuntime shared through React context by
 * `<CalendarProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here.
 */
export const CalendarRuntimeContext: Context<CalendarRuntime | null> =
  createContext<CalendarRuntime | null>(null);

export function useCalendarRuntime(): CalendarRuntime {
  const runtime = useContext(CalendarRuntimeContext);
  if (runtime === null) {
    throw new Error("Calendar hooks must be used within a <CalendarProvider>");
  }
  return runtime;
}

export function useCalendarApi(): CalendarApi {
  return useCalendarRuntime().api;
}

export function useCalendarAnalytics(): Analytics | null {
  return useCalendarRuntime().analytics;
}
