import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  DeviceTokenResponse,
  FeedReadResponse,
  FeedReadTarget,
  Platform,
} from "../api/types.js";
import { useNotificationsApi } from "./context.js";
import { notificationsQueryKeys } from "./queryKeys.js";
import { markReadLocally } from "./feedCache.js";
import type { FeedCache } from "./feedCache.js";

/**
 * Write hooks (frontend-standard §2 — mutations invalidate on success).
 *
 * Every device mutation invalidates `notificationsQueryKeys.devices()`, which
 * is the read the push toggle derives its position from. That invalidation is
 * the mechanism, not a nicety: the toggle holds no local `enabled` boolean at
 * all, so "did the write land?" and "what does the switch show?" are the same
 * question, asked of the server. Before `GET /devices/` existed (0.17.0) these
 * hooks had nothing to invalidate and the skin kept a `useState(false)` that
 * lied on every mount.
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void` stays in type-reference position, which
 * `no-invalid-void-type` permits.
 */

/** Variables for {@link useRegisterDevice}. */
export interface RegisterDeviceVariables {
  readonly token: string;
  readonly platform: Platform;
}

/** Register (or re-bind) a push token — returns the echoed registration. */
export function useRegisterDevice(): UseMutationResult<
  DeviceTokenResponse,
  StapelApiError,
  RegisterDeviceVariables
> {
  const api = useNotificationsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    DeviceTokenResponse,
    StapelApiError,
    RegisterDeviceVariables
  > = {
    mutationFn: (vars) => api.registerDevice(vars.token, vars.platform),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.devices(),
      }),
  };
  return useMutation(options);
}

/** Unregister a push token by its value — the road for the device that just
 * minted the token and can produce it again. */
export function useUnregisterDevice(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useNotificationsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (token) => api.unregisterDevice(token),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.devices(),
      }),
  };
  return useMutation(options);
}

/**
 * Unregister a device by the id `GET /devices/` handed out — the only road for
 * a device that is not the one this code is running on, whose token this
 * client cannot produce and must never hold.
 *
 * A stale id answers `error.404.device_not_found` (remediation `verify`:
 * re-read the list), deliberately distinct from `error.404.token_not_found` so
 * a client is not sent looking for a token it never sent.
 */
export function useUnregisterDeviceById(): UseMutationResult<
  void,
  StapelApiError,
  number
> {
  const api = useNotificationsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, number> = {
    mutationFn: (deviceId) => api.unregisterDeviceById(deviceId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notificationsQueryKeys.devices(),
      }),
  };
  return useMutation(options);
}

/** What {@link useMarkFeedRead} kept so it can put the cache back. */
export interface MarkFeedReadContext {
  /** The feed cache as it was before the optimistic stamp — `undefined` when
   * nothing had been read yet, which restores to exactly that. */
  readonly previous: FeedCache | undefined;
}

/**
 * Mark feed rows read — one row that was just opened, or the whole feed.
 *
 * ── Why this one is optimistic when the device mutations are not ──────────
 *
 * The device toggle deliberately holds NO local state: it asks the server what
 * is registered and draws the answer, because a switch that flips ahead of a
 * failed write tells a lie about push delivery. Read state is the opposite
 * shape. Marking a row read is idempotent, unprivileged, and its whole purpose
 * is to answer a tap the person already made — a row that stays bold for a
 * round trip after being opened reads as a broken list, and on the "mark all"
 * button that round trip is spent staring at a badge that should already be
 * gone.
 *
 * So the rows are stamped and the badge moved before the request goes
 * (`markReadLocally`, the same transform a `notification.read` frame applies),
 * and the pre-write cache is kept whole so a failure puts every row and the
 * badge back at once. `onSettled` then invalidates: the server's `read_at` and
 * its authoritative `unread_count` replace the local approximation on the next
 * read, whichever way the write went.
 *
 * That invalidation is also the POLLING deployment's whole story for the other
 * direction. A host with no socket never receives `notification.read`, so a
 * mark-all in another tab reaches this one on the 60-second feed poll — late,
 * but never wrong, because the columns on the server are the record and the
 * frame was only ever a shortcut.
 */
export function useMarkFeedRead(): UseMutationResult<
  FeedReadResponse,
  StapelApiError,
  FeedReadTarget,
  MarkFeedReadContext
> {
  const api = useNotificationsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    FeedReadResponse,
    StapelApiError,
    FeedReadTarget,
    MarkFeedReadContext
  > = {
    mutationFn: (target) => api.markFeedRead(target),
    onMutate: async (target) => {
      const key = notificationsQueryKeys.feed();
      // An in-flight page read would land after the stamp and undo it.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FeedCache>(key);
      queryClient.setQueryData<FeedCache>(key, (cache) =>
        markReadLocally(cache, target, new Date().toISOString())
      );
      return { previous };
    },
    onError: (_error, _target, context) => {
      // The whole pre-write cache goes back, not a per-row undo: the badge and
      // the rows moved together and have to return together.
      if (context === undefined) return;
      queryClient.setQueryData<FeedCache>(
        notificationsQueryKeys.feed(),
        context.previous
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.feed() }),
  };
  return useMutation(options);
}
