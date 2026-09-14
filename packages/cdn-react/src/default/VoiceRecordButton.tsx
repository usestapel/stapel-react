/**
 * `<VoiceRecordButton/>` — the microphone, skinned.
 *
 * The default surface over {@link useMediaRecorder}: one control that records,
 * one that stops, one that throws the take away, a clock and a level meter.
 *
 * ── Two arms, one control ─────────────────────────────────────────────────
 *
 * It hands the caller a {@link RecordedClip} (`onRecorded`) and stops there —
 * saying the message is the consuming module's business, which is why this
 * component knows nothing about chat. Given `onUploaded` it ALSO stores the
 * take through the audio intake ({@link useVoiceUpload}) and hands back the
 * `audio/<hash>` key with a length to draw: record → upload → reference, one
 * press to start and one to send. That arm needs a `<CdnProvider>` above it;
 * the record-only arm does not, and the two are separate components under
 * one switch rather than one component with a conditional hook, because a hook
 * behind an `if (props.onUploaded)` is the rule of hooks broken by a prop a
 * parent may change.
 *
 * While a take is uploading the control is OFF and says which step it is on:
 * a second take started then would abort the first upload (`useMediaUpload`
 * is one slot), and losing a voice message to the button that made it is the
 * one thing this arm must not do.
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
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { ErrorAlert, SkinTheme, visuallyHidden } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { useMediaRecorder } from "../headless/useMediaRecorder.js";
import type {
  MediaRecorderBag,
  UseMediaRecorderOptions,
} from "../headless/useMediaRecorder.js";
import { useVoiceUpload } from "../headless/useVoiceUpload.js";
import type { VoiceUploadResult } from "../headless/useVoiceUpload.js";
import type { RecordedClip, RecorderFailure } from "../model/recording.js";
import { formatDurationMs } from "../model/format.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import { PHASE_KEYS } from "./phase.js";

/** How the control is driven. */
export type VoiceInteraction = "toggle" | "hold";

export interface VoiceRecordButtonProps extends UseMediaRecorderOptions {
  /**
   * The clip, once there is one. Called for a real take only — a press too
   * short to produce bytes reports {@link CDN_I18N_KEYS.voiceEmpty} instead,
   * because "nothing was recorded" is not a zero-length recording.
   *
   * With {@link onUploaded} also given, this fires FIRST, before the bytes
   * move — the place to draw an optimistic bubble from the clip's own clock.
   */
  readonly onRecorded?: (clip: RecordedClip) => void;
  /**
   * Store the take through `POST /upload/audio/` and hand back the reference.
   * Requires a `<CdnProvider>` above. The result carries `durationMs` — the
   * server's measurement when it had already happened, else the clip's own
   * clock, with `measured` saying which — and the render snapshot the upload
   * response carried inline.
   */
  readonly onUploaded?: (voice: VoiceUploadResult) => void;
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

function recorderOptionsOf(props: UseMediaRecorderOptions): UseMediaRecorderOptions {
  return {
    ...(props.maxMs !== undefined ? { maxMs: props.maxMs } : {}),
    ...(props.tickMs !== undefined ? { tickMs: props.tickMs } : {}),
    ...(props.constraints !== undefined ? { constraints: props.constraints } : {}),
  };
}

/** The two arms switch HERE, at a component boundary — never around a hook. */
export function VoiceRecordButton(props: VoiceRecordButtonProps): ReactElement {
  return props.onUploaded === undefined ? (
    <RecordOnly {...props} />
  ) : (
    <RecordAndUpload {...props} onUploaded={props.onUploaded} />
  );
}

function RecordOnly(props: VoiceRecordButtonProps): ReactElement {
  const recorder = useMediaRecorder(recorderOptionsOf(props));
  const onRecordedRef = useRef(props.onRecorded);
  onRecordedRef.current = props.onRecorded;
  const onClip = useCallback((clip: RecordedClip): void => {
    onRecordedRef.current?.(clip);
  }, []);
  return <VoiceControl {...props} recorder={recorder} onClip={onClip} />;
}

function RecordAndUpload(
  props: VoiceRecordButtonProps & {
    readonly onUploaded: (voice: VoiceUploadResult) => void;
  }
): ReactElement {
  const t = useT();
  const recorder = useMediaRecorder(recorderOptionsOf(props));
  const voice = useVoiceUpload();
  const onRecordedRef = useRef(props.onRecorded);
  onRecordedRef.current = props.onRecorded;
  const onUploadedRef = useRef(props.onUploaded);
  onUploadedRef.current = props.onUploaded;
  const { upload } = voice;

  const onClip = useCallback(
    async (clip: RecordedClip): Promise<void> => {
      onRecordedRef.current?.(clip);
      const stored = await upload(clip);
      if (stored !== null) onUploadedRef.current(stored);
    },
    [upload]
  );

  return (
    <VoiceControl
      {...props}
      recorder={recorder}
      onClip={onClip}
      busy={voice.isPending}
      status={
        <>
          {voice.isPending ? (
            <Typography.Text type="secondary" data-testid="cdn-voice-upload-phase">
              {t(PHASE_KEYS[voice.phase])}
            </Typography.Text>
          ) : null}
          <ErrorAlert
            variant="inline"
            {...(voice.error === null ? {} : { thrown: voice.error })}
            testId="cdn-voice-upload-error"
          />
        </>
      }
    />
  );
}

/** The surface both arms draw. Owns the gestures and the "nothing recorded" state. */
function VoiceControl(
  props: VoiceRecordButtonProps & {
    readonly recorder: MediaRecorderBag;
    /** The take, handed over. May be async; the control does not wait on it. */
    readonly onClip: (clip: RecordedClip) => void | Promise<void>;
    /** The take before this one is still being stored: no new take may start. */
    readonly busy?: boolean;
    /** What the arm has to say under the control (a phase, an error). */
    readonly status?: ReactNode;
  }
): ReactElement {
  const t = useT();
  const { recorder, onClip } = props;
  const interaction = props.interaction ?? "toggle";
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
      // The clip has been handed over; holding a second copy in the bag would
      // leave the control showing a take the caller already consumed.
      recorder.reset();
      void onClip(clip);
    }
  }, [recorder, onClip]);

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
  const blocked = props.disabled === true || !recorder.supported || props.busy === true;
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

        {props.status}
      </Flex>
    </SkinTheme>
  );
}
