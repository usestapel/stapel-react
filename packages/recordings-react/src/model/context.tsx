import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { RecordingsApi } from "../api/recordingsApi.js";
import type { RecordingsRuntime } from "./runtime.js";

/**
 * The wired RecordingsRuntime shared through React context by
 * `<RecordingsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here.
 */
export const RecordingsRuntimeContext: Context<RecordingsRuntime | null> =
  createContext<RecordingsRuntime | null>(null);

export function useRecordingsRuntime(): RecordingsRuntime {
  const runtime = useContext(RecordingsRuntimeContext);
  if (runtime === null) {
    throw new Error("Recordings hooks must be used within a <RecordingsProvider>");
  }
  return runtime;
}

export function useRecordingsApi(): RecordingsApi {
  return useRecordingsRuntime().api;
}

export function useRecordingsAnalytics(): Analytics | null {
  return useRecordingsRuntime().analytics;
}
