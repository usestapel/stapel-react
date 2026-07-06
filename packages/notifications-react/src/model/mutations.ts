import { useMutation } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { DeviceTokenResponse, Platform } from "../api/types.js";
import { useNotificationsApi } from "./context.js";

/**
 * Write hooks (frontend-standard §2 — "мутации с инвалидацией"). Device
 * (un)registration has NO server-state read on this pair to invalidate — the
 * pair exposes no device-list query, and the feed is unaffected by a token
 * binding — so these deliberately carry no `onSuccess` invalidation. When a host
 * adds its own device inventory it invalidates its own key here.
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
  const options: UseMutationOptions<
    DeviceTokenResponse,
    StapelApiError,
    RegisterDeviceVariables
  > = {
    mutationFn: (vars) => api.registerDevice(vars.token, vars.platform),
  };
  return useMutation(options);
}

/** Unregister a push token by its value. */
export function useUnregisterDevice(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useNotificationsApi();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (token) => api.unregisterDevice(token),
  };
  return useMutation(options);
}
