import type { ReactNode } from "react";
import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createModerationApi } from "../api/moderationApi.js";
import type { ModerationApi } from "../api/moderationApi.js";
import type { Case } from "../api/types.js";

/**
 * Host seams this pair cannot answer from the contract.
 *
 * Each one exists because an endpoint does NOT: the module is domain-blind by
 * construction (`MODULE.md` — the target is an opaque `(target_type,
 * target_key)` pair it never parses), so the three things a console most wants
 * — the list of registered types, a preview of the reported thing, a person's
 * name — are all outside what moderation knows.
 */
export interface ModerationHostSeams {
  /**
   * The target types this deployment registered, for the queue's filter and
   * the report form's type picker.
   *
   * There is no endpoint that lists them: `STAPEL_MODERATION["TARGET_TYPES"]`
   * is a merge registry resolved server-side and never published. Absent = the
   * queue filter offers no type list (and says so) and `<ReportButton>` takes
   * its `targetType` as a prop, which is the normal case anyway — a listing
   * card knows it is embedding a listing.
   */
  readonly targetTypes?: readonly string[];
  /**
   * Where an appeal about a case lives, for the link in a takedown
   * notification. Default: `/account/appeals?case=<id>` — the route this
   * pair's own nav manifest declares.
   */
  readonly appealHref?: (caseId: string) => string;
  /**
   * Render an actor id as a name. Every actor on this wire is a bare UUID and
   * no endpoint resolves one, so the default is the short id — profiles are
   * another pair's business and this one will not guess at their contract.
   */
  readonly userLabel?: (userId: string) => string;
  /**
   * A preview of the reported thing in the queue row. The backend serves the
   * target's content on the CASE CARD only (`caseDetail`), never on a list
   * row, so a queue that wanted a thumbnail has to get it from the host that
   * owns the target. Unfilled, the row shows `type:key`, which is the truth.
   */
  readonly renderTarget?: (item: Case) => ReactNode;
}

/**
 * The wired moderation runtime — core's `ModuleRuntime` bound to this pair's
 * API, plus the host seams above. The returned `client` is what the host
 * injects into core's `StapelConfigProvider`; auth token/refresh and the
 * verification-403 step-up seam are supplied by the host's auth runtime on the
 * shared client, so a HIGH-clearance sanction write re-authenticates through
 * `@stapel/auth-react` and never through anything in here.
 */
export type ModerationRuntime = ModuleRuntime<ModerationApi> &
  ModerationHostSeams;

export interface CreateModerationRuntimeOptions
  extends CreateModuleRuntimeOptions,
    ModerationHostSeams {}

/** The route the appeal link points at when the host names no other. */
export const DEFAULT_APPEAL_HREF = (caseId: string): string =>
  `/account/appeals?case=${encodeURIComponent(caseId)}`;

export function createModerationRuntime(
  options: CreateModerationRuntimeOptions
): ModerationRuntime {
  const base = createModuleRuntime(createModerationApi, options);
  return {
    ...base,
    appealHref: options.appealHref ?? DEFAULT_APPEAL_HREF,
    ...(options.targetTypes !== undefined
      ? { targetTypes: options.targetTypes }
      : {}),
    ...(options.userLabel !== undefined ? { userLabel: options.userLabel } : {}),
    ...(options.renderTarget !== undefined
      ? { renderTarget: options.renderTarget }
      : {}),
  };
}
