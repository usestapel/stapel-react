import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { RecordingsApi } from "../api/recordingsApi.js";
import type { RecordingsRuntime } from "./runtime.js";

/**
 * The wired RecordingsRuntime shared through React context by
 * `<RecordingsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<RecordingsRuntime> =
  createModuleContext<RecordingsRuntime>("Recordings");

export const RecordingsRuntimeContext: Context<RecordingsRuntime | null> =
  kit.RuntimeContext;

export const useRecordingsRuntime: () => RecordingsRuntime = kit.useRuntime;

export const useRecordingsApi: () => RecordingsApi = kit.useApi;

export const useRecordingsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<RecordingsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<RecordingsRuntime>["Provider"] =
  kit.Provider;
