/**
 * `<RsvpControl>` — three answers, ONE primary.
 *
 * ── What the visual pass found here ───────────────────────────────────────
 *
 * "Three identical solid primaries side by side: Accept / Maybe / Decline. No
 * hierarchy, and Decline carries the affirmative brand colour." Three equal
 * primaries is not a choice presented, it is a choice refused: nothing on the
 * row says which answer the invitation is asking for, and the brand fill on
 * "Decline" reads as encouragement to decline. So: Accept is the primary, the
 * other two are ordinary buttons, and the answer already on record is marked
 * (`aria-pressed`) rather than re-styled into a fourth appearance.
 *
 * ── `invited` is never offered ────────────────────────────────────────────
 *
 * `ParticipantResponse.rsvp` has four values and only three are submittable;
 * `"invited"` is the server-set initial state. The buttons come from
 * `SUBMITTABLE_RSVPS`, guarded by `isSubmittableRsvp`, so the state a user
 * cannot choose can never appear as a button — a control offering a
 * meaningless option is the same defect as one offering none.
 *
 * ── Blocked is stated, not hidden ─────────────────────────────────────────
 *
 * Not invited, or the event was cancelled, or the host never said who is
 * looking: each is a different sentence and each arrives as an
 * `ActionAvailability` from `<EventDetail>`. `GatedControl` renders it beside
 * the buttons and points their `aria-describedby` at it — never a tooltip,
 * which a disabled control cannot show anyway.
 */
import type { ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { ErrorAlert, GatedControl, SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { actionAvailable, useT } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { EventRsvp } from "../headless/EventRsvp.js";
import { SUBMITTABLE_RSVPS } from "../api/extensions.js";
import type { ParticipantRsvp, Rsvp } from "../api/types.js";
import { CALENDAR_I18N_KEYS } from "../i18n/keys.js";

const LABEL_KEY: Readonly<Record<Rsvp, string>> = {
  accepted: CALENDAR_I18N_KEYS.rsvpAccept,
  tentative: CALENDAR_I18N_KEYS.rsvpTentative,
  declined: CALENDAR_I18N_KEYS.rsvpDecline,
};

const STATE_KEY: Readonly<Record<ParticipantRsvp, string>> = {
  invited: CALENDAR_I18N_KEYS.rsvpStateInvited,
  accepted: CALENDAR_I18N_KEYS.rsvpStateAccepted,
  tentative: CALENDAR_I18N_KEYS.rsvpStateTentative,
  declined: CALENDAR_I18N_KEYS.rsvpStateDeclined,
};

export interface RsvpControlProps {
  readonly eventId: string;
  /** The answer already on record, so the control opens on the truth. */
  readonly current?: ParticipantRsvp | null;
  /** May this person answer? Defaults to available. */
  readonly gate?: ActionAvailability;
  /**
   * Pin a theme side. Omitted, the document's live mode wins — the part
   * self-themes (`SkinTheme`), because a `src/default` part is dropped into
   * host pages and into this pair's own dialogs, and an untended antd
   * `ConfigProvider` serves the compiled-in LIGHT theme: the visual pass
   * photographed this control as black text on a black page.
   */
  readonly mode?: ThemeMode;
  readonly onResponded?: () => void;
  readonly "data-testid"?: string;
}

export function RsvpControl(props: RsvpControlProps): ReactElement {
  const t = useT();
  const testId = props["data-testid"] ?? "calendar-rsvp";
  const gate = props.gate ?? actionAvailable();
  const current = props.current ?? null;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
    <EventRsvp eventId={props.eventId}>
      {(bag) => (
        <Flex vertical gap={spacing["2"]} data-testid={testId}>
          <Typography.Text strong>{t(CALENDAR_I18N_KEYS.rsvpHeading)}</Typography.Text>
          <Typography.Text type="secondary" data-testid={`${testId}-current`}>
            {current === null || current === "invited"
              ? t(CALENDAR_I18N_KEYS.rsvpNoAnswer)
              : t(CALENDAR_I18N_KEYS.rsvpYourAnswer, {
                  answer: t(STATE_KEY[current]),
                })}
          </Typography.Text>
          <GatedControl gate={gate} testId={`${testId}-gate`}>
            {(bind) => (
              <Flex gap={spacing["2"]} wrap>
                {SUBMITTABLE_RSVPS.map((rsvp) => {
                  const selected = current === rsvp;
                  const label = t(LABEL_KEY[rsvp]);
                  return (
                    <Button
                      key={rsvp}
                      // ONE primary: accepting is what an invitation asks for.
                      // The answer on record is marked, not re-coloured.
                      type={rsvp === "accepted" ? "primary" : "default"}
                      {...bind}
                      data-disabled-reason="the gate's reason is rendered by GatedControl beside these buttons"
                      aria-pressed={selected}
                      aria-label={label}
                      loading={bag.isResponding}
                      data-testid={`${testId}-${rsvp}`}
                      data-analytics="none"
                      data-analytics-reason="the pair ships no flow machine for RSVP; the host app wraps with its own tracked()"
                      onClick={() => {
                        bag.respond(rsvp);
                        props.onResponded?.();
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Flex>
            )}
          </GatedControl>
          {bag.isResponding ? (
            <Typography.Text type="secondary" data-testid={`${testId}-pending`}>
              {t(CALENDAR_I18N_KEYS.rsvpResponding)}
            </Typography.Text>
          ) : null}
          <ErrorAlert
            thrown={bag.error}
            variant="inline"
            testId={`${testId}-error`}
            onDismiss={bag.reset}
            dismissLabel={t(CALENDAR_I18N_KEYS.detailClose)}
          />
        </Flex>
      )}
    </EventRsvp>
    </SkinTheme>
  );
}
