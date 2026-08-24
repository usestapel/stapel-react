import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { CalendarEvent, Participant } from "../api/types.js";
import { useReplaceParticipants } from "../model/mutations.js";

/** Render-prop bag for {@link ParticipantsEditor}. */
export interface ParticipantsEditorBag {
  /**
   * The COMPLETE resulting invitee list as it stands in the editor — this is
   * what will be sent, and it is what a skin must show before submit.
   */
  readonly draft: readonly string[];
  /** The invitees the server currently has, for the "what changes" summary. */
  readonly current: readonly Participant[];
  /** Ids present now that submitting would REMOVE. */
  readonly removed: readonly string[];
  /** Ids not present now that submitting would INVITE. */
  readonly added: readonly string[];
  /** `true` when the draft matches the server's set — nothing to submit. */
  readonly isUnchanged: boolean;
  add(userId: string): void;
  remove(userId: string): void;
  /** Discard edits and go back to the server's set. */
  reset(): void;
  /** Send the draft as the complete desired invitee list. */
  submit(): void;
  readonly isSaving: boolean;
  readonly saved: CalendarEvent | null;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
}

/**
 * Headless participants editor — `PUT /events/{id}/participants`, which has
 * **replace-set** semantics: the array sent IS the complete desired invitee
 * list, absent ids are removed, and the owner is always kept by the backend.
 *
 * ── Why the bag is a DRAFT and not an `invite(id)` call ───────────────────
 *
 * A replace-set endpoint behind an "add invitee" button silently drops
 * everyone the caller did not happen to list. That is not a UI risk, it is the
 * default outcome of the obvious implementation. So this component owns a
 * draft of the whole set, reports `added`/`removed` against the server's
 * current set, and only submits the complete list — which lets a skin show the
 * resulting set, and the difference, BEFORE anyone commits to it.
 */
export function ParticipantsEditor(props: {
  eventId: string;
  /** The event's current invitees (from `EventResponse.participants`). */
  participants: readonly Participant[];
  children: (bag: ParticipantsEditorBag) => ReactNode;
}): ReactNode {
  const { eventId, participants } = props;
  const serverIds = useMemo(
    () => participants.map((p) => p.user_id),
    [participants]
  );
  const [draft, setDraft] = useState<readonly string[] | null>(null);
  const effective = draft ?? serverIds;
  const mutation = useReplaceParticipants();

  const serverSet = new Set(serverIds);
  const draftSet = new Set(effective);
  const added = effective.filter((id) => !serverSet.has(id));
  const removed = serverIds.filter((id) => !draftSet.has(id));

  return props.children({
    draft: effective,
    current: participants,
    added,
    removed,
    isUnchanged: added.length === 0 && removed.length === 0,
    add: (userId) => {
      const trimmed = userId.trim();
      if (trimmed.length === 0) return;
      setDraft((previous) => {
        const base = previous ?? serverIds;
        return base.includes(trimmed) ? base : [...base, trimmed];
      });
    },
    remove: (userId) => {
      setDraft((previous) => (previous ?? serverIds).filter((id) => id !== userId));
    },
    reset: () => {
      setDraft(null);
      mutation.reset();
    },
    submit: () => {
      mutation.mutate(
        { eventId, participantIds: effective },
        { onSuccess: () => setDraft(null) }
      );
    },
    isSaving: mutation.isPending,
    saved: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
  });
}
