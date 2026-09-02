/**
 * `<MediaLightboxPanel/>` — the in-place viewer for a viewable file: a photo
 * full-size (tap to zoom, swipe or step between the folder's other photos),
 * an audio file as an inline player, a video as a player that can SEEK.
 *
 * ── Where the bytes come from ─────────────────────────────────────────────
 *
 * The docs pair's headless `MediaViewer` — this panel draws its bag and adds
 * nothing to the transport. On an object-store deployment the bag resolves
 * the presigned download URL (MinIO/S3 honour a `Range` header on it, which
 * is what makes video seek work); on the DjangoStorage dev profile the mint
 * answers 503 and the bag falls back to the authorized `/content` stream,
 * which speaks single-range 206 itself since stapel-docs 0.8.0. Either way
 * the `<video>`/`<audio>`/`<img>` below just gets a `src` that behaves.
 *
 * ── Why swiping is buttons + a horizontal gesture, not a carousel ─────────
 *
 * `SkinCarousel` is a scroll-snap STRIP — every slide mounted, peeking, its
 * own height. A lightbox shows ONE image and replaces it: mounting a folder
 * of full-size photos to swipe between two of them is the whole listing
 * re-downloaded. So the panel keeps one media element and navigates the
 * sibling ARRAY — arrows on any pointer, left/right keys, and a plain
 * horizontal touch swipe.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("mediaLightbox", …)`.
 */
import { useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
import { SkinButton as Button } from "@stapel/tokens-antd/skin";
import {
  ErrorAlert,
  LoadBoundary,
  SkinDialog,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { spacing } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import { MediaViewer } from "@stapel/docs-react";
import type { DocDocument } from "@stapel/docs-react";
import { viewerKindFor } from "../model/viewers.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { LIGHTBOX_MEDIA_HEIGHT, LIGHTBOX_SWIPE_THRESHOLD } from "./measure.js";

export interface MediaLightboxPanelProps {
  /** The open document; `null` closes the lightbox. */
  readonly document: DocDocument | null;
  /**
   * The folder's other viewable IMAGES, in listing order — what swiping and
   * the arrows step through. The open document need not be in the array
   * (a recents/starred row opens alone); absent or shorter than two, the
   * lightbox is a single-file viewer and shows no arrows.
   */
  readonly siblings?: readonly DocDocument[];
  onClose(): void;
  /** Stepping/swiping landed on a sibling — the caller owns which document
   * is open (the same inversion as the row actions). */
  onNavigate?(document: DocDocument): void;
  /** Pin a theme side. Omitted, the document's live mode wins — this is a
   * dialog, which portals out of the tree. */
  readonly mode?: ThemeMode;
}

export function MediaLightboxPanel(props: MediaLightboxPanelProps): ReactElement {
  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <MediaLightboxBody {...props} />
    </SkinTheme>
  );
}

function MediaLightboxBody(props: MediaLightboxPanelProps): ReactElement {
  const t = useT();
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const { document: doc } = props;

  const images = (props.siblings ?? []).filter(
    (sibling) => viewerKindFor(sibling) === "image"
  );
  const at = doc === null ? -1 : images.findIndex((image) => image.id === doc.id);
  const canStep = at !== -1 && images.length > 1;

  const step = (delta: number): void => {
    if (!canStep) return;
    const next = images[(at + delta + images.length) % images.length];
    if (next !== undefined) {
      setZoomed(false);
      props.onNavigate?.(next);
    }
  };

  const kind = doc === null ? null : viewerKindFor(doc);

  return (
    <SkinDialog
      open={doc !== null}
      onClose={() => {
        setZoomed(false);
        props.onClose();
      }}
      title={doc?.title ?? t(DRIVE_I18N_KEYS.viewerLabel)}
      dismissLabel={t(DRIVE_I18N_KEYS.viewerClose)}
      data-testid="drive-media-lightbox"
    >
      {doc !== null && kind !== null && (
        <MediaViewer key={doc.id} documentId={doc.id}>
          {(bag) => (
            <Flex
              vertical
              gap={spacing[2]}
              data-testid="drive-lightbox-body"
              data-analytics="none"
              data-analytics-reason="viewer navigation gestures within the surface — the host app wraps the open itself with its own tracked()"
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") step(-1);
                if (event.key === "ArrowRight") step(1);
              }}
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const start = touchStartX.current;
                touchStartX.current = null;
                const end = event.changedTouches[0]?.clientX;
                if (start === null || end === undefined || zoomed) return;
                const delta = end - start;
                if (Math.abs(delta) >= LIGHTBOX_SWIPE_THRESHOLD) {
                  step(delta < 0 ? 1 : -1);
                }
              }}
            >
              <LoadBoundary
                state={bag.urlState}
                onRetry={bag.refreshUrl}
                testId="drive-lightbox-url"
                loading={
                  <Typography.Text
                    type="secondary"
                    role="status"
                    aria-busy
                    data-stapel-load-state="loading"
                    data-testid="drive-lightbox-loading"
                  >
                    {t(DRIVE_I18N_KEYS.viewerPreparing)}
                  </Typography.Text>
                }
                failed={(error) => (
                  <ErrorAlert
                    thrown={error}
                    onRetry={bag.refreshUrl}
                    testId="drive-lightbox-error"
                  />
                )}
              >
                {(url) => renderMedia(kind, url, doc, zoomed, setZoomed)}
              </LoadBoundary>

              {kind === "image" && (
                <Flex justify="space-between" align="center">
                  {canStep ? (
                    <Button
                      type="text"
                      data-testid="drive-lightbox-prev"
                      data-analytics="none"
                      data-analytics-reason="viewer navigation within the surface — the host app wraps the open itself with its own tracked()"
                      onClick={() => {
                        step(-1);
                      }}
                    >
                      {t(DRIVE_I18N_KEYS.viewerPrev)}
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    type="text"
                    data-testid="drive-lightbox-zoom"
                    data-analytics="none"
                    data-analytics-reason="viewer state toggle — no business outcome to record"
                    onClick={() => {
                      setZoomed((current) => !current);
                    }}
                  >
                    {t(DRIVE_I18N_KEYS.viewerZoom)}
                  </Button>
                  {canStep ? (
                    <Button
                      type="text"
                      data-testid="drive-lightbox-next"
                      data-analytics="none"
                      data-analytics-reason="viewer navigation within the surface — the host app wraps the open itself with its own tracked()"
                      onClick={() => {
                        step(1);
                      }}
                    >
                      {t(DRIVE_I18N_KEYS.viewerNext)}
                    </Button>
                  ) : (
                    <span />
                  )}
                </Flex>
              )}
            </Flex>
          )}
        </MediaViewer>
      )}
    </SkinDialog>
  );
}

function renderMedia(
  kind: "image" | "audio" | "video" | "archive",
  url: string,
  doc: DocDocument,
  zoomed: boolean,
  setZoomed: (next: boolean) => void
): ReactNode {
  if (kind === "image") {
    return (
      <div
        style={{
          overflow: "auto",
          maxHeight: LIGHTBOX_MEDIA_HEIGHT,
          textAlign: "center",
        }}
      >
        {/* Tap to zoom is the phone gesture; the Zoom button beside is the
            same toggle with a name a screen reader can find. */}
        <img
          src={url}
          alt={doc.title}
          data-testid="drive-lightbox-image"
          data-drive-zoomed={zoomed ? "true" : "false"}
          data-analytics="none"
          data-analytics-reason="viewer state toggle (tap to zoom) — no business outcome to record"
          style={
            zoomed
              ? { width: "250%", maxWidth: "none", cursor: "zoom-out" }
              : { maxWidth: "100%", maxHeight: LIGHTBOX_MEDIA_HEIGHT, cursor: "zoom-in" }
          }
          onClick={() => {
            setZoomed(!zoomed);
          }}
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        data-testid="drive-lightbox-video"
        style={{ width: "100%", maxHeight: LIGHTBOX_MEDIA_HEIGHT }}
      />
    );
  }
  if (kind === "audio") {
    return (
      <audio
        src={url}
        controls
        preload="metadata"
        data-testid="drive-lightbox-audio"
        style={{ width: "100%" }}
      />
    );
  }
  // "archive" never reaches this panel (DriveScreen routes it to the
  // archive sheet); typed here so the union stays total.
  return null;
}
