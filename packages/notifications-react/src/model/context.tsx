import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { NotificationsApi } from "../api/notificationsApi.js";
import type { NotificationsRuntime } from "./runtime.js";

/**
 * The wired NotificationsRuntime shared through React context by
 * `<NotificationsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<NotificationsRuntime> =
  createModuleContext<NotificationsRuntime>("Notifications");

export const NotificationsRuntimeContext: Context<NotificationsRuntime | null> =
  kit.RuntimeContext;

export const useNotificationsRuntime: () => NotificationsRuntime = kit.useRuntime;

export const useNotificationsApi: () => NotificationsApi = kit.useApi;

export const useNotificationsAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<NotificationsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<NotificationsRuntime>["Provider"] =
  kit.Provider;
