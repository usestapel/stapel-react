/**
 * The appeal queue bag (the moderator's side of DSA Art. 20).
 *
 * ── Two refusals share a screen and mean opposite things ──────────────────
 *
 * `403 moderation_same_actor` — you decided this case, so somebody else has to
 * hear the appeal. The row is not broken and neither are you: it is simply not
 * yours, and the sheet says so by name.
 * `409 moderation_appeal_resolved` — the appeal was already decided (backend
 * 0.3.0; before that it arrived as `400 invalid_outcome`, which sent a console
 * back to fix an `outcome` that was never wrong).
 *
 * Both are surfaced from the resolve mutation's error rather than guessed from
 * the row's state, because a colleague can decide an appeal between the page
 * being drawn and the sheet being submitted.
 */
import { useCallback, useState } from "react";
import { STAPEL_UI_KEYS, actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import type { AppealOutcome } from "../api/enums.js";
import type { Appeal } from "../api/types.js";
import { MODERATION_I18N_KEYS } from "../i18n/keys.js";
import { useAppealQueueQuery, useResolveAppeal } from "../model/queries.js";

export interface AppealsQueueBag {
  readonly rows: LoadState<readonly Appeal[]>;
  readonly filterState: string;
  readonly setFilterState: (state: string) => void;
  readonly hasMore: boolean;
  readonly loadMore: ActionAvailability;
  readonly runLoadMore: () => void;
  readonly refetch: () => void;
  /** The appeal whose resolve sheet is open, or `null`. */
  readonly resolving: Appeal | null;
  readonly openResolve: (appeal: Appeal) => void;
  readonly closeResolve: () => void;
  readonly outcome: AppealOutcome | "";
  readonly setOutcome: (outcome: AppealOutcome | "") => void;
  readonly note: string;
  readonly setNote: (note: string) => void;
  readonly submit: ActionAvailability;
  readonly run: () => void;
  readonly submitting: boolean;
  /** The last resolve failure, for the sheet's named-refusal arm. */
  readonly error: unknown;
}

export function useAppealsQueue(initialState = "open"): AppealsQueueBag {
  const [filterState, setFilterState] = useState(initialState);
  const page = useAppealQueueQuery(
    filterState !== "" ? { state: filterState } : {}
  );
  const resolve = useResolveAppeal();
  const [resolving, setResolving] = useState<Appeal | null>(null);
  const [outcome, setOutcome] = useState<AppealOutcome | "">("");
  const [note, setNote] = useState("");

  const submit = firstBlock(
    outcome === ""
      ? actionBlocked(MODERATION_I18N_KEYS.appealQueueBlockedNoOutcome)
      : actionAvailable(),
    resolve.isPending
      ? actionBlocked(MODERATION_I18N_KEYS.appealQueueBlockedInFlight)
      : actionAvailable()
  );

  const closeResolve = useCallback((): void => {
    setResolving(null);
    setOutcome("");
    setNote("");
    resolve.reset();
  }, [resolve]);

  const run = useCallback((): void => {
    if (!submit.available || resolving === null || outcome === "") return;
    resolve.mutate(
      {
        appealId: resolving.id,
        outcome,
        ...(note.trim() !== "" ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          setResolving(null);
          setOutcome("");
          setNote("");
        },
      }
    );
  }, [note, outcome, resolve, resolving, submit.available]);

  return {
    rows: page.rows,
    filterState,
    setFilterState,
    hasMore: page.hasMore,
    loadMore: page.loadingMore
      ? actionBlocked(STAPEL_UI_KEYS.loading)
      : actionAvailable(),
    runLoadMore: useCallback(() => {
      page.loadMore();
    }, [page]),
    refetch: useCallback(() => {
      page.refetch();
    }, [page]),
    resolving,
    openResolve: useCallback((appeal: Appeal): void => {
      setResolving(appeal);
      setOutcome("");
      setNote("");
    }, []),
    closeResolve,
    outcome,
    setOutcome,
    note,
    setNote,
    submit,
    run,
    submitting: resolve.isPending,
    error: resolve.error,
  };
}
