/**
 * `<ParticipantsField>` — the invitee list, shown WHOLE before it is sent.
 *
 * ── Replace-set is the reason this component exists ───────────────────────
 *
 * `PUT /events/{id}/participants` takes the COMPLETE desired invitee list:
 * anyone absent is removed. Behind an "add invitee" button that is a silent
 * data-loss bug with a friendly label — the obvious implementation sends the
 * one person just typed and drops the other eleven.
 *
 * So the surface is not "add"; it is "here is exactly who will be invited
 * after you save", with the additions and removals named beneath it and the
 * warning stated in words. The headless `<ParticipantsEditor>` owns the draft
 * and the diff; this draws them.
 *
 * ── Two modes, one control ────────────────────────────────────────────────
 *
 *  - **managed** (`eventId` + `participants`) — the replace-set editor with
 *    its own save button, for the detail screen.
 *  - **controlled** (`value` + `onChange`) — a plain list field, for the
 *    create form, where `participant_ids` travels inside `POST /events` and
 *    there is nothing to save separately.
 *
 * Both draw the same complete list, because the list IS the message.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Avatar, Button, Flex, Input, List, Typography } from "antd";
import { ErrorAlert, GatedButton, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import {
  actionAvailable,
  actionBlocked,
  useI18n,
  useT,
  useTPlural,
} from "@stapel/core";
import { fontSize, spacing } from "@stapel/tokens";
import type { Participant } from "../api/types.js";
import { ParticipantsEditor } from "../headless/ParticipantsEditor.js";
import { nameInitials, useUserName } from "../model/people.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";

export interface ParticipantsFieldProps {
  /** Managed mode: the event whose invitee set is being replaced. */
  readonly eventId?: string;
  /** Managed mode: the invitees the server currently has. */
  readonly participants?: readonly Participant[];
  /** Controlled mode: the ids currently in the draft. */
  readonly value?: readonly string[];
  /** Controlled mode: the draft changed. */
  readonly onChange?: (next: readonly string[]) => void;
  readonly onSaved?: () => void;
  /**
   * Pin a theme side. Omitted, the document's live mode wins — the part
   * self-themes (`SkinTheme`), because a `src/default` part is dropped into
   * host pages and into this pair's own dialogs, and an untended antd
   * `ConfigProvider` serves the compiled-in LIGHT theme: the visual pass
   * photographed these fields as black text on a black page.
   */
  readonly mode?: ThemeMode;
  readonly "data-testid"?: string;
}

export function ParticipantsField(props: ParticipantsFieldProps): ReactElement {
  const themeProps = props.mode !== undefined ? { mode: props.mode } : {};
  return (
    <SkinTheme surface="bare" {...themeProps}>
      <ParticipantsBody {...props} />
    </SkinTheme>
  );
}

function ParticipantsBody(props: ParticipantsFieldProps): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "calendar-participants";
  if (props.eventId !== undefined) {
    return (
      <ParticipantsEditor
        eventId={props.eventId}
        participants={props.participants ?? []}
      >
        {(bag) => (
          <Flex vertical gap={spacing["2"]} data-testid={testId}>
            <ListEditor
              ids={bag.draft}
              onAdd={bag.add}
              onRemove={bag.remove}
              testId={testId}
            />
            <Diff added={bag.added.length} removed={bag.removed.length} />
            <Flex gap={spacing["2"]} wrap>
              <GatedButton
                type="primary"
                gate={
                  bag.isUnchanged
                    ? actionBlocked(CALENDAR_I18N_KEYS.blockedNoChanges)
                    : actionAvailable()
                }
                loading={bag.isSaving}
                testId={`${testId}-save`}
                data-analytics="none"
                data-analytics-reason="the pair ships no flow machine for the replace-set write; the host app wraps with its own tracked()"
                onClick={() => {
                  bag.submit();
                  props.onSaved?.();
                }}
              >
                {t(
                  bag.isSaving
                    ? CALENDAR_I18N_KEYS.participantsSaving
                    : CALENDAR_I18N_KEYS.participantsSave
                )}
              </GatedButton>
              <Button
                data-analytics="none"
                data-analytics-reason="local revert of an unsent draft"
                data-testid={`${testId}-reset`}
                onClick={bag.reset}
              >
                {t(CALENDAR_I18N_KEYS.participantsReset)}
              </Button>
            </Flex>
            <ErrorAlert
              thrown={bag.error}
              variant="inline"
              testId={`${testId}-error`}
            />
          </Flex>
        )}
      </ParticipantsEditor>
    );
  }

  const ids = props.value ?? [];
  const { onChange } = props;
  return (
    <Flex vertical gap={spacing["2"]} data-testid={testId}>
      <ListEditor
        ids={ids}
        onAdd={(id) => {
          if (!ids.includes(id)) onChange?.([...ids, id]);
        }}
        onRemove={(id) => {
          onChange?.(ids.filter((existing) => existing !== id));
        }}
        testId={testId}
      />
    </Flex>
  );
}

/** The complete resulting set, plus one way in and one way out per row. */
function ListEditor(props: {
  readonly ids: readonly string[];
  readonly onAdd: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly testId: string;
}): ReactElement {
  const t = useT();
  const [pending, setPending] = useState("");
  const canAdd =
    pending.trim().length > 0 && !props.ids.includes(pending.trim());

  return (
    <Flex vertical gap={spacing["2"]}>
      <Typography.Text strong>
        {t(CALENDAR_I18N_KEYS.participantsResultHeading)}
      </Typography.Text>
      {props.ids.length === 0 ? (
        <Typography.Text type="secondary" data-testid={`${props.testId}-nobody`}>
          {t(CALENDAR_I18N_KEYS.participantsNobody)}
        </Typography.Text>
      ) : (
        <List
          size="small"
          bordered
          data-testid={`${props.testId}-list`}
          dataSource={[...props.ids]}
          renderItem={(id) => (
            <InviteeRow
              userId={id}
              testId={props.testId}
              onRemove={props.onRemove}
            />
          )}
        />
      )}
      <Typography.Text type="secondary" style={{ fontSize: fontSize.xs.fontSize }}>
        {t(CALENDAR_I18N_KEYS.participantsReplaceWarning)}
      </Typography.Text>
      <Flex gap={spacing["2"]}>
        <Input
          value={pending}
          placeholder={t(CALENDAR_I18N_KEYS.participantsAddPlaceholder)}
          aria-label={t(CALENDAR_I18N_KEYS.participantsAdd)}
          data-testid={`${props.testId}-input`}
          onChange={(event) => {
            setPending(event.target.value);
          }}
        />
        <Button
          disabled={!canAdd}
          data-disabled-reason="the field beside it is empty or already lists that id — the field IS the reason, and a sentence under it would be noise"
          data-testid={`${props.testId}-add`}
          data-analytics="none"
          data-analytics-reason="edits an unsent draft; nothing is written until save"
          onClick={() => {
            props.onAdd(pending.trim());
            setPending("");
          }}
        >
          {t(CALENDAR_I18N_KEYS.participantsAdd)}
        </Button>
      </Flex>
    </Flex>
  );
}

/**
 * One invitee in the draft: who they are, and one way out.
 *
 * The row used to be the raw id with a RED "Remove" beside it, three of them
 * stacked — no name, no face, and destructive styling on an edit that writes
 * nothing (the replace-set is not sent until "Save invitees"). So: the name
 * the host's resolver gives, an avatar carrying its initials, and a plain
 * text button. Red is reserved for what cannot be undone.
 */
function InviteeRow(props: {
  readonly userId: string;
  readonly testId: string;
  readonly onRemove: (id: string) => void;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const userName = useUserName();
  const name = userName(props.userId);
  return (
    <List.Item
      actions={[
        <Button
          key="remove"
          size="small"
          type="text"
          aria-label={`${t(CALENDAR_I18N_KEYS.participantsRemove)} ${name}`}
          data-testid={`${props.testId}-remove-${props.userId}`}
          data-analytics="none"
          data-analytics-reason="edits an unsent draft; nothing is written until save"
          onClick={() => {
            props.onRemove(props.userId);
          }}
        >
          {t(CALENDAR_I18N_KEYS.participantsRemove)}
        </Button>,
      ]}
    >
      <Flex gap={spacing["2"]} align="center">
        <Avatar size="small" aria-hidden="true">
          {nameInitials(name, locale)}
        </Avatar>
        <span>{name}</span>
      </Flex>
    </List.Item>
  );
}

/** What saving would change, counted — the sentence a replace-set owes. */
function Diff(props: {
  readonly added: number;
  readonly removed: number;
}): ReactElement | null {
  const tPlural = useTPlural();
  if (props.added === 0 && props.removed === 0) return null;
  return (
    <Flex vertical data-testid="calendar-participants-diff">
      {props.added > 0 ? (
        <Typography.Text type="success" style={{ fontSize: fontSize.sm.fontSize }}>
          {tPlural(CALENDAR_I18N_KEYS.participantsAddedCount, {
            count: props.added,
          })}
        </Typography.Text>
      ) : null}
      {props.removed > 0 ? (
        <Typography.Text type="danger" style={{ fontSize: fontSize.sm.fontSize }}>
          {tPlural(CALENDAR_I18N_KEYS.participantsRemovedCount, {
            count: props.removed,
          })}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}
