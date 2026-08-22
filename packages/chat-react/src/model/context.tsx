import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { ChatApi } from "../api/chatApi.js";
import type { ChatRuntime } from "./runtime.js";

/**
 * The wired ChatRuntime shared through React context by `<ChatProvider>`.
 * Hooks in `model/`, `flows/` and `headless/` read the singletons from here.
 * One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<ChatRuntime> = createModuleContext<ChatRuntime>("Chat");

export const ChatRuntimeContext: Context<ChatRuntime | null> = kit.RuntimeContext;

export const useChatRuntime: () => ChatRuntime = kit.useRuntime;

export const useChatApi: () => ChatApi = kit.useApi;

export const useChatAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<ChatProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<ChatRuntime>["Provider"] = kit.Provider;
