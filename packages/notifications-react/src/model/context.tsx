import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { NotificationsApi } from "../api/notificationsApi.js";
import type { NotificationsRuntime } from "./runtime.js";

/**
 * The wired NotificationsRuntime shared through React context by
 * `<NotificationsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here.
 */
export const NotificationsRuntimeContext: Context<NotificationsRuntime | null> =
  createContext<NotificationsRuntime | null>(null);

export function useNotificationsRuntime(): NotificationsRuntime {
  const runtime = useContext(NotificationsRuntimeContext);
  if (runtime === null) {
    throw new Error("Notifications hooks must be used within a <NotificationsProvider>");
  }
  return runtime;
}

export function useNotificationsApi(): NotificationsApi {
  return useNotificationsRuntime().api;
}

export function useNotificationsAnalytics(): Analytics | null {
  return useNotificationsRuntime().analytics;
}
