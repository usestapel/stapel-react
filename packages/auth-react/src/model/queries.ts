import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  AuditPage,
  AuthSession as AuthSessionRecord,
  Capabilities,
  DelayedChangeStatus,
  OtpChannel,
  Passkey,
  PasswordMethods,
  SecurityStatus,
  SsoLookupResponse,
  StapelUser,
} from "../api/types.js";
import { useAuthApi } from "./context.js";
import { authQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the auth API. Staleness follows core's query defaults;
 * override per call site via `options` where a page needs fresher data (e.g.
 * `sessions` after a revoke). Keys are namespaced (see `authQueryKeys`).
 */

/** Login-method feature matrix — call on the sign-in page (auth-sa.md §"capabilities"). */
export function useCapabilities(): UseQueryResult<Capabilities, StapelApiError> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.capabilities(),
    queryFn: () => api.capabilities(),
    staleTime: 5 * 60_000,
  });
}

/** Current user (auth-sa.md §14). Enabled only when a session exists. */
export function useMe(
  enabled = true
): UseQueryResult<StapelUser, StapelApiError> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.me(),
    queryFn: () => api.me(),
    enabled,
  });
}

/** Security settings snapshot (auth-sa.md §10). */
export function useSecurityStatus(): UseQueryResult<
  SecurityStatus,
  StapelApiError
> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.securityStatus(),
    queryFn: () => api.securityStatus(),
  });
}

/** Password-change tabs (auth-sa.md §4). */
export function usePasswordMethods(): UseQueryResult<
  PasswordMethods,
  StapelApiError
> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.passwordMethods(),
    queryFn: () => api.passwordMethods(),
  });
}

/** Active sessions (auth-sa.md §12). */
export function useSessions(): UseQueryResult<
  readonly AuthSessionRecord[],
  StapelApiError
> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.sessions(),
    queryFn: () => api.sessions(),
  });
}

/** Registered passkeys (auth-sa.md §17). */
export function usePasskeys(): UseQueryResult<
  readonly Passkey[],
  StapelApiError
> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.passkeys(),
    queryFn: () => api.passkeys(),
  });
}

/** A page of the security audit log (auth-sa.md §16). */
export function useAuditLog(
  page = 1
): UseQueryResult<AuditPage, StapelApiError> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.audit(page),
    queryFn: () => api.auditLog(page),
  });
}

/** Pending delayed authenticator change (auth-sa.md §9). */
export function useDelayedChangeStatus(
  channel: OtpChannel
): UseQueryResult<DelayedChangeStatus, StapelApiError> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.delayedChange(channel),
    queryFn: () => api.changeDelayedStatus(channel),
  });
}

/**
 * SSO domain lookup (auth-sa.md §18). Disabled until `domain` is a non-empty
 * value — call after the user finishes typing their email.
 */
export function useSsoLookup(
  domain: string
): UseQueryResult<SsoLookupResponse, StapelApiError> {
  const api = useAuthApi();
  return useQuery({
    queryKey: authQueryKeys.ssoLookup(domain),
    queryFn: () => api.ssoLookup(domain),
    enabled: domain.length > 0,
  });
}
