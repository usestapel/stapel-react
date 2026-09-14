/**
 * THE COMPOSE SIDE, WIRED TO THE CDN.
 *
 * `headless/useAttachmentDraft` owns the waiting and knows nothing about where
 * bytes go; this file is the one place in the pair that knows, and it lives in
 * `/default` for that reason — `@stapel/cdn-react` is an OPTIONAL peer, reached
 * only from the subpath a host opts into.
 *
 * Three pieces:
 *   {@link useCdnAttachmentUpload}  bytes → an opaque `<type>/<hash>` key
 *   {@link AttachButton}            the picker, with the CDN's own allowlists
 *   {@link AttachmentChips}         what is pending, and what went wrong
 *
 * ── The intake a registry type lands in ───────────────────────────────────
 *
 * stapel-cdn has five upload endpoints and stapel-chat has five builtin
 * attachment types, and they do NOT map one to one:
 *
 *   image, gif  → `POST /upload/image/`   (both are image rows; `gif` is its
 *                                          own chat type so a client can offer
 *                                          a play affordance without sniffing)
 *   video       → `POST /upload/video/`
 *   audio       → `POST /upload/audio/`   (stapel-cdn 0.21.0 — the intake this
 *                                          file recorded as MISSING until then;
 *                                          `@stapel/cdn-react` >= 0.6.0)
 *   file, other → `POST /upload/file/`    (an unregistered type this build has
 *                                          never heard of is bytes with a name)
 *
 * ── A voice message goes through the SAME seam as a photo ─────────────────
 *
 * {@link VoiceAttachButton} is `@stapel/cdn-react`'s `<VoiceRecordButton>`
 * with its clip handed to the draft as an `audio` attachment: `draft.add`
 * with `{type: "audio"}`, which is the option `useAttachmentDraft` has carried
 * since 0.19.0 for exactly this ("a recording is `audio`, whatever its MIME").
 * From there it is a chip like any other — the step named while it goes,
 * remove and retry, the send blocked until it is stored — and
 * {@link useCdnAttachmentUpload} routes it to the audio intake through the
 * one map below. Nothing in the headless entry moved, and a host that wired
 * `upload={useCdnAttachmentUpload()}` for photos has wired voice too; the
 * button itself is behind `<ConversationThreadPanel voice>` because a
 * microphone control is a product decision a thread owner makes, not a
 * consequence of being able to attach a file.
 *
 * The clip is NOT routed through `POST /upload/file/`, and never was: a
 * `file/<hash>` reference has no waveform and no duration EVER, and a voice
 * message that can never show its length is a silently degraded one.
 */
import { useCallback, useMemo, useRef } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Button, Flex, Tag, Typography } from "antd";
import { useActionGate, useT } from "@stapel/core";
import {
  acceptAttribute,
  limitsForTarget,
  runUpload,
  useCdnRuntime,
  voiceFileName,
} from "@stapel/cdn-react";
import type { CdnRenderMeta, CdnUploadTarget, RecordedClip } from "@stapel/cdn-react";
import { VoiceRecordButton } from "@stapel/cdn-react/default";
import type { VoiceInteraction } from "@stapel/cdn-react/default";
import { spacing } from "@stapel/tokens";
import type { Attachment } from "../api/types.js";
import type {
  AttachmentDraftBag,
  AttachmentUpload,
} from "../headless/useAttachmentDraft.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** Which stapel-cdn intake a chat attachment type is stored through. */
const TARGET_BY_TYPE: Readonly<Record<string, CdnUploadTarget>> = {
  image: { kind: "image" },
  gif: { kind: "image" },
  video: { kind: "video" },
  audio: { kind: "audio" },
  file: { kind: "file" },
};

/** Types this build can store — the five builtin ones, since stapel-cdn 0.21.0. */
export const STORABLE_ATTACHMENT_TYPES: readonly string[] = [
  "image",
  "gif",
  "video",
  "audio",
  "file",
];

/**
 * A CDN render snapshot → the chat descriptor shape.
 *
 * Same vocabulary on both sides since 0.9.0 — the field names are stapel-cdn's
 * by construction — so this is a rename of two fields and a copy of the rest.
 * It exists so a chip can show a real thumbnail and the optimistic bubble can
 * paint from what the upload response ALREADY carried, instead of waiting for
 * the round trip that will bring the same numbers back.
 */
export function renderMetaToAttachment(
  meta: CdnRenderMeta | undefined | null,
  key: string,
  type: string
): Partial<Attachment> | null {
  if (meta == null) return null;
  return {
    key,
    type,
    mime: meta.mime,
    bytes: meta.bytes,
    ext: meta.ext,
    width: meta.width,
    height: meta.height,
    aspect: meta.aspect,
    square: meta.square,
    animated: meta.animated,
    duration_ms: meta.duration_ms,
    preview_b64: meta.preview_b64,
    preview_kind: meta.preview_kind,
    poster_url: meta.poster_url,
    meta_status: meta.meta_status,
    meta_reason: meta.meta_reason,
  } as Partial<Attachment>;
}

/**
 * An upload seam over the CDN runtime already mounted on this page.
 *
 * `runUpload` and not `useMediaUpload`: a composer uploads SEVERAL files at
 * once and the hook is a single slot with a single phase. The flow function is
 * the same code underneath — validate, hash, ask `file/exists/`, POST only on a
 * miss — so a photo the CDN already holds still costs zero bytes here.
 */
export function useCdnAttachmentUpload(): AttachmentUpload {
  const runtime = useCdnRuntime();
  return useCallback<AttachmentUpload>(
    async ({ file, type, signal, onPhase }) => {
      const target = TARGET_BY_TYPE[type];
      if (target === undefined) {
        // NAMED, and thrown before a byte moves. `type` is in the message so
        // a deployment that registered `sticker` in chat and forgot the CDN
        // half reads which type it was rather than "upload failed".
        throw new Error(`no stapel-cdn intake for attachment type "${type}"`);
      }
      const outcome = await runUpload(runtime.api, file, {
        target,
        limits: limitsForTarget(target, runtime.limits),
        signal,
        onPhase,
        ...(runtime.variants !== undefined ? { variants: runtime.variants } : {}),
      });
      return {
        key: outcome.ref,
        descriptor: renderMetaToAttachment(
          outcome.row.render_meta,
          outcome.ref,
          type
        ),
      };
    },
    [runtime]
  );
}

export interface AttachButtonProps {
  readonly draft: AttachmentDraftBag;
  /**
   * `"media"` offers pictures and clips, `"file"` offers documents. Two
   * controls and not one, because the `accept` string is built from the
   * INTAKE's own allowlist — the same list the refusal is built from — and
   * one picker offering the union would let a person choose a file the intake
   * it lands in will refuse.
   */
  readonly kind: "media" | "file";
  readonly disabled?: boolean;
}

/** The picker. One input, hidden, driven by a real button. */
export function AttachButton(props: AttachButtonProps): ReactElement {
  const t = useT();
  const runtime = useCdnRuntime();
  const input = useRef<HTMLInputElement | null>(null);
  const gate = useActionGate(props.draft.canAdd);

  const accept = useMemo(() => {
    if (props.kind === "file") return acceptAttribute(runtime.limits.file);
    // Pictures AND clips: two intakes, so two allowlists joined — the picker
    // offers exactly what one of the two targets will take.
    return [
      acceptAttribute(runtime.limits.image),
      acceptAttribute(runtime.limits.video),
    ].join(",");
  }, [props.kind, runtime.limits]);

  const onPick = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const picked = Array.from(event.target.files ?? []);
      if (picked.length > 0) props.draft.add(picked);
      // Cleared so picking the SAME file twice in a row still fires a change
      // — a person who removed a photo by mistake and re-picked it otherwise
      // gets nothing at all.
      event.target.value = "";
    },
    [props.draft]
  );

  const label = t(
    props.kind === "file" ? CHAT_I18N_KEYS.attachFile : CHAT_I18N_KEYS.attachPhoto
  );
  return (
    <>
      <Button
        disabled={gate.disabled || props.disabled === true}
        onClick={() => input.current?.click()}
        aria-label={label}
        data-testid={`chat-attach-${props.kind}`}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        onChange={onPick}
        style={{ display: "none" }}
        data-testid={`chat-attach-${props.kind}-input`}
      />
    </>
  );
}

/** What the host may tune on the microphone control. */
export interface VoiceComposeOptions {
  /**
   * Stop on its own after this many milliseconds. Default two minutes: long
   * enough for a message, well short of `MAX_AUDIO_SIZE`.
   */
  readonly maxMs?: number;
  /** `"toggle"` (default) or the phone's hold-to-record. See cdn-react. */
  readonly interaction?: VoiceInteraction;
}

/** Two minutes. */
const DEFAULT_VOICE_MAX_MS = 120_000;

export interface VoiceAttachButtonProps {
  readonly draft: AttachmentDraftBag;
  readonly options?: VoiceComposeOptions;
  readonly disabled?: boolean;
}

/**
 * The microphone, as an attach control.
 *
 * `@stapel/cdn-react`'s control records and hands back the clip; this wraps
 * the clip as a `File` named from ITS container (the extension the audio
 * intake reads) and adds it to the draft as `audio` — after which it is a
 * chip on the same list as a photo, going through the same `upload` seam.
 * The record-only arm of the control is used on purpose: the draft owns the
 * upload so that "wait", "remove" and "retry" mean the same thing for a
 * voice note as for a picture, and one message with three voice notes is
 * three chips rather than three uploaders.
 *
 * Switched off when the draft is full (`canAdd`), with the reason beside the
 * send control the way every other refusal is.
 */
export function VoiceAttachButton(props: VoiceAttachButtonProps): ReactElement {
  const gate = useActionGate(props.draft.canAdd);
  const { draft } = props;
  const onRecorded = useCallback(
    (clip: RecordedClip): void => {
      const file = new File([clip.blob], voiceFileName(clip), {
        ...(clip.mimeType !== "" ? { type: clip.mimeType } : {}),
      });
      draft.add([file], { type: "audio" });
    },
    [draft]
  );
  const maxMs = props.options?.maxMs ?? DEFAULT_VOICE_MAX_MS;
  return (
    <VoiceRecordButton
      onRecorded={onRecorded}
      maxMs={maxMs}
      {...(props.options?.interaction !== undefined
        ? { interaction: props.options.interaction }
        : {})}
      disabled={gate.disabled || props.disabled === true}
      testId="chat-attach-voice"
    />
  );
}

/** One pending attachment: what it is, which step it is on, and a way out. */
function Chip(props: {
  draft: AttachmentDraftBag;
  item: AttachmentDraftBag["items"][number];
}): ReactElement {
  const t = useT();
  const { item } = props;
  return (
    <Flex
      align="center"
      gap={spacing[2]}
      data-testid="chat-attach-chip"
      data-phase={item.phase}
    >
      {item.previewUrl === null ? (
        <Tag>{item.medium}</Tag>
      ) : (
        /* The local object URL: the picture is on screen the instant it is
           picked, long before any server has seen it. */
        <img
          src={item.previewUrl}
          alt=""
          width={spacing[6]}
          height={spacing[6]}
          style={{ objectFit: "cover", display: "block" }}
        />
      )}
      {/* A recording has no name a person chose — the timestamped one it was
          stored under is a filename, not a label — so the chip says what it
          IS. A picked file keeps the name its owner knows it by. */}
      <Typography.Text ellipsis style={{ maxWidth: "12rem" }} data-testid="chat-attach-name">
        {item.medium === "audio" ? t(CHAT_I18N_KEYS.attachVoice) : item.name}
      </Typography.Text>
      {/* THE STEP, NOT A PERCENTAGE. There is no honest byte-percentage behind
          `fetch` (the CDN pair's flow states the whole argument), so the chip
          names which step is running — the uploader's own word when it gave
          one, and the generic sentence when it did not. */}
      {item.phase === "uploading" ? (
        <Typography.Text type="secondary" data-testid="chat-attach-step">
          {item.step === null
            ? t(CHAT_I18N_KEYS.attachUploading)
            : t(item.step, {})}
        </Typography.Text>
      ) : null}
      {item.phase === "failed" ? (
        <>
          <Typography.Text type="danger" data-testid="chat-attach-failed">
            {t(CHAT_I18N_KEYS.attachFailed)}
          </Typography.Text>
          <Button
            size="small"
            onClick={() => {
              props.draft.retry(item.id);
            }}
            data-testid="chat-attach-retry"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CHAT_I18N_KEYS.attachRetry)}
          </Button>
        </>
      ) : null}
      <Button
        size="small"
        onClick={() => {
          props.draft.remove(item.id);
        }}
        aria-label={t(CHAT_I18N_KEYS.attachRemove)}
        data-testid="chat-attach-remove"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        ✕
      </Button>
    </Flex>
  );
}

/** The pending list. Nothing at all when nothing is attached. */
export function AttachmentChips(props: {
  readonly draft: AttachmentDraftBag;
}): ReactElement | null {
  if (props.draft.items.length === 0) return null;
  return (
    <Flex vertical gap={spacing[1]} data-testid="chat-attach-chips">
      {props.draft.items.map((item) => (
        <Chip key={item.id} draft={props.draft} item={item} />
      ))}
    </Flex>
  );
}
