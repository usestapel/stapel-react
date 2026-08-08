import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  InvitationPage,
  InvitationPreview,
  InstanceShape,
  InvitationsParams,
  MemberPage,
  MembersParams,
  RoleInfo,
  Workspace,
  WorkspaceList,
} from "../api/types.js";
import { useWorkspacesApi } from "./context.js";
import { workspacesQueryKeys } from "./queryKeys.js";
import { hasCapability } from "./capabilities.js";
import { SENSITIVE_SCOPE, capabilityLevel } from "./stepUp.js";
import type { CapabilityLevel } from "./stepUp.js";

/**
 * Read hooks over the workspaces API. Staleness follows core's query defaults;
 * override per call site via a page that needs fresher data. Keys are
 * namespaced (see `workspacesQueryKeys`).
 */

/**
 * The caller's workspaces — their accepted memberships (GET /).
 *
 * Gated on {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): unlike {@link useWorkspace}/{@link useMembers} below (both
 * naturally disabled until a `workspaceId` is picked), this is the top-level
 * list hook with nothing else to gate it — it fires the instant a component
 * mounts. Without the session ready-gate this is exactly the shape of hook
 * that raced a session still bootstrapping (e.g. right after a QR
 * `session_share` scan set fresh cookies this JS runtime hadn't caught up
 * to yet) and read a live session as "expired" before it had a chance to
 * resolve — zero manual `enabled` wiring needed at each call site by design.
 */
export function useWorkspaces(): UseQueryResult<WorkspaceList, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.list(),
    queryFn: () => api.listWorkspaces(),
    enabled: sessionReady,
  });
}

/**
 * A single workspace by id (GET /{id}). Disabled until a `workspaceId` is
 * given, so a detail hook can mount before a selection exists — AND until
 * the session is ready (a `workspaceId` can be known synchronously, e.g.
 * from a URL param, before the session has finished bootstrapping).
 */
export function useWorkspace(
  workspaceId: string | null
): UseQueryResult<Workspace, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.detail(workspaceId ?? ""),
    queryFn: () => api.getWorkspace(workspaceId as string),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * A page of a workspace's members (GET /{id}/members, anchor-paginated).
 * Disabled until a `workspaceId` is given (and the session is ready — see
 * {@link useWorkspace}). Pass `{ anchor, direction, limit, search }` to jump
 * to a specific page or filter; omit for the newest page (default limit 100).
 */
export function useMembers(
  workspaceId: string | null,
  params?: MembersParams
): UseQueryResult<MemberPage, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: workspacesQueryKeys.membersPage(workspaceId ?? "", p),
    queryFn: () => api.listMembers(workspaceId as string, p),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * One page of a workspace's invitations (GET /{id}/invitations, #109) — the
 * admin's "who has not accepted yet" table. Disabled until a `workspaceId` is
 * given (and the session is ready — see {@link useWorkspace}).
 *
 * ANCHOR pagination, exactly like {@link useMembers}: pass a page's
 * `next_anchor` as `anchor` to walk forward. There is no page NUMBER — an
 * offset would skew the moment an invitation is revoked or accepted while the
 * admin is reading, which on this screen is the normal case, not the edge one.
 * For scroll-to-load-more use {@link useInfiniteInvitations}.
 *
 * `status` defaults to the backend's `pending` (live, seat-reserving
 * invitations); pass `never_accepted` to include declined/revoked/expired, or
 * `all` for the full history.
 */
export function useInvitations(
  workspaceId: string | null,
  params?: InvitationsParams
): UseQueryResult<InvitationPage, StapelApiError> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: workspacesQueryKeys.invitationsPage(workspaceId ?? "", p),
    queryFn: () => api.listInvitations(workspaceId as string, p),
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * A workspace's invitations as an infinite (load-more) list. Follows the
 * backend's ANCHOR pagination and nothing else: the page param IS the
 * previous page's `next_anchor`, and the walk stops when `has_next` goes
 * false. `data.pages.flatMap(p => p.items)` is the flat row list.
 *
 * `filters` (`status` / `search` / `limit`) are part of the query key, so
 * flipping the status tab starts a fresh anchor walk rather than appending
 * rows of one filter to the pages of another.
 */
export function useInfiniteInvitations(
  workspaceId: string | null,
  filters?: Omit<InvitationsParams, "anchor" | "direction">
): UseInfiniteQueryResult<
  InfiniteData<InvitationPage, string | undefined>,
  StapelApiError
> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  const f = filters ?? {};
  return useInfiniteQuery({
    queryKey: workspacesQueryKeys.invitationsInfinite(workspaceId ?? "", f),
    queryFn: ({ pageParam }) =>
      api.listInvitations(workspaceId as string, {
        ...f,
        direction: "next",
        ...(pageParam !== undefined ? { anchor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.has_next ? (last.next_anchor ?? undefined) : undefined,
    enabled: sessionReady && workspaceId !== null && workspaceId !== "",
  });
}

/**
 * The effective role registry (GET /roles, org-program §A2): builtin four +
 * the deployment's `STAPEL_WORKSPACES["ROLES"]` overlay, capability strings
 * verbatim, rank-descending. Deployment-static data — role UI (RoleSelect)
 * reads this instead of hardcoding the builtin four. Session-ready-gated like
 * {@link useWorkspaces} (IsAuthenticated endpoint, mounts at screen top).
 */
export function useRoles(): UseQueryResult<
  readonly RoleInfo[],
  StapelApiError
> {
  const api = useWorkspacesApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: workspacesQueryKeys.roles(),
    queryFn: async () => (await api.listRoles()).roles ?? [],
    enabled: sessionReady,
  });
}

/**
 * Форма развёртывания (GET /instance, без авторизации).
 *
 * Отвечает на вопрос, который экран обязан задать ДО того, как решит, что
 * показать человеку без пространства: это закрытый контур (`landing:
 * "none"` — своего пространства у человека нет и взяться неоткуда) или
 * публичное облако (`"personal"` — есть, и туда можно вести).
 *
 * Зачем хук, а не поле в профиле: его читает ровно тот, у кого доступа уже
 * НЕТ — выброшенный из Спейса или вышедший сам. Поэтому запрос намеренно
 * НЕ ждёт сессии, в отличие от {@link useRoles}: ждать её значило бы
 * никогда не ответить тому, ради кого хук и заведён.
 *
 * Данные статичны для развёртывания — меняются только вместе с ним,
 * поэтому кэш живёт до перезагрузки страницы и не перепрашивается.
 */
export function useInstanceShape(): UseQueryResult<
  InstanceShape,
  StapelApiError
> {
  const api = useWorkspacesApi();
  return useQuery({
    queryKey: workspacesQueryKeys.instance(),
    queryFn: () => api.getInstanceShape(),
    staleTime: Infinity,
  });
}

/**
 * Public invitation preview (GET /invitations/{token}, AllowAny — org-program
 * §B2): what the `/invite/{token}` page renders BEFORE any auth decision.
 * Deliberately NOT session-gated — the whole point is that the invitee may
 * have no session at all; the token in the URL is the bearer secret.
 */
export function useInvitationPreview(
  token: string | null
): UseQueryResult<InvitationPreview, StapelApiError> {
  const api = useWorkspacesApi();
  return useQuery({
    queryKey: workspacesQueryKeys.invitationPreview(token ?? ""),
    queryFn: () => api.getInvitationPreview(token as string),
    enabled: token !== null && token !== "",
  });
}

/** What {@link useCapabilities} returns: the caller's granted capability
 * strings in one workspace plus the wildcard-aware `can()` check. */
export interface CapabilitiesResult {
  /** Verbatim registry strings of the caller's role (wildcards included);
   * empty while loading or when the caller is not a member. */
  readonly capabilities: readonly string[];
  /** Wildcard-aware check (`*` / `prefix.*` — the backend matcher, ported).
   * UI convenience only: the backend re-checks on every operation. */
  can(capability: string): boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

/**
 * The caller's capabilities in one workspace (org-program §A2): reads
 * `my_capabilities` off the workspace detail (`WorkspaceResponse`, additive
 * field since stapel-workspaces 0.6.0) and exposes the ported wildcard
 * matcher. Deny-by-default: `can()` is false while loading, on error, or when
 * the backend predates the field.
 */
export function useCapabilities(workspaceId: string | null): CapabilitiesResult {
  const query = useWorkspace(workspaceId);
  const capabilities = query.data?.my_capabilities ?? [];
  return {
    capabilities,
    can: (capability) => hasCapability(capabilities, capability),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
  };
}

/** What {@link useCapabilityGate} answers about ONE capability, BEFORE the
 * operation is attempted. */
export interface CapabilityGate {
  /** The capability asked about, verbatim. */
  readonly capability: string;
  /** Does the caller's role carry it? Deny-by-default while loading. */
  readonly allowed: boolean;
  /** Its declared step-up level (ported registry — see `./stepUp.js`). */
  readonly level: CapabilityLevel;
  /** True when `level === "high"`: the backend ALSO demands a fresh
   * verification (scope {@link SENSITIVE_SCOPE}) on top of the capability. */
  readonly requiresStepUp: boolean;
  /** The verification scope of that demand, or `null` at `standard`. */
  readonly stepUpScope: string | null;
  readonly isLoading: boolean;
}

/**
 * Ask about one capability BEFORE offering the operation (org-program §A3).
 *
 * Two different answers, both needed in front of the button rather than
 * behind it:
 *
 * * `allowed` — the caller's role carries the mandate. UI convenience only,
 *   deny-by-default; the backend re-checks. This is what replaces guessing
 *   access from the ROLE NAME: a deployment role like `secretary` can hold
 *   `members.invite` and would still fail a `role === "admin"` test forever,
 *   no matter what the registry says.
 * * `requiresStepUp` — the operation is declared `high`, so a fresh step-up
 *   verification is demanded on top. Knowing this up front is what lets a
 *   screen say "you'll be asked to confirm" (or pre-drive enrollment)
 *   instead of showing a button that answers 403.
 *
 * Example — the administrative password reset:
 * ```tsx
 * const gate = useCapabilityGate(workspaceId, "members.password.reset");
 * // gate.allowed === false  → do not render the button at all
 * // gate.requiresStepUp     → render it with the "we will ask you to
 * //                           confirm" affordance, wired to the app's
 * //                           verification controller
 * ```
 */
export function useCapabilityGate(
  workspaceId: string | null,
  capability: string
): CapabilityGate {
  const { can, isLoading } = useCapabilities(workspaceId);
  const level = capabilityLevel(capability);
  return {
    capability,
    allowed: can(capability),
    level,
    requiresStepUp: level === "high",
    stepUpScope: level === "high" ? SENSITIVE_SCOPE : null,
    isLoading,
  };
}
