/**
 * `<EventSheet>` — one event, everything about it, and only the actions the
 * viewer can actually take.
 *
 * ── The refusals are told apart ───────────────────────────────────────────
 *
 * stapel-calendar moved these endpoints onto `HasWorkspaceMandateIfScoped`,
 * which created a refusal class this pair had no words for. Three different
 * answers now reach this sheet and each gets its own sentence:
 *
 *   403 forbidden  — "this calendar belongs to a workspace you're not in"
 *   503 mandate    — "we couldn't CHECK your access" — a wait with a retry,
 *                    never a denial (`model/refusals.ts`)
 *   403 not-owner  — the narrower owner-only refusal, shown beside the
 *                    control it blocks rather than as a page-level error
 *
 * ── Owner controls are switched off WITH the reason ───────────────────────
 *
 * Edit, delete and the invitee replace-set are owner-only. An invitee sees
 * them disabled with a readable sentence beside them (`GatedButton`), not
 * hidden — a control that vanishes teaches nothing, and one that is lit and
 * then refused is worse.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Descriptions, Flex, List, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  LoadBoundary,
  SkinDialog,
} from "@stapel/tokens-antd/skin";
import { useI18n, useT } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import type { CalendarEvent, ParticipantRsvp } from "../api/types.js";
import { EventDetail } from "../headless/EventDetail.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDateTime, formatTimeRange } from "../model/format.js";
import { isMandateDenied, isMandateUnavailable } from "../model/refusals.js";
import { DeleteEventAction } from "./DeleteEventAction.js";
import { EventEditorSheet } from "./EventEditorSheet.js";
import { ParticipantsField } from "./ParticipantsField.js";
import { RsvpControl } from "./RsvpControl.js";

const STATE_KEY: Readonly<Record<ParticipantRsvp, string>> = {
  invited: CALENDAR_I18N_KEYS.rsvpStateInvited,
  accepted: CALENDAR_I18N_KEYS.rsvpStateAccepted,
  tentative: CALENDAR_I18N_KEYS.rsvpStateTentative,
  declined: CALENDAR_I18N_KEYS.rsvpStateDeclined,
};

export interface EventSheetProps {
  readonly eventId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  /** The signed-in user's id — the pair holds no session identity of its own. */
  readonly viewerId?: string;
  /** The runtime's base URL, so "Add to calendar" can point at the `.ics`. */
  readonly baseUrl?: string;
  readonly onDeleted?: () => void;
  readonly "data-testid"?: string;
}

export function EventSheet(props: EventSheetProps): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const testId = props["data-testid"] ?? "calendar-event";
  const [editing, setEditing] = useState(false);

  return (
    <EventDetail
      eventId={props.eventId}
      {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
      {...(props.baseUrl !== undefined ? { baseUrl: props.baseUrl } : {})}
    >
      {(bag) => (
        <>
          <SkinDialog
            open={props.open}
            onClose={props.onClose}
            title={t(CALENDAR_I18N_KEYS.detailHeading)}
            dismissLabel={t(CALENDAR_I18N_KEYS.detailClose)}
            data-testid={testId}
          >
            <LoadBoundary
              state={bag.state}
              onRetry={bag.refetch}
              testId={testId}
              failed={(error) => <RefusalAlert error={error} onRetry={bag.refetch} />}
            >
              {(event) => (
                <Flex vertical gap={spacing["3"]}>
                  <Typography.Title level={4} style={{ marginBottom: spacing["0"] }}>
                    {event.title.length > 0
                      ? event.title
                      : t(CALENDAR_I18N_KEYS.viewUntitled)}
                  </Typography.Title>

                  {event.status === "cancelled" ? (
                    <Alert
                      type="warning"
                      showIcon
                      role="status"
                      data-testid={`${testId}-cancelled`}
                      title={t(CALENDAR_I18N_KEYS.detailCancelledBanner)}
                    />
                  ) : null}

                  <Descriptions
                    size="small"
                    column={1}
                    data-testid={`${testId}-facts`}
                    items={[
                      {
                        key: "when",
                        label: t(CALENDAR_I18N_KEYS.editorStart),
                        children: `${formatDateTime(event.start, locale)} · ${formatTimeRange(
                          event.start,
                          event.end,
                          locale
                        )}`,
                      },
                      {
                        key: "organizer",
                        label: t(CALENDAR_I18N_KEYS.detailOrganizer),
                        children: event.owner_id,
                      },
                    ]}
                  />

                  {event.description.length > 0 ? (
                    <Typography.Paragraph>{event.description}</Typography.Paragraph>
                  ) : (
                    <Typography.Paragraph type="secondary">
                      {t(CALENDAR_I18N_KEYS.detailNoDescription)}
                    </Typography.Paragraph>
                  )}

                  {event.recurrence_parent_id != null ? (
                    <Typography.Text type="secondary" style={{ fontSize: fontSize.sm.fontSize }}>
                      {t(CALENDAR_I18N_KEYS.detailSeriesNote)}
                    </Typography.Text>
                  ) : null}

                  <RsvpControl
                    eventId={event.id}
                    current={bag.ownRsvp}
                    gate={bag.canRespond}
                    data-testid={`${testId}-rsvp`}
                  />

                  <Participants
                    event={event}
                    testId={testId}
                    ownerOnly={bag.canManageParticipants.available}
                  />

                  <Flex gap={spacing["2"]} wrap>
                    <GatedButton
                      gate={bag.canEdit}
                      type="primary"
                      testId={`${testId}-edit`}
                      data-analytics="none"
                      data-analytics-reason="opens the editor sheet; the write is tracked there"
                      onClick={() => {
                        setEditing(true);
                      }}
                    >
                      {t(CALENDAR_I18N_KEYS.detailEdit)}
                    </GatedButton>
                    {bag.icsUrl !== null ? (
                      <Button
                        href={bag.icsUrl}
                        download
                        data-testid={`${testId}-ics`}
                      >
                        {t(CALENDAR_I18N_KEYS.detailAddToCalendar)}
                      </Button>
                    ) : null}
                    <DeleteEventAction
                      eventId={event.id}
                      gate={bag.canDelete}
                      isOccurrence={event.recurrence_parent_id != null}
                      data-testid={`${testId}-delete`}
                      {...(props.onDeleted !== undefined
                        ? { onDeleted: props.onDeleted }
                        : {})}
                    />
                  </Flex>
                </Flex>
              )}
            </LoadBoundary>
          </SkinDialog>

          <EventEditorSheet
            open={editing}
            onClose={() => {
              setEditing(false);
            }}
            {...(bag.state.status === "ready" ? { event: bag.state.data } : {})}
            canEdit={bag.canEdit}
            data-testid={`${testId}-editor`}
          />
        </>
      )}
    </EventDetail>
  );
}

/**
 * A failed detail read, in the words the failure actually deserves. 503 is a
 * WAIT with a retry; 403 is a workspace the viewer is not in; anything else is
 * the shared error surface.
 */
function RefusalAlert(props: {
  readonly error: unknown;
  readonly onRetry: () => void;
}): ReactElement {
  const t = useT();
  if (isMandateUnavailable(props.error)) {
    return (
      <ErrorAlert
        thrown={props.error}
        onRetry={props.onRetry}
        retryLabel={t(CALENDAR_I18N_KEYS.viewRetry)}
        testId="calendar-event-mandate-unavailable"
      />
    );
  }
  if (isMandateDenied(props.error)) {
    return (
      <ErrorAlert
        message={t(CALENDAR_I18N_KEYS.blockedNoMandate)}
        testId="calendar-event-mandate-denied"
      />
    );
  }
  return (
    <ErrorAlert
      thrown={props.error}
      onRetry={props.onRetry}
      retryLabel={t(CALENDAR_I18N_KEYS.viewRetry)}
      testId="calendar-event-failed"
    />
  );
}

/** Invitees and their answers — the owner gets the replace-set editor, an
 * invitee gets the read-only roll-up. */
function Participants(props: {
  readonly event: CalendarEvent;
  readonly testId: string;
  readonly ownerOnly: boolean;
}): ReactElement {
  const t = useT();
  const participants = props.event.participants ?? [];
  if (props.ownerOnly) {
    return (
      <ParticipantsField
        eventId={props.event.id}
        participants={participants}
        data-testid={`${props.testId}-participants`}
      />
    );
  }
  return (
    <Flex vertical gap={spacing["1"]} data-testid={`${props.testId}-participants`}>
      <Typography.Text strong>
        {t(CALENDAR_I18N_KEYS.detailParticipants)}
      </Typography.Text>
      {participants.length === 0 ? (
        <Typography.Text type="secondary">
          {t(CALENDAR_I18N_KEYS.detailNoParticipants)}
        </Typography.Text>
      ) : (
        <List
          size="small"
          dataSource={[...participants]}
          renderItem={(participant) => (
            <List.Item>
              <Flex gap={spacing["2"]} wrap>
                <span>{participant.user_id}</span>
                <Typography.Text type="secondary">
                  {t(STATE_KEY[participant.rsvp as ParticipantRsvp])}
                </Typography.Text>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Flex>
  );
}
