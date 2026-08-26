import { useCallback } from "react";
import type { ReactElement, ReactNode } from "react";
import { RealtimeProvider, useOptionalRealtimeClient } from "@stapel/realtime/react";
import { ModuleProvider } from "../model/context.js";
import type { ChatRuntime } from "../model/runtime.js";
import { chatSocketUrlForStreamKey } from "../realtime/streams.js";

/**
 * Provides the wired {@link ChatRuntime} to every chat hook and headless
 * component below it, and — unless the host already runs one — the
 * `@stapel/realtime` client its sockets ride on. Bring your own visual shell;
 * this component renders nothing of its own.
 *
 * ```tsx
 * const runtime = createChatRuntime({
 *   baseUrl: "/chat/api/v1",
 *   // sockets are derived from baseUrl's ORIGIN (ws/chat/<id>,
 *   // ws/chat/inbox); pass `{ socketUrl: null }` on a WSGI deployment and
 *   // the seam polls, and says so.
 * });
 * <ChatProvider runtime={runtime}>{app}</ChatProvider>
 * ```
 *
 * ── Why the provider is conditional ────────────────────────────────────────
 *
 * `@stapel/realtime` is ONE runtime per host: a page that already mounts
 * `<RealtimeProvider>` for notifications, tasks or the video lobby must not
 * gain a second socket stack because it also renders a chat. So when a client
 * is already in context this component adds nothing and chat subscribes to
 * the host's — passing its own URL per stream, so the host's resolver needs
 * no chat knowledge. When there is none, chat brings its own rather than
 * demanding wiring for a product whose whole point is being live.
 *
 * With `socketUrl: null` (or an origin that cannot be resolved) no client is
 * created at all: there is nothing for one to open, and a runtime that exists
 * only to report that it is idle is a socket stack a polling deployment
 * should not be paying for.
 */
export function ChatProvider(props: {
  runtime: ChatRuntime;
  children: ReactNode;
}): ReactElement {
  const existing = useOptionalRealtimeClient();
  const origin = props.runtime.realtime.socketOrigin;
  const url = useCallback(
    (streamKey: string): string => chatSocketUrlForStreamKey(origin, streamKey) ?? "",
    [origin]
  );
  const inner = (
    <ModuleProvider runtime={props.runtime}>{props.children}</ModuleProvider>
  );
  if (existing !== null || origin === null) return inner;
  return (
    <RealtimeProvider url={url} {...props.runtime.realtime.client}>
      {inner}
    </RealtimeProvider>
  );
}
