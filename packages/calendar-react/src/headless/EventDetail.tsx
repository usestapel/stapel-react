import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  loadStateFromQuery,
  requireLoaded,
} from "@stapel/core";
import type { ActionAvailability, LoadState } from "@stapel/core";
import { eventIcsUrl } from "../api/extensions.js";
import type {
  CalendarEvent,
  Participant,
  ParticipantRsvp,
} from "../api/types.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { useEvent } from "../model/queries.js";

/** How the invitees answered, counted once. */
export interface RsvpRollUp {
  readonly accepted: number;
  readonly tentative: number;
  readonly declined: number;
  /** Server-set initial state — invited and yet to answer. */
  readonly invited: number;
  readonly total: number;
}

/** Render-prop bag for {@link EventDetail}. */
export interface EventDetailBag {
  readonly state: LoadState<CalendarEvent>;
  /**
   * Is the viewer the event's owner? `null` when the host did not tell the
   * component who is looking (no `viewerId`) — which is NOT "no": an
   * owner-only control must then say it cannot tell, rather than silently
   * disappearing or silently offering an action the server will refuse.
   */
  readonly isOwner: boolean | null;
  /** The viewer's own RSVP on this event, when they are an invitee. */
  readonly ownRsvp: ParticipantRsvp | null;
  /** Invitees with their answers, verbatim from `EventResponse.participants`. */
  readonly participants: readonly Participant[];
  /** The answer counts a header shows without the reader counting rows. */
  readonly rsvp: RsvpRollUp;
  /** Owner-only edit/cancel — blocked WITH the reason when it is not offered. */
  readonly canEdit: ActionAvailability;
  /** Owner-only delete/tombstone. */
  readonly canDelete: ActionAvailability;
  /** Owner-only participant replace-set. */
  readonly canManageParticipants: ActionAvailability;
  /** May the viewer answer this invitation? */
  readonly canRespond: ActionAvailability;
  /** Absolute URL of the RFC 5545 `.ics` export — "add to calendar". */
  readonly icsUrl: string | null;
  refetch(): void;
}

const EMPTY_ROLL_UP: RsvpRollUp = {
  accepted: 0,
  tentative: 0,
  declined: 0,
  invited: 0,
  total: 0,
};

function rollUp(participants: readonly Participant[]): RsvpRollUp {
  let accepted = 0;
  let tentative = 0;
  let declined = 0;
  let invited = 0;
  for (const participant of participants) {
    const rsvp = participant.rsvp as ParticipantRsvp;
    if (rsvp === "accepted") accepted += 1;
    else if (rsvp === "tentative") tentative += 1;
    else if (rsvp === "declined") declined += 1;
    else invited += 1;
  }
  return {
    accepted,
    tentative,
    declined,
    invited,
    total: participants.length,
  };
}

/**
 * Headless event detail — one event, its invitees and their answers, and the
 * four availabilities a detail screen needs (`GET /events/{id}`).
 *
 * ── Owner vs invitee is an AXIS, not a hidden control ─────────────────────
 *
 * `PATCH`, `DELETE` and `PUT …/participants` are owner-only on the backend.
 * A screen that simply hid them from an invitee would teach nothing, and one
 * that offered them would produce `error.403.calendar_not_event_owner` on a
 * lit primary. Both are wrong, so this bag hands out {@link ActionAvailability}
 * — the control is switched off WITH a sentence a person can read
 * (`GatedButton` renders it beside the control, never in a tooltip).
 *
 * The viewer's identity is the HOST's to supply: this pair holds no session
 * identity of its own, so `viewerId` is a prop, and its absence is reported
 * honestly as "cannot tell" rather than guessed either way.
 *
 * ```tsx
 * <EventDetail eventId={id} viewerId={me.id}>
 *   {({ state, canEdit }) => ( ... )}
 * </EventDetail>
 * ```
 */
export function EventDetail(props: {
  eventId: string;
  /** The signed-in user's id, from the host's session. */
  viewerId?: string;
  /** The runtime's base URL, for the `.ics` download link. */
  baseUrl?: string;
  children: (bag: EventDetailBag) => ReactNode;
}): ReactNode {
  const { eventId, viewerId } = props;
  const query = useEvent(eventId);
  const state = loadStateFromQuery(query);
  const event = query.data;
  const participants = event?.participants ?? [];

  const isOwner =
    viewerId === undefined || event === undefined
      ? null
      : event.owner_id === viewerId;

  const ownParticipant =
    viewerId === undefined
      ? undefined
      : participants.find((p) => p.user_id === viewerId);
  const ownRsvp = (ownParticipant?.rsvp as ParticipantRsvp | undefined) ?? null;

  const ownerOnly = (): ActionAvailability =>
    requireLoaded(state, () =>
      isOwner === null
        ? actionBlocked(CALENDAR_I18N_KEYS.blockedOwnerUnknown)
        : isOwner
          ? actionAvailable()
          : actionBlocked(CALENDAR_I18N_KEYS.blockedNotOwner)
    );

  const canRespond = requireLoaded(state, (loaded) => {
    if (loaded.status === "cancelled") {
      return actionBlocked(CALENDAR_I18N_KEYS.blockedEventCancelled);
    }
    if (viewerId === undefined) {
      return actionBlocked(CALENDAR_I18N_KEYS.blockedOwnerUnknown);
    }
    return ownParticipant === undefined
      ? actionBlocked(CALENDAR_I18N_KEYS.blockedNotInvited)
      : actionAvailable();
  });

  return props.children({
    state,
    isOwner,
    ownRsvp,
    participants,
    rsvp: event === undefined ? EMPTY_ROLL_UP : rollUp(participants),
    canEdit: ownerOnly(),
    canDelete: ownerOnly(),
    canManageParticipants: ownerOnly(),
    canRespond,
    icsUrl:
      props.baseUrl !== undefined && event !== undefined
        ? eventIcsUrl(props.baseUrl, event.id)
        : null,
    refetch: () => {
      void query.refetch();
    },
  });
}

