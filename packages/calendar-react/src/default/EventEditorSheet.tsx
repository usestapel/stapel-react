/**
 * `<EventEditorSheet>` — create AND edit, in one surface.
 *
 * One component because it is one screen: the fields are the same, the
 * validation is the same, and a person who has just created an event and wants
 * to fix the time should not meet a differently-shaped form. What differs is
 * the verb on the button and the presence of the cancel arm.
 *
 * ── The dialog is the design system's decision ────────────────────────────
 *
 * `SkinDialog` renders a bottom SHEET below the tablet breakpoint and a centred
 * modal above it, with a grab handle that is a real button (Tab + Enter), safe
 * area insets and scroll containment. No `Modal` is written here; the rule
 * lives once, in `@stapel/tokens-antd/skin`, and `stapel/no-bare-dialog` keeps
 * it that way.
 *
 * ── Cancel is not delete, and it lives here ───────────────────────────────
 *
 * The PATCH arm owns `status: "cancelled"`. It reads as "Cancel event" and its
 * confirmation says what it does — the event stays on everyone's calendar,
 * marked, and stops taking up time. Deleting is a different control on the
 * detail sheet (`<DeleteEventAction>`), with different copy.
 *
 * ── Two 400s answered before the round trip ───────────────────────────────
 *
 * `end < start` and an empty title are refusals this backend documents. They
 * are checked locally (`model/validation.ts`) and rendered as the submit
 * button's blocked reason, so the sentence appears next to the control that is
 * off rather than as a server error after a hopeful click. `end == start` is
 * NOT blocked — it is a valid zero-duration marker, and the form says so
 * instead of quietly changing it.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Alert, Button, Flex, Form, Input, Typography } from "antd";
import {
  ErrorAlert,
  GatedButton,
  SkinConfirm,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import {
  actionAvailable,
  firstBlock,
  useActionGate,
  useI18n,
  useT,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import type { CalendarEvent, EventCreateRequest } from "../api/types.js";
import { EventComposer } from "../headless/EventComposer.js";
import { EventEditor } from "../headless/EventEditor.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";
import { formatDateTime, fromLocalInput, toLocalInput } from "../model/format.js";
import {
  NO_RECURRENCE,
  recurrenceEndPatch,
} from "../model/recurrence.js";
import type { RecurrencePreset, RecurrenceValue } from "../model/recurrence.js";
import { checkInterval, checkTitle } from "../model/validation.js";
import { ParticipantsField } from "./ParticipantsField.js";
import { RecurrenceField } from "./RecurrenceField.js";

export interface EventEditorSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Edit mode: the event being changed. Omitted, the sheet creates one. */
  readonly event?: CalendarEvent;
  /** Create mode: pre-fill the start (the day a person tapped). */
  readonly defaultStart?: string;
  /** Owner-only on the backend; the detail screen hands the reason down. */
  readonly canEdit?: ActionAvailability;
  /** Override the offered recurrence presets (an open registry upstream). */
  readonly presets?: readonly RecurrencePreset[];
  readonly onSaved?: (event: CalendarEvent) => void;
  /** Pin a theme side. Omitted, the document's live mode wins. */
  readonly mode?: ThemeMode;
  readonly "data-testid"?: string;
}

export function EventEditorSheet(props: EventEditorSheetProps): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "calendar-editor";
  const editing = props.event !== undefined;

  return (
    // The sheet portals out of this tree, so its theme has to be declared
    // around it — see the note in `<EventSheet>`.
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(
        editing
          ? CALENDAR_I18N_KEYS.editorEditHeading
          : CALENDAR_I18N_KEYS.editorCreateHeading
      )}
      dismissLabel={t(CALENDAR_I18N_KEYS.detailClose)}
      data-testid={testId}
    >
      {props.event !== undefined ? (
        <EventEditor eventId={props.event.id}>
          {(bag) => (
            <EditorForm
              key={props.event?.id}
              testId={testId}
              {...(props.event !== undefined ? { event: props.event } : {})}
              busy={bag.isSaving}
              error={bag.error}
              saved={bag.saved !== null}
              gate={props.canEdit ?? actionAvailable()}
              {...(props.presets !== undefined ? { presets: props.presets } : {})}
              onSave={(body) => {
                bag.save(body);
                if (bag.saved !== null) props.onSaved?.(bag.saved);
              }}
              onCancelEvent={bag.cancel}
              onDismissError={bag.reset}
            />
          )}
        </EventEditor>
      ) : (
        <EventComposer>
          {(bag) => (
            <EditorForm
              key="new"
              testId={testId}
              busy={bag.isCreating}
              error={bag.error}
              saved={bag.created !== null}
              gate={props.canEdit ?? actionAvailable()}
              {...(props.defaultStart !== undefined
                ? { defaultStart: props.defaultStart }
                : {})}
              {...(props.presets !== undefined ? { presets: props.presets } : {})}
              onSave={(body) => {
                bag.create(body);
                if (bag.created !== null) props.onSaved?.(bag.created);
              }}
              onDismissError={bag.reset}
            />
          )}
        </EventComposer>
      )}
    </SkinDialog>
    </SkinTheme>
  );
}

/** One hour, in milliseconds — the default length of a new event. */
const DEFAULT_DURATION_MS = 3_600_000;

function EditorForm(props: {
  readonly testId: string;
  readonly event?: CalendarEvent;
  readonly defaultStart?: string;
  readonly busy: boolean;
  readonly error: unknown;
  readonly saved: boolean;
  readonly gate: ActionAvailability;
  readonly presets?: readonly RecurrencePreset[];
  readonly onSave: (body: EventCreateRequest) => void;
  readonly onCancelEvent?: () => void;
  readonly onDismissError: () => void;
}): ReactElement {
  const t = useT();
  const { event } = props;
  const openedAt = props.defaultStart ?? new Date().toISOString();

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [start, setStart] = useState(event?.start ?? openedAt);
  const [end, setEnd] = useState(
    event?.end ?? new Date(new Date(openedAt).getTime() + DEFAULT_DURATION_MS).toISOString()
  );
  const [participants, setParticipants] = useState<readonly string[]>(
    (event?.participants ?? []).map((p) => p.user_id)
  );
  const [recurrence, setRecurrence] = useState<RecurrenceValue>({
    ...NO_RECURRENCE,
    ...(event !== undefined ? { type: event.recurrence_type } : {}),
  });
  const [cancelAsking, setCancelAsking] = useState(false);

  const submitGate = firstBlock(
    props.gate,
    checkTitle(title),
    checkInterval(start, end)
  );
  // The PERMISSION half of that gate, on its own. A viewer who may not write
  // this event at all is not told so by a sentence under a submit button
  // three scrolls down a sheet — on a phone that reason was below the fold,
  // which is why the `edit` and `not-owner` shots came out identical. The
  // refusal belongs at the top, where it is read before anything is typed.
  const permission = useActionGate(props.gate);
  const isMarker = start === end;

  return (
    <Flex vertical gap={spacing["3"]} data-testid={`${props.testId}-form`}>
      {permission.disabled && permission.reason !== undefined ? (
        <Alert
          type="info"
          showIcon
          role="status"
          data-testid={`${props.testId}-blocked`}
          title={permission.reason}
        />
      ) : null}
      <Form layout="vertical" component="div">
        <Form.Item label={t(CALENDAR_I18N_KEYS.editorTitle)} required>
          <Input
            value={title}
            placeholder={t(CALENDAR_I18N_KEYS.editorTitlePlaceholder)}
            aria-label={t(CALENDAR_I18N_KEYS.editorTitle)}
            data-testid={`${props.testId}-title`}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
        </Form.Item>
        <Form.Item label={t(CALENDAR_I18N_KEYS.editorDescription)}>
          <Input.TextArea
            value={description}
            rows={3}
            aria-label={t(CALENDAR_I18N_KEYS.editorDescription)}
            data-testid={`${props.testId}-description`}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
        </Form.Item>
        <Flex gap={spacing["3"]} wrap>
          <DateTimeField
            label={t(CALENDAR_I18N_KEYS.editorStart)}
            value={start}
            testId={`${props.testId}-start`}
            onChange={setStart}
          />
          <DateTimeField
            label={t(CALENDAR_I18N_KEYS.editorEnd)}
            value={end}
            testId={`${props.testId}-end`}
            onChange={setEnd}
          />
        </Flex>
        {isMarker ? (
          <Typography.Text type="secondary" data-testid={`${props.testId}-marker-hint`}>
            {t(CALENDAR_I18N_KEYS.editorMarkerHint)}
          </Typography.Text>
        ) : null}
      </Form>

      <RecurrenceField
        value={recurrence}
        onChange={setRecurrence}
        {...(props.presets !== undefined ? { presets: props.presets } : {})}
        data-testid={`${props.testId}-recurrence`}
      />

      <ParticipantsField
        value={participants}
        onChange={setParticipants}
        data-testid={`${props.testId}-participants`}
      />

      <ErrorAlert
        thrown={props.error}
        testId={`${props.testId}-error`}
        onDismiss={props.onDismissError}
        dismissLabel={t(CALENDAR_I18N_KEYS.detailClose)}
      />
      {props.saved ? (
        <Typography.Text type="success" data-testid={`${props.testId}-saved`}>
          {t(
            event === undefined
              ? CALENDAR_I18N_KEYS.composerCreated
              : CALENDAR_I18N_KEYS.editorSaved
          )}
        </Typography.Text>
      ) : null}

      <Flex gap={spacing["2"]} wrap>
        <GatedButton
          type="primary"
          gate={submitGate}
          loading={props.busy}
          testId={`${props.testId}-submit`}
          data-analytics="none"
          data-analytics-reason="the pair ships no flow machine for the write; the host app wraps with its own tracked()"
          onClick={() => {
            props.onSave({
              title,
              description,
              start,
              end,
              participant_ids: [...participants],
              ...recurrenceEndPatch(recurrence),
            });
          }}
        >
          {t(
            props.busy
              ? event === undefined
                ? CALENDAR_I18N_KEYS.composerCreating
                : CALENDAR_I18N_KEYS.editorSaving
              : event === undefined
                ? CALENDAR_I18N_KEYS.composerCreate
                : CALENDAR_I18N_KEYS.editorSave
          )}
        </GatedButton>
        {props.onCancelEvent !== undefined ? (
          <Button
            danger
            data-testid={`${props.testId}-cancel-event`}
            data-analytics="none"
            data-analytics-reason="opens the confirmation; the state change is the confirm button"
            onClick={() => {
              setCancelAsking(true);
            }}
          >
            {t(CALENDAR_I18N_KEYS.editorCancelEvent)}
          </Button>
        ) : null}
      </Flex>

      <SkinConfirm
        open={cancelAsking}
        danger
        confirming={props.busy}
        title={t(CALENDAR_I18N_KEYS.editorCancelQuestion)}
        body={t(CALENDAR_I18N_KEYS.editorCancelBody)}
        confirmLabel={t(CALENDAR_I18N_KEYS.editorCancelConfirm)}
        data-testid={`${props.testId}-cancel-confirm`}
        onConfirm={() => {
          props.onCancelEvent?.();
          setCancelAsking(false);
        }}
        onCancel={() => {
          setCancelAsking(false);
        }}
      />
    </Flex>
  );
}

/**
 * A date-and-time field that says what it holds in the SAME words the rest of
 * the product uses.
 *
 * The control is the platform's `datetime-local` — it is the accessible,
 * zero-dependency, locale-correct way to pick an instant on every device, and
 * on a phone it opens the native wheel. What it will NOT do is render its
 * value in the format the screens around it use: the browser prints
 * `13.07.2026, 13:00` while the detail sheet two taps away says
 * `Jul 13, 2026, 2:00 PM`, and the visual pass counted that as a third date
 * format inside one product (N-5). So the field echoes its own value
 * underneath, through the pair's one formatter — the picker stays native, the
 * SENTENCE is ours.
 */
function DateTimeField(props: {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
  readonly onChange: (iso: string) => void;
}): ReactElement {
  const { locale } = useI18n();
  const local = toLocalInput(props.value);
  return (
    <Form.Item
      label={props.label}
      extra={
        local.length > 0 ? (
          <Typography.Text
            type="secondary"
            style={{ fontSize: fontSize.xs.fontSize }}
            data-testid={`${props.testId}-echo`}
          >
            {formatDateTime(props.value, locale)}
          </Typography.Text>
        ) : null
      }
    >
      <Input
        type="datetime-local"
        value={local}
        aria-label={props.label}
        data-testid={props.testId}
        onChange={(event) => {
          props.onChange(fromLocalInput(event.target.value));
        }}
      />
    </Form.Item>
  );
}
