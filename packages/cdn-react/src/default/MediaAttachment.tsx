/**
 * `<MediaAttachment/>` — what a `<type>/<hash>` looks like to somebody who did
 * not upload it.
 *
 * This is the surface §83.2 was built for and the one the fleet has been
 * missing: a chat bubble holding a reference from the other side of a
 * conversation, a listing detail holding one from a draft, a review holding an
 * attachment. Until stapel-cdn 0.17.0 there was no way to ask what a reference
 * WAS, so `chat-react` shipped with no attachment renderer at all — not because
 * nobody wrote one, but because a browser could not have drawn it.
 *
 * ── The four arms are the media kind, not a guess about the URL ────────────
 *
 * `kind` is on the snapshot. Nothing here sniffs an extension, and nothing here
 * puts a video into an `<img>`:
 *
 *   image / gif  the ladder, tier picked from THIS element (`<Image>`)
 *   video        the poster still, with the clip's length over it
 *   audio        the waveform, which for an audio row IS the render — there is
 *                no still to fall back to, ever
 *   file         no pixels at all: the extension, the size, and a way to open it
 *
 * ── No layout jump, which is the whole claim ───────────────────────────────
 *
 * `preview_kind` is known BEFORE `preview_b64` exists, so the box is reserved in
 * the right shape while the preview is still null — `<Image>` does that part
 * (`PREVIEW_KIND_ASPECT`: 16:9 for a poster, 4:1 for a waveform, and
 * deliberately nothing for a blur, because a still can be any shape and a wrong
 * box has to jump twice). The one movement this component cannot remove is the
 * describe round trip itself: before the snapshot arrives NOTHING is known, not
 * even the medium. So the loading arm reserves {@link RESERVED_ASPECT} and a
 * caller that knows better — a chat bubble whose thread is already sized — says
 * so with `aspect`.
 *
 * ── Missing is data ────────────────────────────────────────────────────────
 *
 * A deleted, never-stored or malformed reference comes back inside a 200, and
 * this renders "this attachment is no longer available" — a different sentence
 * from "we could not ask", which is the failed arm and carries a retry. One
 * dead attachment costs a thread nothing.
 *
 * ── The URL a document does not have ───────────────────────────────────────
 *
 * A describe snapshot carries no canonical URL: images and videos reach one
 * through the ladder's `original` rung and a video's `poster_url`, but a
 * document's `variants` is empty and there is no `url` field on the wire. So a
 * document is drawn WITHOUT a link unless the host supplies one through
 * {@link MediaAttachmentProps.href} — an absent link is stated as a fact about
 * the contract rather than faked by building a URL out of the reference, which
 * is the one thing this pair has always refused to do (`CdnRef` is opaque).
 * Recorded in REQUESTS-cdn-react.md as an upstream gap.
 */
import { useMemo } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Flex, Tag, Typography } from "antd";
import { Image } from "@stapel/image";
import type { StapelImage } from "@stapel/image";
import { useI18n, useT } from "@stapel/core";
import type { ThemeMode } from "@stapel/tokens-antd";
import { EmptyState, LoadBoundary, SkinTheme } from "@stapel/tokens-antd/skin";
import { cssVar, radii, spacing } from "@stapel/tokens";
import type { CdnRef, CdnRenderMeta } from "../api/types.js";
import { useDescribeRef } from "../headless/useDescribe.js";
import { formatBytes, formatDurationMs } from "../model/format.js";
import { renderMetaToStapelImage } from "../model/refs.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";

/**
 * The shape the slot is held at while describe is in flight.
 *
 * 4:3 rather than a square: the overwhelming majority of what is attached to
 * anything is a photograph from a phone camera, and reserving the shape that is
 * usually right makes the correction, when it comes, small.
 */
export const RESERVED_ASPECT: number = 4 / 3;

/** How wide an attachment draws itself before a host constrains it. */
export const ATTACHMENT_MAX_WIDTH_PX = 360;

const BYTE_UNIT_KEY = {
  b: CDN_I18N_KEYS.bytesB,
  kb: CDN_I18N_KEYS.bytesKb,
  mb: CDN_I18N_KEYS.bytesMb,
  gb: CDN_I18N_KEYS.bytesGb,
} as const;

export interface MediaAttachmentProps {
  /**
   * The reference to draw. Named `mediaRef` and not `ref`, which React owns.
   */
  readonly mediaRef: CdnRef;
  /**
   * A snapshot the caller already holds — the `render_meta` inlined on an
   * upload response, or one plucked out of a `useDescribe` bag it already keeps
   * for a whole list. Given, NO request is made: the batching loader exists so
   * a page asks once, and a component that re-asked for something its parent
   * already had would defeat it.
   */
  readonly meta?: CdnRenderMeta | null;
  /**
   * Where "open" points for a medium whose snapshot carries no URL — a
   * document, always; anything else whose ladder is empty. Absent, no open
   * control is drawn, because this pair does not invent URLs out of references.
   */
  readonly href?: string;
  /** Width the attachment draws at. Default {@link ATTACHMENT_MAX_WIDTH_PX}. */
  readonly maxWidth?: number | string;
  /** The shape reserved while describe is in flight. Default 4:3. */
  readonly aspect?: number;
  /** Absent means "whatever the host document declares", never a hardcoded side. */
  readonly mode?: ThemeMode;
  readonly testId?: string;
}

/** The sunken box every arm draws inside, so all four are the same object. */
function frameStyle(maxWidth: number | string): CSSProperties {
  return {
    width: "100%",
    maxWidth,
    borderRadius: radii.md,
    overflow: "hidden",
    background: cssVar("surface-sunken"),
  };
}

/** The length of a clip, or the fact that nobody measured it. */
function Duration(props: { durationMs: number | null | undefined }): ReactElement {
  const t = useT();
  const clock = formatDurationMs(props.durationMs);
  return (
    <Typography.Text type="secondary" data-testid="cdn-attachment-duration">
      {clock ?? t(CDN_I18N_KEYS.attachmentDurationUnmeasured)}
    </Typography.Text>
  );
}

/** The size, with its unit as COPY: the abbreviation differs by language. */
function Size(props: { bytes: number | null | undefined }): ReactElement | null {
  const t = useT();
  const i18n = useI18n();
  const size = formatBytes(props.bytes, i18n.locale);
  if (size === null) return null;
  return (
    <Typography.Text type="secondary" data-testid="cdn-attachment-size">
      {t(BYTE_UNIT_KEY[size.unit], { value: size.value })}
    </Typography.Text>
  );
}

/**
 * How complete the snapshot is, when it is not complete.
 *
 * `meta_reason` is a technical token from a named vocabulary
 * (`decoder_missing`, `ffprobe_missing`, `preview_over_budget`, …) and it is
 * rendered the way core renders an error's technical half: muted, beside the
 * sentence, where an eye skips it and a support agent finds it. Translating ten
 * pipeline reasons into three languages would be inventing product copy for an
 * operator's fact.
 */
function MetaStatusNote(props: { meta: CdnRenderMeta }): ReactElement | null {
  const t = useT();
  const { meta } = props;
  if (meta.meta_status === "ok") return null;
  return (
    <Flex gap={spacing[2]} wrap data-testid="cdn-attachment-meta-status">
      <Typography.Text type="secondary">
        {meta.meta_status === "partial"
          ? t(CDN_I18N_KEYS.attachmentMetaPartial)
          : t(CDN_I18N_KEYS.attachmentMetaMissing)}
      </Typography.Text>
      {meta.meta_reason == null ? null : (
        <Typography.Text type="secondary" code data-testid="cdn-attachment-meta-reason">
          {meta.meta_reason}
        </Typography.Text>
      )}
    </Flex>
  );
}

/** The one link, when there is one to give. */
function OpenControl(props: {
  href: string | undefined;
  label: string;
  testId: string;
}): ReactElement | null {
  if (props.href === undefined || props.href === "") return null;
  return (
    <Button
      href={props.href}
      target="_blank"
      rel="noreferrer"
      size="small"
      data-testid={props.testId}
      data-analytics="none"
      data-analytics-reason="business action — host app wraps with its own tracked()"
    >
      {props.label}
    </Button>
  );
}

/** The URL a snapshot can honestly offer, or the host's. */
function hrefOf(image: StapelImage, host: string | undefined): string | undefined {
  if (host !== undefined && host !== "") return host;
  return image.url === "" ? undefined : image.url;
}

/** The pixels arm: image, gif, video poster, audio waveform — all `<Image>`. */
function Pixels(props: {
  image: StapelImage;
  alt: string;
  maxWidth: number | string;
}): ReactElement {
  return (
    <div style={frameStyle(props.maxWidth)}>
      <Image
        meta={props.image}
        alt={props.alt}
        fit="contain"
        style={{
          width: "100%",
          // The snapshot's own aspect when it has one; the shape `preview_kind`
          // implies otherwise (`<Image>` supplies that itself for a poster or a
          // waveform whose geometry was never measured).
          ...(props.image.aspect === null
            ? {}
            : { aspectRatio: String(props.image.aspect) }),
          display: "block",
        }}
      />
    </div>
  );
}

/** The document arm: no pixels exist for a PDF and none are invented. */
function Document(props: {
  meta: CdnRenderMeta;
  href: string | undefined;
  maxWidth: number | string;
}): ReactElement {
  const t = useT();
  const { meta } = props;
  const ext = meta.ext.replace(".", "").toUpperCase();
  return (
    <Flex
      vertical
      gap={spacing[2]}
      style={{ ...frameStyle(props.maxWidth), padding: spacing[4] }}
      data-testid="cdn-attachment-document"
    >
      <Flex align="center" gap={spacing[2]} wrap>
        <Tag data-testid="cdn-attachment-ext">{ext}</Tag>
        <Typography.Text>{t(CDN_I18N_KEYS.attachmentFileLabel, { ext })}</Typography.Text>
      </Flex>
      <Size bytes={meta.bytes} />
      <OpenControl
        href={props.href}
        label={t(CDN_I18N_KEYS.attachmentDownload)}
        testId="cdn-attachment-download"
      />
    </Flex>
  );
}

const ALT_KEY_BY_KIND: Readonly<Record<string, string>> = {
  video: CDN_I18N_KEYS.attachmentVideoAlt,
  audio: CDN_I18N_KEYS.attachmentAudioAlt,
};

/** Everything below the frame: length, size, snapshot completeness, open. */
function Facts(props: {
  meta: CdnRenderMeta;
  href: string | undefined;
  timeBased: boolean;
}): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={spacing[1]}>
      <Flex gap={spacing[3]} wrap align="center">
        {props.timeBased ? <Duration durationMs={props.meta.duration_ms} /> : null}
        <Size bytes={props.meta.bytes} />
        <OpenControl
          href={props.href}
          label={t(CDN_I18N_KEYS.attachmentOpen)}
          testId="cdn-attachment-open"
        />
      </Flex>
      <MetaStatusNote meta={props.meta} />
    </Flex>
  );
}

/** One resolved snapshot, drawn. Exported for a caller that already has one. */
function Resolved(props: {
  meta: CdnRenderMeta;
  href: string | undefined;
  maxWidth: number | string;
}): ReactElement {
  const t = useT();
  const { meta } = props;
  const image = useMemo(() => renderMetaToStapelImage(meta), [meta]);
  const kind = meta.kind ?? "image";
  const timeBased = kind === "video" || kind === "audio";

  if (kind === "file") {
    return <Document meta={meta} href={props.href} maxWidth={props.maxWidth} />;
  }
  return (
    <Flex vertical gap={spacing[2]} data-testid={`cdn-attachment-${kind}`}>
      <Pixels
        image={image}
        alt={t(ALT_KEY_BY_KIND[kind] ?? CDN_I18N_KEYS.attachmentImageAlt)}
        maxWidth={props.maxWidth}
      />
      <Facts meta={meta} href={hrefOf(image, props.href)} timeBased={timeBased} />
    </Flex>
  );
}

/** The reserved slot: the shape is held before anything about it is known. */
function Reserving(props: {
  maxWidth: number | string;
  aspect: number;
  children?: ReactNode;
}): ReactElement {
  return (
    <div
      style={{
        ...frameStyle(props.maxWidth),
        aspectRatio: String(props.aspect),
      }}
      data-testid="cdn-attachment-reserved"
    >
      {props.children}
    </div>
  );
}

export function MediaAttachment(props: MediaAttachmentProps): ReactElement {
  const maxWidth = props.maxWidth ?? ATTACHMENT_MAX_WIDTH_PX;
  const aspect = props.aspect ?? RESERVED_ASPECT;
  // A snapshot handed in is authoritative and costs nothing; only a bare
  // reference is asked about. `useDescribeRef(null)` mounts no query at all, so
  // this is one hook call either way and no rule of hooks to bend.
  const supplied = props.meta !== undefined;
  const described = useDescribeRef(supplied ? null : props.mediaRef);

  const body = ((): ReactElement => {
    if (supplied) {
      return props.meta === null ? (
        <Missing />
      ) : (
        <Resolved meta={props.meta} href={props.href} maxWidth={maxWidth} />
      );
    }
    return (
      <LoadBoundary
        state={described.state}
        onRetry={described.refetch}
        // Only the LOADING arm is overridden. The substrate's `failed` arm is
        // already `<ErrorAlert thrown onRetry/>` — writing it out again here
        // would be a second copy of a decision the shared skin owns.
        loading={<Reserving maxWidth={maxWidth} aspect={aspect} />}
        testId="cdn-attachment-load"
      >
        {(items) => {
          const meta = items.get(props.mediaRef);
          return meta === undefined ? (
            <Missing />
          ) : (
            <Resolved meta={meta} href={props.href} maxWidth={maxWidth} />
          );
        }}
      </LoadBoundary>
    );
  })();

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
      data-testid={props.testId ?? "cdn-attachment"}
    >
      {body}
    </SkinTheme>
  );
}

/** A reference the server resolved to nothing. Data, with a 200 behind it. */
function Missing(): ReactElement {
  const t = useT();
  return (
    <EmptyState
      compact
      title={t(CDN_I18N_KEYS.attachmentMissing)}
      testId="cdn-attachment-missing"
    />
  );
}
