/**
 * `<MuteIssueDialog>` — known, accepted, and deliberately not notified about.
 *
 * ── Muting stops the notifications, not the recording ─────────────────────
 *
 * That sentence is in the body, first, because it is the one thing people get
 * wrong about a mute: occurrences keep arriving, the count keeps rising, and
 * the row keeps its place on the board. A person who believed otherwise would
 * mute a rising fatal thinking they had parked it.
 *
 * ── "No deadline" is offered, and warned about ────────────────────────────
 *
 * `muted_until` is nullable upstream, so an indefinite mute is a real state
 * and hiding it would only produce the 2099 date somebody types instead. It is
 * the last option, not the first, and choosing it says what it costs: nothing
 * will ever bring this back on its own.
 *
 * ── The patch always carries the status ───────────────────────────────────
 *
 * BACKEND-GAP A-3: `muted_until` is only written when the patch also carries
 * `status`. `useIssueStatus().mute` sends both, always — see `model/status.ts`.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { Flex, Input, Radio, Typography } from "antd";
import { spacing } from "@stapel/tokens";
import { ErrorAlert, SkinButton, SkinDialog } from "@stapel/tokens-antd/skin";
import { useFormat, useT } from "@stapel/core";
import type { IssueLevel } from "../api/types.js";
import { useIssueStatus } from "../model/status.js";
import { ALERTS_I18N_KEYS } from "../i18n/keys.js";
import { DIALOG_ACTION_BAR_STYLE } from "./layout.js";
import type { ThemeModeProp } from "./types.js";

/** How long a mute lasts. `forever` sends an explicit `null`. */
export type MuteWindow = "day" | "week" | "month" | "forever";

const WINDOW_SECONDS: Readonly<Record<Exclude<MuteWindow, "forever">, number>> =
  {
    day: 24 * 60 * 60,
    week: 7 * 24 * 60 * 60,
    month: 30 * 24 * 60 * 60,
  };

/** The instant a window means, taken from the clock at the moment of the choice. */
export function mutedUntilFor(
  span: MuteWindow,
  now: Date = new Date()
): string | null {
  if (span === "forever") return null;
  return new Date(now.getTime() + WINDOW_SECONDS[span] * 1000).toISOString();
}

export interface MuteIssueDialogProps extends ThemeModeProp {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly issueId: string;
  /** The row's level — the analytics prop only; it never reaches the wire. */
  readonly level?: IssueLevel;
  /** Called after the store has saved the mute. */
  readonly onMuted?: () => void;
  readonly testId?: string;
}

export function MuteIssueDialog(props: MuteIssueDialogProps): ReactElement {
  const t = useT();
  const testId = props.testId ?? "alerts-mute";
  return (
    <SkinDialog
      open={props.open}
      onClose={props.onClose}
      title={t(ALERTS_I18N_KEYS.muteTitle)}
      dismissLabel={t(ALERTS_I18N_KEYS.dismiss)}
      data-testid={testId}
    >
      {/* The body exists only while the dialog is open, so the window, the
          note and the mutation's error are dropped together on close. */}
      {props.open ? <MuteIssueForm {...props} testId={testId} /> : null}
    </SkinDialog>
  );
}

function MuteIssueForm(
  props: MuteIssueDialogProps & { readonly testId: string }
): ReactElement {
  const t = useT();
  const fmt = useFormat();
  const { testId } = props;
  const { mute } = useIssueStatus();
  const [span, setSpan] = useState<MuteWindow>("week");
  const [note, setNote] = useState("");

  const until = mutedUntilFor(span);

  const submit = (): void => {
    mute.mutate(
      {
        issueId: props.issueId,
        mutedUntil: mutedUntilFor(span),
        ...(note.trim().length > 0 ? { note: note.trim() } : {}),
        ...(props.level !== undefined ? { level: props.level } : {}),
      },
      {
        onSuccess: () => {
          props.onMuted?.();
          props.onClose();
        },
      }
    );
  };

  return (
    <Flex vertical gap={spacing[3]}>
      <Typography.Text type="secondary">
        {t(ALERTS_I18N_KEYS.muteBody)}
      </Typography.Text>

      <Flex vertical gap={spacing[1]}>
        <Typography.Text strong>{t(ALERTS_I18N_KEYS.muteUntil)}</Typography.Text>
        <Radio.Group
          value={span}
          data-testid={`${testId}-window`}
          onChange={(event) => setSpan(event.target.value as MuteWindow)}
        >
          <Radio value="day" data-testid={`${testId}-window-day`}>
            {t(ALERTS_I18N_KEYS.muteDay)}
          </Radio>
          <Radio value="week" data-testid={`${testId}-window-week`}>
            {t(ALERTS_I18N_KEYS.muteWeek)}
          </Radio>
          <Radio value="month" data-testid={`${testId}-window-month`}>
            {t(ALERTS_I18N_KEYS.muteMonth)}
          </Radio>
          <Radio value="forever" data-testid={`${testId}-window-forever`}>
            {t(ALERTS_I18N_KEYS.muteForever)}
          </Radio>
        </Radio.Group>
        {until === null ? (
          <Typography.Text type="warning" data-testid={`${testId}-forever`}>
            {t(ALERTS_I18N_KEYS.muteForeverHint)}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" data-testid={`${testId}-until`}>
            {fmt.timestamp(until) ?? t(ALERTS_I18N_KEYS.none)}
          </Typography.Text>
        )}
      </Flex>

      <Flex vertical gap={spacing[1]}>
        <Typography.Text strong>{t(ALERTS_I18N_KEYS.muteNote)}</Typography.Text>
        <Input.TextArea
          value={note}
          rows={2}
          aria-label={t(ALERTS_I18N_KEYS.muteNote)}
          placeholder={t(ALERTS_I18N_KEYS.muteNoteHint)}
          data-testid={`${testId}-note`}
          onChange={(event) => setNote(event.target.value)}
        />
      </Flex>

      <ErrorAlert testId={`${testId}-failed`} thrown={mute.error} variant="inline" />

      <Flex gap={spacing[2]} justify="end" style={DIALOG_ACTION_BAR_STYLE}>
        <SkinButton
          data-testid={`${testId}-cancel`}
          data-analytics="none"
          data-analytics-reason="dismissing a dialog decides nothing about the issue"
          onClick={props.onClose}
        >
          {t(ALERTS_I18N_KEYS.cancel)}
        </SkinButton>
        <SkinButton
          type="primary"
          loading={mute.isPending}
          data-testid={`${testId}-submit`}
          data-analytics="none"
          data-analytics-reason="alerts.issue.muted is emitted by the model layer on success"
          onClick={submit}
        >
          {t(ALERTS_I18N_KEYS.muteSubmit)}
        </SkinButton>
      </Flex>
    </Flex>
  );
}
