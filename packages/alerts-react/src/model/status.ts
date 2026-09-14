/**
 * The three writes an operator owns, and the one they do not.
 *
 * ── Fixing is its own endpoint, not a status patch ────────────────────────
 *
 * `POST /issues/{id}/fix` and `PATCH {status: "fixed"}` both leave the row
 * `fixed`, and only the first one records WHICH release claims it and zeroes
 * `count_since_fix`. That counter is the entire answer to "did it come back?",
 * so {@link useIssueStatus}'s `fix` is the POST — a patch to `fixed` would
 * close an issue whose regression nobody could later prove.
 *
 * ── Muting always carries the status ──────────────────────────────────────
 *
 * BACKEND-GAP A-3: `IssueDetailView.patch` reaches `services.set_status` only
 * when the patch carries a `status`, and `set_status` writes `muted_until`
 * only when that status is `muted`. A patch of `muted_until` alone is
 * answered 200 and changes nothing — the worst possible answer, because the
 * screen would then show a mute that does not exist. So `mute` always sends
 * both fields, and "mute forever" sends an explicit `null` rather than
 * omitting the key.
 *
 * ── `regressed` is not offered ────────────────────────────────────────────
 *
 * There is no `regress()` here. The store sets that status from evidence
 * (`services.record`: a fixed issue received a new event), and a caller able
 * to assert it would be a caller able to withhold it. `reopen` puts an issue
 * back to `new`, which is the operator's own judgement and is a different
 * statement entirely.
 *
 * ── One invalidation, because the keys nest ───────────────────────────────
 *
 * `alertsQueryKeys.issues` is a prefix of both the list keys and the detail
 * key, so invalidating it re-asks everything this module caches. Each re-ask
 * is conditional and the body genuinely changed, so exactly the entries that
 * moved come back with a new body; the rest 304.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { Issue, IssueLevel } from "../api/types.js";
import { ALERTS_EVENTS } from "../analytics/events.js";
import { useAlertsAnalytics, useAlertsApi } from "./context.js";
import { alertsQueryKeys } from "./queryKeys.js";

/** The value, or `undefined` when it is blank once trimmed. */
function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : undefined;
}

/** What `fix` is called with. */
export interface FixIssueInput {
  readonly issueId: string;
  /** The release that claims the fix. Optional — a hotfix may have no tag. */
  readonly version?: string;
  /** The commit that claims it. Optional — a human closing by hand has none. */
  readonly sha?: string;
  /**
   * The row's level, for the analytics prop ONLY. The store reads the level
   * off the row it already has; this never reaches the wire.
   */
  readonly level?: IssueLevel;
}

/** What `mute` is called with. */
export interface MuteIssueInput {
  readonly issueId: string;
  /**
   * When the mute lapses, as an ISO-8601 instant. `null` mutes with no
   * deadline — sent explicitly, because the field is only written when the
   * patch carries it (see the module header).
   */
  readonly mutedUntil: string | null;
  /** Why it is muted. Worth a sentence: a silent row with no reason is a trap. */
  readonly note?: string;
  readonly level?: IssueLevel;
}

/** What `reopen` is called with. */
export interface ReopenIssueInput {
  readonly issueId: string;
  readonly note?: string;
  readonly level?: IssueLevel;
}

/** What `annotate` is called with — a note, with no change of status. */
export interface AnnotateIssueInput {
  readonly issueId: string;
  readonly note: string;
}

/** What {@link useIssueStatus} reports. */
export interface IssueStatusBag {
  /** `POST /issues/{id}/fix` — close it with the release that claims it. */
  readonly fix: UseMutationResult<Issue, StapelApiError, FixIssueInput>;
  /** `PATCH {status: "muted", muted_until}` — known, accepted, quiet. */
  readonly mute: UseMutationResult<Issue, StapelApiError, MuteIssueInput>;
  /** `PATCH {status: "new"}` — back on the board, by a person's judgement. */
  readonly reopen: UseMutationResult<Issue, StapelApiError, ReopenIssueInput>;
  /** `PATCH {note}` — a sentence, with no claim about the status. */
  readonly annotate: UseMutationResult<Issue, StapelApiError, AnnotateIssueInput>;
}

/**
 * The write half of the tracker.
 *
 * Every mutation resolves to the issue the server saved, so a caller can show
 * the row it now is rather than the row it asked for — the two differ whenever
 * something else moved the issue between the read and the click.
 */
export function useIssueStatus(): IssueStatusBag {
  const api = useAlertsApi();
  const analytics = useAlertsAnalytics();
  const queryClient = useQueryClient();

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: alertsQueryKeys.issues });
  };

  const fix = useMutation<Issue, StapelApiError, FixIssueInput>({
    mutationFn: (input) => {
      // Both fields are optional upstream and both are RECORDED, so a blank
      // one is not the same as an absent one: `version: ""` is a recorded
      // claim of nothing. Trimmed HERE rather than in the dialog, because the
      // wire contract belongs to the model layer and a host calling this hook
      // directly gets the same discipline a skin does.
      const version = trimmed(input.version);
      const sha = trimmed(input.sha);
      return api.fixIssue(input.issueId, {
        ...(version !== undefined ? { version } : {}),
        ...(sha !== undefined ? { sha } : {}),
      });
    },
    onSuccess: (_issue, input) => {
      analytics?.track(ALERTS_EVENTS.issueFixed, {
        ...(input.level !== undefined ? { level: input.level } : {}),
      });
      invalidate();
    },
  });

  const mute = useMutation<Issue, StapelApiError, MuteIssueInput>({
    mutationFn: (input) => {
      const note = trimmed(input.note);
      return api.patchIssue(input.issueId, {
        status: "muted",
        muted_until: input.mutedUntil,
        ...(note !== undefined ? { note } : {}),
      });
    },
    onSuccess: (_issue, input) => {
      analytics?.track(ALERTS_EVENTS.issueMuted, {
        ...(input.level !== undefined ? { level: input.level } : {}),
        hasDeadline: input.mutedUntil !== null,
      });
      invalidate();
    },
  });

  const reopen = useMutation<Issue, StapelApiError, ReopenIssueInput>({
    mutationFn: (input) => {
      const note = trimmed(input.note);
      return api.patchIssue(input.issueId, {
        status: "new",
        ...(note !== undefined ? { note } : {}),
      });
    },
    onSuccess: (_issue, input) => {
      analytics?.track(ALERTS_EVENTS.issueReopened, {
        ...(input.level !== undefined ? { level: input.level } : {}),
      });
      invalidate();
    },
  });

  const annotate = useMutation<Issue, StapelApiError, AnnotateIssueInput>({
    mutationFn: (input) => api.patchIssue(input.issueId, { note: input.note }),
    onSuccess: invalidate,
  });

  return { fix, mute, reopen, annotate };
}
