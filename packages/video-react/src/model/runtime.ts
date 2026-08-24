import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createVideoApi } from "../api/videoApi.js";
import type { VideoApi } from "../api/videoApi.js";

/**
 * The wired video runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects
 * into core's `StapelConfigProvider` (as the default or the `"video"`
 * module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403 seam
 * are supplied by the host's auth runtime on the shared client — this pair
 * does not re-implement them.
 *
 * MANDATE-GATED, AND THE PAIR SAYS SO. The usage read is
 * `HasWorkspaceMandateIfScoped` plus a `USAGE_MANDATE` check IN the scope, so
 * a signed-out visitor and a member of another workspace get the same 404.
 * The read hook is gated on `useActiveSessionReady()` for that reason, and the
 * refusal is surfaced as an explained "not available for this workspace"
 * rather than an empty table.
 */
export type VideoRuntime = ModuleRuntime<VideoApi> & {
  /** See {@link CreateVideoRuntimeOptions.scopeKey}. */
  readonly scopeKey: string | undefined;
  /** See {@link CreateVideoRuntimeOptions.clientSessionId}. */
  readonly clientSessionId: string | undefined;
  /** See {@link CreateVideoRuntimeOptions.wsOrigin}. */
  readonly wsOrigin: string | undefined;
};

export interface CreateVideoRuntimeOptions extends CreateModuleRuntimeOptions {
  /**
   * The partition this app instance reads usage for — the `scope_key` half of
   * `GET /scopes/{scope_key}/usage/` (for meettoday: the workspace id).
   *
   * Optional, and there is no default: the key is HOST-chosen and opaque, and
   * a library that guessed one would be wrong for every host but the one it
   * guessed from. It exists so a container's generated nav can mount
   * `<ScopeUsagePane>` with no props at all. A host whose partition changes
   * during a session (a workspace switcher) passes `scopeKey` to the pane
   * instead and leaves this unset — the pane's prop wins.
   */
  readonly scopeKey?: string;

  /**
   * A stable per-browser id, sent with every create and join.
   *
   * The provider folds it into the connection identity, so a reconnect after a
   * reload lands under the SAME identity and the vendor evicts the pre-reload
   * connection on sight instead of leaving a ghost tile until its disconnect
   * timeout (`dto.JoinRequest`). Omitted, the identity is random per
   * connection: correct, and quietly leaving one ghost per reload per viewer.
   *
   * The HOST supplies it. This pair does not mint one and does not write to
   * storage: "stable across reloads and not across tabs" is a decision about
   * the host's session model, and a library that guessed would either collide
   * two real tabs or lose the property it exists for.
   */
  readonly clientSessionId?: string;

  /**
   * The WebSocket origin the lobby socket lives on, e.g.
   * `wss://api.example.com`. Absent, `<LobbyPanel>` renders the lobby without
   * live updates and SAYS so — it never falls back to a hidden poll.
   *
   * Host-supplied for the same reason `baseUrl` is: the API's origin is not
   * the page's in most deployments, and a browser handshake carries only the
   * cookie the browser attaches to THAT origin.
   */
  readonly wsOrigin?: string;
}

export function createVideoRuntime(
  options: CreateVideoRuntimeOptions
): VideoRuntime {
  const runtime = createModuleRuntime(createVideoApi, options);
  return {
    ...runtime,
    scopeKey: options.scopeKey,
    clientSessionId: options.clientSessionId,
    wsOrigin: options.wsOrigin,
  };
}
