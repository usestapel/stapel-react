import type { ReactElement, ReactNode } from "react";
import { ModuleProvider } from "../model/context.js";
import type { ChatRuntime } from "../model/runtime.js";

/**
 * Provides the wired {@link ChatRuntime} to every chat hook and headless
 * component below it. Bring your own visual shell — this component renders
 * nothing of its own.
 *
 * ```tsx
 * const runtime = createChatRuntime({
 *   baseUrl: "/chat/api/v1",
 *   // sockets are derived from baseUrl's origin; pass `{ socketUrl: null }`
 *   // on a WSGI deployment to go straight to polling.
 * });
 * // give runtime.client to core's <StapelConfigProvider config={{ client }}>
 * <ChatProvider runtime={runtime}>{app}</ChatProvider>
 * ```
 */
export const ChatProvider: (props: {
  runtime: ChatRuntime;
  children: ReactNode;
}) => ReactElement = ModuleProvider;
