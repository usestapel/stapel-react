/**
 * `<DeleteEventAction>` — delete, asked first, and told apart from cancel.
 *
 * Two destructive verbs live on an event detail screen and they do different
 * things:
 *
 *   **Cancel** (`<EventEditorSheet>`) sets `status="cancelled"`. The event
 *   stays on everyone's calendar, marked. On a materialized occurrence it is a
 *   tombstone that stops the instant from being expanded again.
 *
 *   **Delete** (this) removes it. On a materialized occurrence the backend
 *   tombstones rather than hard-deleting — precisely so the virtual instant
 *   does not resurrect — which is why the confirmation says something
 *   different when the row is one time in a series.
 *
 * If both were the same red button with different words, the difference would
 * exist only in the backend. So the copy names the consequence, the
 * confirmation is a `SkinConfirm` (a bottom SHEET on a phone, by the shared
 * rule, never a popover anchored to a button somebody's thumb is covering),
 * and the confirm button names the action instead of saying "OK".
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { ErrorAlert, GatedButton, SkinConfirm } from "@stapel/tokens-antd/skin";
import { actionAvailable, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { EventDelete } from "../headless/EventDelete.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";

export interface DeleteEventActionProps {
  readonly eventId: string;
  /** Owner-only on the backend; `<EventDetail>` hands the reason down. */
  readonly gate?: ActionAvailability;
  /**
   * `true` when the row is one time in a repeating series — the confirmation
   * then says what deleting an occurrence actually does.
   */
  readonly isOccurrence?: boolean;
  readonly onDeleted?: () => void;
  readonly "data-testid"?: string;
}

export function DeleteEventAction(
  props: DeleteEventActionProps
): ReactElement {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const testId = props["data-testid"] ?? "calendar-delete";
  const gate = props.gate ?? actionAvailable();

  return (
    <EventDelete eventId={props.eventId}>
      {(bag) => (
        <>
          <GatedButton
            gate={gate}
            danger
            testId={testId}
            data-analytics="none"
            data-analytics-reason="opens the confirmation; the destructive step is the confirm button"
            onClick={() => {
              setAsking(true);
            }}
          >
            {t(CALENDAR_I18N_KEYS.deleteAction)}
          </GatedButton>
          <ErrorAlert
            thrown={bag.error}
            variant="inline"
            testId={`${testId}-error`}
            onDismiss={bag.reset}
            dismissLabel={t(CALENDAR_I18N_KEYS.detailClose)}
          />
          <SkinConfirm
            open={asking}
            danger
            confirming={bag.isDeleting}
            title={t(CALENDAR_I18N_KEYS.deleteQuestion)}
            body={t(
              props.isOccurrence === true
                ? CALENDAR_I18N_KEYS.deleteOccurrenceBody
                : CALENDAR_I18N_KEYS.deleteBody
            )}
            confirmLabel={t(CALENDAR_I18N_KEYS.deleteConfirm)}
            data-testid={`${testId}-confirm`}
            onConfirm={() => {
              bag.remove();
              setAsking(false);
              props.onDeleted?.();
            }}
            onCancel={() => {
              setAsking(false);
            }}
          />
        </>
      )}
    </EventDelete>
  );
}
