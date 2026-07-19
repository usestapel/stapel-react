import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  DelayedChangeInitiatedResponse,
  LinkedOAuthAccount,
  OtpChannel,
  StatusResponse,
  TotpDisableRequest,
} from "../api/types.js";
import { useAuthApi, useAuthSession } from "./context.js";
import { authQueryKeys } from "./queryKeys.js";

/**
 * Write hooks with cache invalidation (frontend-standard §2 — "мутации с
 * инвалидацией"). Each invalidates exactly the keys its effect touches so the
 * security screen / session list stay consistent without a manual refetch.
 *
 * Note: options are built as typed `UseMutationOptions` objects rather than
 * `useMutation<…>()` call-site generics — that keeps `void` (no data / no
 * variables) in *type-reference* position, which `no-invalid-void-type`
 * permits, while call-expression type arguments do not.
 */

/** Explicit logout: revoke server-side, tear down the session, drop auth caches. */
export function useLogout(): UseMutationResult<void, StapelApiError, void> {
  const session = useAuthSession();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, void> = {
    mutationFn: () => session.logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
    },
  };
  return useMutation(options);
}

/** Revoke one session (auth-sa.md §12). Immediate — token blacklisted. */
export function useRevokeSession(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<StatusResponse, StapelApiError, string> = {
    mutationFn: (id) => api.revokeSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.sessions() });
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.securityStatus(),
      });
    },
  };
  return useMutation(options);
}

/** Revoke all sessions except the current one (auth-sa.md §12). */
export function useRevokeOtherSessions(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  void
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<StatusResponse, StapelApiError, void> = {
    mutationFn: () => api.revokeOtherSessions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.sessions() });
    },
  };
  return useMutation(options);
}

/** Clear the `is_suspicious` flag ("This was me"). Idempotent (auth-sa.md §12). */
export function useConfirmSession(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<StatusResponse, StapelApiError, string> = {
    mutationFn: (id) => api.confirmSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.sessions() });
    },
  };
  return useMutation(options);
}

/** Remove a passkey (auth-sa.md §17). Guard against `last_auth_method`. */
export function useRemovePasskey(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (id) => api.passkeyRemove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.passkeys() });
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.securityStatus(),
      });
    },
  };
  return useMutation(options);
}

/** Disable TOTP via authenticator/backup/SMS recovery (auth-sa.md §11). */
export function useDisableTotp(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  TotpDisableRequest
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    StatusResponse,
    StapelApiError,
    TotpDisableRequest
  > = {
    mutationFn: (request) => api.totpDisable(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.securityStatus(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Link an additional OAuth provider (`POST /oauth/links/` — WIP on the
 * stapel-auth side, not yet committed/pinned; see api/types.ts's
 * `LinkedOAuthAccount` doc). Same
 * client-side-token-exchange pattern as `oauthLogin` — the host runs the
 * provider's OAuth SDK/popup and hands us the resulting `accessToken`; this
 * pair does not perform that browser step itself (same "thin" boundary as
 * WebAuthn's `webauthnCreate`/`webauthnGet`).
 */
export function useLinkOAuth(): UseMutationResult<
  readonly LinkedOAuthAccount[],
  StapelApiError,
  { provider: string; accessToken: string }
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    readonly LinkedOAuthAccount[],
    StapelApiError,
    { provider: string; accessToken: string }
  > = {
    mutationFn: ({ provider, accessToken }) => api.oauthLink(provider, accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.oauthLinks() });
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.securityStatus() });
    },
  };
  return useMutation(options);
}

/** Unlink an OAuth provider (`DELETE /oauth/links/{provider}/` — WIP, see
 * `LinkedOAuthAccount`'s doc in api/types.ts). */
export function useUnlinkOAuth(): UseMutationResult<void, StapelApiError, string> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (provider) => api.oauthUnlink(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.oauthLinks() });
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.securityStatus() });
    },
  };
  return useMutation(options);
}

/**
 * Start a delayed (14-day) authenticator change — no proof of the OLD
 * channel required, at the cost of a wait + old-channel notifications (auth-
 * sa.md §9). Invalidates `delayedChange(channel)` on success so the
 * pending-status query picks up the freshly-created request without a manual
 * refetch.
 */
export function useInitiateDelayedChange(
  channel: OtpChannel
): UseMutationResult<DelayedChangeInitiatedResponse, StapelApiError, string> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    DelayedChangeInitiatedResponse,
    StapelApiError,
    string
  > = {
    mutationFn: (value) => api.changeDelayedInitiate(channel, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.delayedChange(channel),
      });
    },
  };
  return useMutation(options);
}

/** Cancel a pending delayed authenticator change (auth-sa.md §9). */
export function useCancelDelayedChange(
  channel: OtpChannel
): UseMutationResult<StatusResponse, StapelApiError, string> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<StatusResponse, StapelApiError, string> = {
    mutationFn: (changeRequestId) =>
      api.changeDelayedCancel(channel, changeRequestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.delayedChange(channel),
      });
    },
  };
  return useMutation(options);
}
