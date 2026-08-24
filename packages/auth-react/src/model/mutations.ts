import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  AdminUserCreateRequest,
  AdminUserCreateResponse,
  DelayedChangeInitiatedResponse,
  LinkedOAuthAccount,
  OtpChannel,
  Passkey,
  ServiceKey,
  ServiceKeyPatch,
  ServiceKeyWrite,
  SsoOrg,
  SsoOrgConfig,
  SsoOrgPatch,
  SsoOrgWrite,
  StaffRoleAssignRequest,
  StaffRoleAssignment,
  StatusResponse,
  TotpDisableRequest,
  VerificationPreferenceRow,
} from "../api/types.js";
import { useAuthApi, useAuthSession } from "./context.js";
import { authQueryKeys } from "./queryKeys.js";

/**
 * Write hooks with cache invalidation (frontend-standard §2 — mutations
 * invalidate on success). Each invalidates exactly the keys its effect touches so the
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

/**
 * Start a delayed (14-day) TOTP removal — "lost device", no current code or
 * backup code available (stapel-auth ≥0.9.0). Same shape as
 * {@link useInitiateDelayedChange}, scoped to TOTP; 400 `no_verified_contact`
 * if the account has no verified email/phone to notify — that's a dead end
 * (support case), not a retryable error.
 */
export function useInitiateTotpDelayedChange(): UseMutationResult<
  DelayedChangeInitiatedResponse,
  StapelApiError,
  string | undefined
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    DelayedChangeInitiatedResponse,
    StapelApiError,
    string | undefined
  > = {
    mutationFn: (deviceId) => api.totpChangeDelayedInitiate(deviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.totpDelayedChange(),
      });
    },
  };
  return useMutation(options);
}

/** Cancel a pending delayed TOTP removal (stapel-auth ≥0.9.0). */
export function useCancelTotpDelayedChange(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<StatusResponse, StapelApiError, string> = {
    mutationFn: (changeRequestId) => api.totpChangeDelayedCancel(changeRequestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.totpDelayedChange(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Approve a `login_request` QR: the scanning device tells the backend to mint
 * a session for the device that is waiting on `/qr/{key}/status/`.
 *
 * Nothing is invalidated — the effect of this call lands on the OTHER device,
 * not in this one's caches.
 */
export function useConfirmQrLogin(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const options: UseMutationOptions<StatusResponse, StapelApiError, string> = {
    mutationFn: (key) => api.qrConfirm(key),
  };
  return useMutation(options);
}

/**
 * Decline a `login_request` QR. Not merely "do nothing": the waiting device
 * polls until the key's TTL runs out, so a refusal that is never sent leaves
 * it staring at a code for five minutes with no answer.
 */
export function useRejectQrLogin(): UseMutationResult<
  StatusResponse,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const options: UseMutationOptions<StatusResponse, StapelApiError, string> = {
    mutationFn: (key) => api.qrReject(key),
  };
  return useMutation(options);
}

// ── Step-up verification preferences (auth-sa.md §11) ────────────────────────

/**
 * Turn step-up verification on or off for one scope.
 *
 * ASYMMETRIC BY DESIGN, and the asymmetry is the point: enabling protection
 * applies immediately, while DISABLING it is itself a protected action — the
 * backend answers the 403 verification envelope, which the caller hands to
 * `VerificationChallenge` and retries. So a stolen session cannot quietly
 * switch a person's protections off; it has to pass a factor first.
 */
export function useSetVerificationPreference(): UseMutationResult<
  VerificationPreferenceRow,
  StapelApiError,
  { readonly scope: string; readonly enabled: boolean }
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    VerificationPreferenceRow,
    StapelApiError,
    { readonly scope: string; readonly enabled: boolean }
  > = {
    mutationFn: ({ scope, enabled }) =>
      api.setVerificationPreference(scope, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.verificationPreferences(),
      });
    },
  };
  return useMutation(options);
}

// ── Operator console (staff only) ────────────────────────────────────────────

/** Create an enterprise-SSO organization. */
export function useCreateSsoOrg(): UseMutationResult<
  SsoOrg,
  StapelApiError,
  SsoOrgWrite
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<SsoOrg, StapelApiError, SsoOrgWrite> = {
    mutationFn: (body) => api.createSsoOrg(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.ssoOrgs() });
    },
  };
  return useMutation(options);
}

/** Edit an organization's name / domain / SSO enforcement. */
export function useUpdateSsoOrg(): UseMutationResult<
  SsoOrg,
  StapelApiError,
  { readonly slug: string; readonly body: SsoOrgPatch }
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    SsoOrg,
    StapelApiError,
    { readonly slug: string; readonly body: SsoOrgPatch }
  > = {
    mutationFn: ({ slug, body }) => api.updateSsoOrg(slug, body),
    onSuccess: (_data, { slug }) => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.ssoOrgs() });
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.ssoOrg(slug) });
    },
  };
  return useMutation(options);
}

/**
 * Delete an organization. Every account on its domain loses its SSO route, so
 * the skin confirms in a danger dialog before this runs.
 */
export function useDeleteSsoOrg(): UseMutationResult<void, StapelApiError, string> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (slug) => api.deleteSsoOrg(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.ssoOrgs() });
    },
  };
  return useMutation(options);
}

/**
 * Write an organization's IdP connection. `PUT` when the org has no config
 * yet (the whole object is being stated for the first time), `PATCH` when it
 * has one — the caller passes `replace` to say which, because "create or
 * update" is a fact about the org, not a guess this hook may make.
 */
export function useSaveSsoOrgConfig(): UseMutationResult<
  SsoOrgConfig,
  StapelApiError,
  { readonly slug: string; readonly body: SsoOrgConfig; readonly replace: boolean }
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    SsoOrgConfig,
    StapelApiError,
    { readonly slug: string; readonly body: SsoOrgConfig; readonly replace: boolean }
  > = {
    mutationFn: ({ slug, body, replace }) =>
      replace ? api.putSsoOrgConfig(slug, body) : api.patchSsoOrgConfig(slug, body),
    onSuccess: (_data, { slug }) => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.ssoOrgConfig(slug),
      });
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.ssoOrgs() });
    },
  };
  return useMutation(options);
}

/** Issue a machine credential. The response is the one place the secret exists. */
export function useCreateServiceKey(): UseMutationResult<
  ServiceKey,
  StapelApiError,
  ServiceKeyWrite
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<ServiceKey, StapelApiError, ServiceKeyWrite> = {
    mutationFn: (body) => api.createServiceKey(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.serviceKeys() });
    },
  };
  return useMutation(options);
}

/** Rename a key, change what it may reach, or switch it off. */
export function useUpdateServiceKey(): UseMutationResult<
  ServiceKey,
  StapelApiError,
  { readonly id: number; readonly body: ServiceKeyPatch }
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    ServiceKey,
    StapelApiError,
    { readonly id: number; readonly body: ServiceKeyPatch }
  > = {
    mutationFn: ({ id, body }) => api.updateServiceKey(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.serviceKeys() });
    },
  };
  return useMutation(options);
}

/** Delete a machine credential outright — every caller holding it stops working. */
export function useDeleteServiceKey(): UseMutationResult<
  void,
  StapelApiError,
  number
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, number> = {
    mutationFn: (id) => api.deleteServiceKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.serviceKeys() });
    },
  };
  return useMutation(options);
}

/** Give a person a staff role. */
export function useAssignStaffRole(): UseMutationResult<
  StaffRoleAssignment,
  StapelApiError,
  StaffRoleAssignRequest
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    StaffRoleAssignment,
    StapelApiError,
    StaffRoleAssignRequest
  > = {
    mutationFn: (body) => api.assignStaffRole(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.staffRolesAll(),
      });
    },
  };
  return useMutation(options);
}

/** Take a staff role away. */
export function useRemoveStaffRole(): UseMutationResult<
  void,
  StapelApiError,
  string
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<void, StapelApiError, string> = {
    mutationFn: (assignmentId) => api.removeStaffRole(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: authQueryKeys.staffRolesAll(),
      });
    },
  };
  return useMutation(options);
}

/**
 * Provision an account without the normal registration flow. Nothing to
 * invalidate: this pair has no user LIST to refresh — the created summary the
 * screen shows is the whole result.
 */
export function useCreateAdminUser(): UseMutationResult<
  AdminUserCreateResponse,
  StapelApiError,
  AdminUserCreateRequest
> {
  const api = useAuthApi();
  const options: UseMutationOptions<
    AdminUserCreateResponse,
    StapelApiError,
    AdminUserCreateRequest
  > = {
    mutationFn: (body) => api.createAdminUser(body),
  };
  return useMutation(options);
}

/**
 * Rename a stored passkey. Gated at the CALL SITE by
 * `PASSKEY_RENAME_SUPPORTED` (src/api/authApi.ts): against a backend without
 * `PATCH /passkey/{id}/` this hook exists but the skin never offers the
 * control, so a person is never shown a rename that answers 405.
 */
export function useRenamePasskey(): UseMutationResult<
  Passkey,
  StapelApiError,
  { readonly id: string; readonly deviceName: string }
> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Passkey,
    StapelApiError,
    { readonly id: string; readonly deviceName: string }
  > = {
    mutationFn: ({ id, deviceName }) => api.passkeyRename(id, deviceName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.passkeys() });
    },
  };
  return useMutation(options);
}
