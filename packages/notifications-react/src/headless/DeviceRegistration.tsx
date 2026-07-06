import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { DeviceTokenResponse, Platform } from "../api/types.js";
import { useRegisterDevice, useUnregisterDevice } from "../model/mutations.js";

/** Render-prop bag for {@link DeviceRegistration}. */
export interface DeviceRegistrationBag {
  /** Register (or re-bind) a push token for the current user. */
  register(token: string, platform: Platform): void;
  /** Unregister a push token by value. */
  unregister(token: string): void;
  /** A register call is in flight. */
  readonly isRegistering: boolean;
  /** An unregister call is in flight. */
  readonly isUnregistering: boolean;
  /** The last successful registration echoed by the server, else null. */
  readonly registered: DeviceTokenResponse | null;
  /** Either mutation failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Clear both mutations' state. */
  reset(): void;
}

/**
 * Headless push-token registration — renderless wrapper over the register /
 * unregister mutations. Hands a {@link DeviceRegistrationBag} to `children`;
 * bring your own permission-prompt / form UI. Zero visual opinion
 * (frontend-standard §2).
 *
 * ```tsx
 * <DeviceRegistration>
 *   {({ register, isRegistering }) => ( ... )}
 * </DeviceRegistration>
 * ```
 */
export function DeviceRegistration(props: {
  children: (bag: DeviceRegistrationBag) => ReactNode;
}): ReactNode {
  const registerMutation = useRegisterDevice();
  const unregisterMutation = useUnregisterDevice();
  return props.children({
    register: (token, platform) => {
      registerMutation.mutate({ token, platform });
    },
    unregister: (token) => {
      unregisterMutation.mutate(token);
    },
    isRegistering: registerMutation.isPending,
    isUnregistering: unregisterMutation.isPending,
    registered: registerMutation.data ?? null,
    isError: registerMutation.isError || unregisterMutation.isError,
    error: registerMutation.error ?? unregisterMutation.error ?? null,
    reset: () => {
      registerMutation.reset();
      unregisterMutation.reset();
    },
  });
}
