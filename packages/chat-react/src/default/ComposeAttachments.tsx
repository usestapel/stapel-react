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
 * stapel-cdn has four upload endpoints and stapel-chat has five builtin
 * attachment types, and they do NOT map one to one:
 *
 *   image, gif  → `POST /upload/image/`   (both are image rows; `gif` is its
 *                                          own chat type so a client can offer
 *                                          a play affordance without sniffing)
 *   video       → `POST /upload/video/`
 *   file, other → `POST /upload/file/`    (an unregistered type this build has
 *                                          never heard of is bytes with a name)
 *   audio       → NOTHING. See below.
 *
 * ── THE AUDIO HOLE, STATED RATHER THAN WORKED AROUND ──────────────────────
 *
 * stapel-cdn has the whole write side for audio — an `Audio` model, storage, a
 * `post_save` that queues the waveform, `AudioProcessingService` (ffprobe for
 * the duration, one `showwavespic` for the strip), `audio/<hash>` refs, the
 * describe branch that resolves them, and `ALLOWED_AUDIO_EXTENSIONS` /
 * `MAX_AUDIO_SIZE` sitting in its settings — and **no HTTP intake**:
 * `urls_v1.py` mounts image, avatar, video, file and typed-image, and there is
 * no `AudioUploadView` anywhere in the package. So nothing in this fleet can
 * turn a recorded `Blob` into the `audio/<hash>` key stapel-chat's `audio`
 * attachment type requires.
 *
 * What this file does about that is say so and stop. It does NOT route a voice
 * note through `POST /upload/file/`: `.webm` and `.ogg` are not in
 * `ALLOWED_FILE_EXTENSIONS`, so that call is a 400 today — and a deployment
 * that widened the allowlist to make it pass would get a `file/<hash>` ref,
 * which has no waveform and no duration EVER. A voice message that can never
 * show its length is a silently degraded voice message, and a silently
 * degraded mode somebody can reach is the exact defect this wave exists to
 * close.
 *
 * So **this pair ships no voice control**, rather than one that refuses. The
 * recorder itself is real and released — `@stapel/cdn-react`'s
 * `useMediaRecorder` / `<VoiceRecordButton>` produce a webm/opus `Blob` today
 * — and the only missing link is the intake. When stapel-cdn mounts
 * `POST /upload/audio/`, this file gains ONE line in the map below
 * (`audio: { kind: "audio" }`) and the composer gains the button; nothing else
 * in either pair has to move. `useCdnAttachmentUpload` already refuses the
 * type by NAME so that a host wiring it early learns which seam is missing
 * rather than reading "upload failed".
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
} from "@stapel/cdn-react";
import type { CdnRenderMeta, CdnUploadTarget } from "@stapel/cdn-react";
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
  file: { kind: "file" },
};

/** Types this build can store. `audio` is absent, and the header says why. */
export const STORABLE_ATTACHMENT_TYPES: readonly string[] = [
  "image",
  "gif",
  "video",
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
        throw new Error(
          type === "audio"
            ? "stapel-cdn has no audio intake: a voice message cannot be stored yet"
            : `no stapel-cdn intake for attachment type "${type}"`
        );
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
      <Typography.Text ellipsis style={{ maxWidth: "12rem" }}>
        {item.name}
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
