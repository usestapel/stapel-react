/**
 * WHAT A BUBBLE'S ATTACHMENTS LOOK LIKE.
 *
 * Four arms, one per medium, and the arm is `type` — the registry name, which
 * IS the CDN's kind since 0.9.0 — never a sniff of the mime or the extension.
 *
 *   image / gif   the variant ladder, tier chosen from THIS element, with the
 *                 16px `preview_b64` as the blur placeholder underneath it
 *   video         the poster still, and a native player that loads on demand
 *   audio         the waveform image — which for a voice message IS the render,
 *                 there is no still to fall back to — plus play/pause and length
 *   file          no pixels exist for a PDF and none are invented: the
 *                 extension, the name, the size, and a link when there is one
 *
 * ── The no-layout-jump claim, and how it is kept ──────────────────────────
 *
 * Every arm reserves its box BEFORE anything loads. `preview_kind` is known
 * from `type` alone — so the shape is known while `preview_b64` is still null —
 * and the measured `aspect` replaces it the moment the CDN has probed the
 * asset. `<Image>` applies that rule for the two arms that go through it
 * (`PREVIEW_KIND_ASPECT`), and {@link reservedAspect} applies the same order to
 * the two that do not. A still with no geometry at all is deliberately
 * UNRESERVED: a photograph can be any shape, and a guessed box has to jump
 * twice — once to the wrong shape and once to the right one.
 *
 * ── No describe request, ever ─────────────────────────────────────────────
 *
 * stapel-chat resolves every key through `cdn.describe_many` inside the query
 * that fetched the messages, so the descriptors arrive WITH the thread. A
 * component that asked the CDN per bubble would undo the batch the backend was
 * built to provide, and would turn a page of thirty messages into thirty
 * requests. Nothing in this file talks to a network.
 *
 * ── A dead attachment costs the message nothing ───────────────────────────
 *
 * `meta_status` travels with every descriptor. `partial` and `missing` are
 * drawn as a muted note beside the medium, with the backend's own technical
 * `meta_reason` next to it the way core renders an error's technical half —
 * where an eye skips it and a support agent finds it. Ten attachments with one
 * broken ref still render ten.
 */
import { useCallback, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Flex, Tag, Typography } from "antd";
import { Image } from "@stapel/image";
import {
  actionAvailable,
  actionBlocked,
  STAPEL_UI_KEYS,
  useActionGate,
  useI18n,
  useT,
} from "@stapel/core";
import { SkinDialog } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing } from "@stapel/tokens";
import type { Attachment } from "../api/types.js";
import {
  attachmentExtension,
  attachmentMedium,
  attachmentToImage,
  attachmentUrl,
  isAnimated,
  readAttachments,
  reservedAspect,
} from "../model/attachments.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** How wide an attachment draws before the bubble constrains it. */
export const ATTACHMENT_MAX_WIDTH_PX = 320;

const ALT_KEY: Readonly<Record<string, string>> = {
  image: CHAT_I18N_KEYS.attachmentImageAlt,
  gif: CHAT_I18N_KEYS.attachmentGifAlt,
  video: CHAT_I18N_KEYS.attachmentVideoAlt,
  audio: CHAT_I18N_KEYS.attachmentAudioAlt,
};

function frameStyle(maxWidth: number | string): CSSProperties {
  return {
    width: "100%",
    maxWidth,
    // An element that declares its own width owns its own padding: measured
    // content-box, the document arm was wider than the column it sits in.
    boxSizing: "border-box",
    borderRadius: radii.md,
    overflow: "hidden",
    background: cssVar("surface-sunken"),
  };
}

/**
 * The length of a clip, or the fact that nobody measured it.
 *
 * `null` is NOT zero and the two are drawn differently on purpose: the backend
 * is explicit that "a zero-length voice message and an unmeasured one are
 * different facts", and a `0:00` printed under a clip that plays for nine
 * seconds is the client inventing the answer the server refused to invent.
 */
function clockOf(durationMs: number | null | undefined): string | null {
  if (typeof durationMs !== "number" || durationMs < 0) return null;
  const total = Math.round(durationMs / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${seconds < 10 ? "0" : ""}${String(seconds)}`;
}

/** Bytes, with the unit formatted for the locale the reader is in. */
function sizeOf(bytes: number | null | undefined, locale: string): string | null {
  if (typeof bytes !== "number" || bytes < 0) return null;
  const units = ["B", "kB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
  return `${formatted} ${units[unit] ?? "B"}`;
}

/** How complete the snapshot is, when it is not complete. */
function MetaNote(props: { attachment: Attachment }): ReactElement | null {
  const t = useT();
  const status = props.attachment.meta_status;
  if (status !== "partial" && status !== "missing") return null;
  return (
    <Flex gap={spacing[2]} wrap align="center" data-testid="chat-attachment-meta">
      <Typography.Text type="secondary">
        {t(
          status === "partial"
            ? CHAT_I18N_KEYS.attachmentMetaPartial
            : CHAT_I18N_KEYS.attachmentMetaMissing
        )}
      </Typography.Text>
      {props.attachment.meta_reason == null ? null : (
        <Typography.Text type="secondary" code data-testid="chat-attachment-reason">
          {props.attachment.meta_reason}
        </Typography.Text>
      )}
    </Flex>
  );
}

/** image / gif — the ladder, and the lightbox a tap opens. */
function Picture(props: {
  attachment: Attachment;
  maxWidth: number | string;
}): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const image = attachmentToImage(props.attachment);
  const alt = t(ALT_KEY[props.attachment.type] ?? CHAT_I18N_KEYS.attachmentImageAlt);
  const aspect = reservedAspect(props.attachment);

  return (
    <>
      {/* A BUTTON and not a div with onClick: opening the full picture is a
          real action, and a keyboard has to be able to take it. */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={t(CHAT_I18N_KEYS.attachmentOpen)}
        style={{
          ...frameStyle(props.maxWidth),
          padding: 0,
          border: "none",
          display: "block",
          cursor: "pointer",
        }}
        data-testid="chat-attachment-image"
        data-animated={String(isAnimated(props.attachment))}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        <Image
          meta={image}
          alt={alt}
          fit="cover"
          style={{
            width: "100%",
            display: "block",
            // The measured shape when there is one; `<Image>` supplies the
            // shape `preview_kind` implies when there is not, and NOTHING for
            // a still whose geometry has not arrived — see the header.
            ...(aspect === null ? {} : { aspectRatio: String(aspect) }),
          }}
        />
      </button>
      <SkinDialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        ariaLabel={alt}
        dismissLabel={t(STAPEL_UI_KEYS.dismiss)}
        width="min(90vw, 60rem)"
      >
        {/* `contain`, not `cover`: the whole point of opening it is to see all
            of it, and a lightbox that crops is a lightbox that hid the thing
            somebody tapped to look at. */}
        <Image
          meta={image}
          alt={alt}
          fit="contain"
          style={{ width: "100%", maxHeight: "80vh", display: "block" }}
        />
      </SkinDialog>
    </>
  );
}

/**
 * video — the poster, and a player that loads nothing until it is asked.
 *
 * `preload="none"` is the whole reason this is a native `<video>` with a poster
 * rather than a player that mounts loaded: a thread with six clips in it must
 * not pull six videos over somebody's phone connection to draw six still
 * frames. The poster is an image the CDN already made.
 */
function Clip(props: {
  attachment: Attachment;
  maxWidth: number | string;
}): ReactElement {
  const t = useT();
  const { attachment } = props;
  const poster = attachment.poster_url ?? undefined;
  const source = attachmentUrl(attachment);
  const aspect = reservedAspect(attachment) ?? 16 / 9;

  if (source === null) {
    // The ladder is empty and there is no URL on the wire: a poster with no
    // clip behind it is still worth drawing, and claiming a player over
    // nothing is not.
    return (
      <div
        style={{ ...frameStyle(props.maxWidth), aspectRatio: String(aspect) }}
        data-testid="chat-attachment-video"
      >
        {poster === undefined ? null : (
          <img
            src={poster}
            alt={t(CHAT_I18N_KEYS.attachmentVideoAlt)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
    );
  }
  return (
    <video
      controls
      preload="none"
      {...(poster === undefined ? {} : { poster })}
      src={source}
      aria-label={t(CHAT_I18N_KEYS.attachmentVideoAlt)}
      style={{ ...frameStyle(props.maxWidth), aspectRatio: String(aspect) }}
      data-testid="chat-attachment-video"
    />
  );
}

/**
 * audio — the waveform, and one control.
 *
 * The waveform is an IMAGE the CDN rendered (`showwavespic`, one ffmpeg pass in
 * the same run that measured the duration), so a client paints one `<img>`
 * rather than looping a canvas over a float array it would have to fetch and
 * decode. `preview_kind: "waveform"` is known from the type alone, which is why
 * the strip's box is reserved at 4:1 before any bytes exist.
 *
 * The element is a real `<audio>` with no `controls`: the browser's default
 * control bar is 300-odd pixels of chrome that would dwarf the strip, and the
 * only two things a voice message needs are play/pause and how long it is.
 */
function Voice(props: {
  attachment: Attachment;
  maxWidth: number | string;
}): ReactElement {
  const t = useT();
  const { attachment } = props;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const source = attachmentUrl(attachment);
  const clock = clockOf(attachment.duration_ms);
  const strip = attachment.preview_b64;
  /**
   * A voice message whose ladder came back empty has no URL to play, and the
   * reason is a FACT about this deployment's CDN — not "disabled for unknown
   * reasons". The waveform and the length still draw: everything that is known
   * about the clip is shown, and only the playing is refused.
   */
  const gate = useActionGate(
    source === null
      ? actionBlocked(CHAT_I18N_KEYS.attachmentNoLink)
      : actionAvailable()
  );

  const toggle = useCallback((): void => {
    const element = audio.current;
    if (element === null) return;
    if (element.paused) {
      void element.play().catch(() => {
        // Autoplay policy, a decode failure, a source that 404s — all end the
        // same way for this control: it is not playing. The reason belongs to
        // the element's own error handling, not to a thrown promise nobody
        // awaited.
        setPlaying(false);
      });
    } else {
      element.pause();
    }
  }, []);

  return (
    <Flex vertical gap={spacing[1]} data-testid="chat-attachment-audio">
      <Flex align="center" gap={spacing[3]} style={frameStyle(props.maxWidth)}>
        <Button
          shape="circle"
          disabled={gate.disabled}
          onClick={toggle}
          aria-label={t(
            playing ? CHAT_I18N_KEYS.attachmentPause : CHAT_I18N_KEYS.attachmentPlay
          )}
          data-testid="chat-attachment-audio-toggle"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {playing ? "❚❚" : "▶"}
        </Button>
        {/* The strip's box is reserved whether or not the bytes are here: the
            shape follows from `preview_kind`, which follows from `type`. */}
        <div style={{ flex: 1, aspectRatio: "4", minWidth: 0 }}>
          {strip == null ? null : (
            <img
              src={strip}
              alt={t(CHAT_I18N_KEYS.attachmentAudioAlt)}
              style={{ width: "100%", height: "100%", objectFit: "fill" }}
              data-testid="chat-attachment-waveform"
            />
          )}
        </div>
        <Typography.Text type="secondary" data-testid="chat-attachment-duration">
          {clock ?? t(CHAT_I18N_KEYS.attachmentDurationUnmeasured)}
        </Typography.Text>
      </Flex>
      {gate.reason === null ? null : (
        <Typography.Text type="secondary" data-testid="chat-attachment-no-link">
          {gate.reason}
        </Typography.Text>
      )}
      {source === null ? null : (
        <audio
          ref={audio}
          src={source}
          preload="none"
          onPlay={() => {
            setPlaying(true);
          }}
          onPause={() => {
            setPlaying(false);
          }}
          onEnded={() => {
            setPlaying(false);
          }}
        />
      )}
      <MetaNote attachment={attachment} />
    </Flex>
  );
}

/** file — facts and a way out, because no pixels for a PDF exist. */
function Document(props: {
  attachment: Attachment;
  maxWidth: number | string;
}): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const { attachment } = props;
  const ext = attachmentExtension(attachment);
  const size = sizeOf(attachment.bytes, locale);
  const href = attachmentUrl(attachment);
  return (
    <Flex
      vertical
      gap={spacing[2]}
      style={{ ...frameStyle(props.maxWidth), padding: spacing[3] }}
      data-testid="chat-attachment-file"
    >
      <Flex align="center" gap={spacing[2]} wrap>
        {ext === "" ? null : <Tag data-testid="chat-attachment-ext">{ext}</Tag>}
        <Typography.Text ellipsis data-testid="chat-attachment-name">
          {attachment.name ?? t(CHAT_I18N_KEYS.attachmentDocument)}
        </Typography.Text>
      </Flex>
      <Flex align="center" gap={spacing[3]} wrap>
        {size === null ? null : (
          <Typography.Text type="secondary" data-testid="chat-attachment-size">
            {size}
          </Typography.Text>
        )}
        {href === null ? (
          /* NOT a link built out of the key. A describe snapshot carries no
             canonical URL for a document, and inventing one out of an opaque
             reference is the single thing the CDN seam refuses to do — so the
             absence is stated instead. Recorded as an upstream gap. */
          <Typography.Text type="secondary" data-testid="chat-attachment-no-link">
            {t(CHAT_I18N_KEYS.attachmentNoLink)}
          </Typography.Text>
        ) : (
          <Button
            href={href}
            target="_blank"
            rel="noreferrer"
            size="small"
            data-testid="chat-attachment-download"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CHAT_I18N_KEYS.attachmentDownload)}
          </Button>
        )}
      </Flex>
      <MetaNote attachment={attachment} />
    </Flex>
  );
}

export interface MessageAttachmentsProps {
  /** The message whose descriptors to draw. */
  readonly message: Parameters<typeof readAttachments>[0];
  /** Width each attachment draws at. Default {@link ATTACHMENT_MAX_WIDTH_PX}. */
  readonly maxWidth?: number | string;
}

/**
 * Every attachment on one message, each by its own medium.
 *
 * Renders nothing at all for a message with none — including a TOMBSTONE,
 * whose `attachments` the server empties along with its body, so a deleted
 * message cannot leave its pictures behind.
 */
export function MessageAttachments(
  props: MessageAttachmentsProps
): ReactElement | null {
  const attachments = readAttachments(props.message);
  if (attachments.length === 0) return null;
  const maxWidth = props.maxWidth ?? ATTACHMENT_MAX_WIDTH_PX;
  return (
    <Flex vertical gap={spacing[2]} data-testid="chat-attachments">
      {attachments.map((attachment) => {
        // Keyed on the CDN reference: it is the identity of the thing being
        // drawn, and an index key would re-use a video's element for the
        // picture that took its place.
        switch (attachmentMedium(attachment)) {
          case "image":
            return (
              <Picture
                key={attachment.key}
                attachment={attachment}
                maxWidth={maxWidth}
              />
            );
          case "video":
            return (
              <Clip key={attachment.key} attachment={attachment} maxWidth={maxWidth} />
            );
          case "audio":
            return (
              <Voice key={attachment.key} attachment={attachment} maxWidth={maxWidth} />
            );
          case "file":
            return (
              <Document
                key={attachment.key}
                attachment={attachment}
                maxWidth={maxWidth}
              />
            );
        }
      })}
    </Flex>
  );
}
