import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { CalendarApi } from "../api/calendarApi.js";
import type { CalendarRuntime } from "./runtime.js";

/**
 * The wired CalendarRuntime shared through React context by
 * `<CalendarProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<CalendarRuntime> =
  createModuleContext<CalendarRuntime>("Calendar");

export const CalendarRuntimeContext: Context<CalendarRuntime | null> =
  kit.RuntimeContext;

export const useCalendarRuntime: () => CalendarRuntime = kit.useRuntime;

export const useCalendarApi: () => CalendarApi = kit.useApi;

export const useCalendarAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<CalendarProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<CalendarRuntime>["Provider"] =
  kit.Provider;
