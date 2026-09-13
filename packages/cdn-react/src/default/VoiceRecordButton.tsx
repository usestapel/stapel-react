/**
 * `<VoiceRecordButton/>` — the microphone, skinned.
 *
 * The default surface over {@link useMediaRecorder}: one control that records,
 * one that stops, one that throws the take away, a clock and a level meter. It
 * hands the caller a {@link RecordedClip} and stops there — uploading it and
 * saying it are the consuming module's business, which is why this component
 * knows nothing about chat.
 *
 * ── Two interactions, because a phone and a keyboard want different ones ───
 *
 * `toggle` (the default) is press-to-start, press-to-stop: one button, works
 * from a keyboard, works from a screen reader, and is the only shape that can
 * be operated without a pointer at all. `hold` is the phone idiom — press and
 * hold, release to send — and it is layered ON TOP of the toggle rather than
 * replacing it: a keyboard activation produces a `click` with `detail === 0`
 * and no pointer events at all, so in `hold` mode that click still toggles.
 * A hold-only control would be a record button no keyboard can press, which is
 * the accessibility version of a control that does nothing.
 *
 * ── Every refusal is a sentence ───────────────────────────────────────────
 *
 * Six reasons, six remediations (`i18n/keys.ts`). The unsupported ones are
 * known BEFORE a press — an insecure page, an engine with no recorder — so the
 * control is disabled with the reason beside it rather than left pressable and
 * inert. `denied` can only be known after asking, and lands the moment it is.
 * The gesture hint is NOT an else-branch of the refusal: "how is this worked"
 * and "why is it off" are different questions.
 *
 * ── The meter is the engine's, or it is absent ────────────────────────────
 *
 * `levelAvailable` is false where the page has no `AudioContext`; the bar is
 * then not drawn at all. An always-present bar that never moves says "the
 * microphone hears nothing", which is a different and wrong statement.
 */
import { useCallback, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { SkinTheme, visuallyHidden } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { useMediaRecorder } from "../headless/useMediaRecorder.js";
import type { UseMediaRecorderOptions } from "../headless/useMediaRecorder.js";
import type { RecordedClip, RecorderFailure } from "../model/recording.js";
import { formatDurationMs } from "../model/format.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";

/** How the control is driven. */
export type VoiceInteraction = "toggle" | "hold";

export interface VoiceRecordButtonProps extends UseMediaRecorderOptions {
  /**
   * The clip, once there is one. Called for a real take only — a press too
   * short to produce bytes reports {@link CDN_I18N_KEYS.voiceEmpty} instead,
   * because "nothing was recorded" is not a zero-length recording.
   */
  readonly onRecorded: (clip: RecordedClip) => void;
  /** Default `"toggle"`. See the header for why `hold` is layered, not swapped. */
  readonly interaction?: VoiceInteraction;
  /**
   * Switched off by the host for its own reason (no upload rights, a thread
   * that refuses attachments). The host renders the WHY; this only obeys.
   */
  readonly disabled?: boolean;
  /** Absent means "whatever the host document declares", never a hardcoded side. */
  readonly mode?: ThemeMode;
  readonly testId?: string;
}

const FAILURE_KEY: Readonly<Record<RecorderFailure, string>> = {
  insecure_context: CDN_I18N_KEYS.voiceFailedInsecureContext,
  unsupported: CDN_I18N_KEYS.voiceFailedUnsupported,
  no_codec: CDN_I18N_KEYS.voiceFailedNoCodec,
  denied: CDN_I18N_KEYS.voiceFailedDenied,
  no_device: CDN_I18N_KEYS.voiceFailedNoDevice,
  failed: CDN_I18N_KEYS.voiceFailedFailed,
};

/** The meter's track. Tokens, never a raw colour — §4.1. */
const METER_TRACK: CSSProperties = {
  width: spacing[8],
  height: spacing[2],
  borderRadius: radii.sm,
  background: cssVar("surface-sunken"),
  overflow: "hidden",
};

function Meter(props: { level: number }): ReactElement {
  const t = useT();
  return (
    <div
      style={METER_TRACK}
      role="meter"
      aria-label={t(CDN_I18N_KEYS.voiceLevel)}
      aria-valuenow={Math.round(props.level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid="cdn-voice-level"
    >
      <div
        style={{
          width: `${String(Math.round(props.level * 100))}%`,
          height: "100%",
          background: cssVar("brand"),
        }}
      />
    </div>
  );
}

export function VoiceRecordButton(props: VoiceRecordButtonProps): ReactElement {
  const t = useT();
  const interaction = props.interaction ?? "toggle";
  const recorderOptions: UseMediaRecorderOptions = {
    ...(props.maxMs !== undefined ? { maxMs: props.maxMs } : {}),
    ...(props.tickMs !== undefined ? { tickMs: props.tickMs } : {}),
    ...(props.constraints !== undefined ? { constraints: props.constraints } : {}),
  };
  const recorder = useMediaRecorder(recorderOptions);

  const onRecordedRef = useRef(props.onRecorded);
  onRecordedRef.current = props.onRecorded;
  /**
   * Whether a POINTER drove the current take. It is what tells a hold release
   * apart from the keyboard activation that has no pointer behind it — see the
   * header — and it is a ref because nothing renders differently for it.
   */
  const heldByPointer = useRef(false);
  /**
   * A take that produced no bytes at all. It is a different outcome from a
   * refusal and from a normal finish, and it is the only one with nothing on
   * screen to show for it — so it is stated, or a person who tapped too fast
   * is left watching a control that appeared to do nothing.
   */
  const [empty, setEmpty] = useState(false);

  const take = useCallback(async (): Promise<void> => {
    const clip = await recorder.stop();
    setEmpty(clip === null);
    if (clip !== null) {
      onRecordedRef.current(clip);
      // The clip has been handed over; holding a second copy in the bag would
      // leave the control showing a take the caller already consumed.
      recorder.reset();
    }
  }, [recorder]);

  const onClick = useCallback((): void => {
    if (heldByPointer.current) {
      // The click that follows a pointerup this component already handled.
      heldByPointer.current = false;
      return;
    }
    if (recorder.isRecording) {
      void take();
      return;
    }
    setEmpty(false);
    void recorder.start();
  }, [recorder, take]);

  const onPointerDown = useCallback((): void => {
    if (interaction !== "hold" || recorder.isRecording) return;
    heldByPointer.current = true;
    setEmpty(false);
    void recorder.start();
  }, [interaction, recorder]);

  const onPointerUp = useCallback((): void => {
    if (interaction !== "hold" || !heldByPointer.current) return;
    void take();
  }, [interaction, take]);

  const failure = recorder.failure ?? recorder.unsupportedReason;
  const blocked = props.disabled === true || !recorder.supported;
  const clock = formatDurationMs(recorder.elapsedMs) ?? "";
  const limitClock =
    props.maxMs === undefined ? "" : (formatDurationMs(props.maxMs) ?? "");

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid={props.testId ?? "cdn-voice"}
    >
      <Flex vertical gap={spacing[1]}>
        <Flex align="center" gap={spacing[2]} wrap>
          <Button
            type={recorder.isRecording ? "primary" : "default"}
            danger={recorder.isRecording}
            disabled={blocked}
            loading={recorder.state === "requesting"}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label={t(
              recorder.isRecording
                ? CDN_I18N_KEYS.voiceStop
                : CDN_I18N_KEYS.voiceRecord
            )}
            aria-pressed={recorder.isRecording}
            data-testid="cdn-voice-record"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(
              recorder.isRecording
                ? CDN_I18N_KEYS.voiceStop
                : CDN_I18N_KEYS.voiceRecord
            )}
          </Button>
          {recorder.isRecording ? (
            <>
              <Typography.Text type="secondary" data-testid="cdn-voice-elapsed">
                {clock}
              </Typography.Text>
              {/* The clock is already on screen; this is the same fact as a
                  sentence, for a reader that gets no layout. */}
              <span style={visuallyHidden} role="status">
                {t(CDN_I18N_KEYS.voiceElapsed, { clock })}
              </span>
              {recorder.levelAvailable ? <Meter level={recorder.level} /> : null}
              <Button
                size="small"
                onClick={recorder.cancel}
                aria-label={t(CDN_I18N_KEYS.voiceCancel)}
                data-testid="cdn-voice-cancel"
                data-analytics="none"
                data-analytics-reason="business action — host app wraps with its own tracked()"
              >
                {t(CDN_I18N_KEYS.voiceCancel)}
              </Button>
            </>
          ) : null}
        </Flex>

        {/* The gesture and the refusal answer DIFFERENT questions — "how is
            this control worked" and "why is it off right now" — so the hint is
            not an else-branch of the failure. A hold control whose hint
            disappeared the moment it was refused would leave a person who had
            never seen it work with no idea what the gesture even was. */}
        {interaction === "hold" && !recorder.isRecording ? (
          <Typography.Text type="secondary" data-testid="cdn-voice-hint">
            {t(CDN_I18N_KEYS.voiceHint)}
          </Typography.Text>
        ) : null}

        {failure !== null ? (
          <Typography.Text type="danger" data-testid="cdn-voice-failure">
            {t(FAILURE_KEY[failure])}
          </Typography.Text>
        ) : recorder.state === "requesting" ? (
          <Typography.Text type="secondary" data-testid="cdn-voice-requesting">
            {t(CDN_I18N_KEYS.voiceRequesting)}
          </Typography.Text>
        ) : null}

        {empty ? (
          <Typography.Text type="secondary" data-testid="cdn-voice-empty">
            {t(CDN_I18N_KEYS.voiceEmpty)}
          </Typography.Text>
        ) : null}

        {/* A take that ended at the ceiling SAYS so. A recording that stops on
            its own with no word for it reads as the control breaking. */}
        {recorder.clip?.reachedLimit === true && limitClock !== "" ? (
          <Typography.Text type="secondary" data-testid="cdn-voice-limit">
            {t(CDN_I18N_KEYS.voiceLimitReached, { clock: limitClock })}
          </Typography.Text>
        ) : null}
      </Flex>
    </SkinTheme>
  );
}
