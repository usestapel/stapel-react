import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { DeviceTokenResponse, Platform } from "../api/types.js";
import { useNotificationsApi } from "./context.js";
import { notificationsQueryKeys } from "./queryKeys.js";

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
