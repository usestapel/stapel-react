import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { FormsApi } from "../api/formsApi.js";
import type { FormsRuntime } from "./runtime.js";

/**
 * The wired FormsRuntime shared through React context by
 * `<FormsProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<FormsRuntime> =
  createModuleContext<FormsRuntime>("Forms");

export const FormsRuntimeContext: Context<FormsRuntime | null> =
  kit.RuntimeContext;

export const useFormsRuntime: () => FormsRuntime = kit.useRuntime;

export const useFormsApi: () => FormsApi = kit.useApi;

export const useFormsAnalytics: () => Analytics | null = kit.useAnalytics;

/**
 * The workspace an admin screen acts in: the screen's own prop when it has
 * one, otherwise the runtime's `workspaceId` (see `model/runtime.ts` for why
 * the scope lives on the runtime), otherwise `null`.
 *
 * `null` is returned rather than thrown: a routed screen that reaches a host
 * with no workspace declared must be able to SAY so — a thrown error inside a
 * route renders a blank page and blames nothing.
 */
export function useFormsWorkspaceId(explicit?: string): string | null {
  const runtime = useFormsRuntime();
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const fromRuntime = runtime.workspaceId;
  return fromRuntime !== undefined && fromRuntime.length > 0
    ? fromRuntime
    : null;
}

/** @internal Re-exported as `<FormsProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<FormsRuntime>["Provider"] =
  kit.Provider;
