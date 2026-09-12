/**
 * `<MediaGalleryField/>` — the listing composer's photo grid, skinned.
 *
 * Ten tiles at most (the storefront's number, passed in — stapel-cdn has no
 * opinion on it), each showing its own step, its own refusal and its own
 * controls. Reordering is native HTML5 drag-and-drop plus a pair of move
 * buttons, and the buttons are not a fallback nobody uses: drag-and-drop is
 * unreachable by keyboard and unusable on a touch screen, which between them
 * are most of the people listing something from a phone.
 *
 * The first tile is labelled as the cover, because the order IS the meaning:
 * `Listing.images_draft` is stored in this order and the first reference is
 * what a search result card shows.
 *
 * ── A tile carries badges; the grid carries sentences ──────────────────────
 *
 * A tile is 96px wide. Three `Typography.Text` blocks stacked inside one
 * printed as a single run-on column on a phone — "ReadyCover photoAlready
 * uploaded — nothing was sent again", with no separator anywhere, wrapped
 * into a 96px column — because a status, a role and an outcome are three
 * different KINDS of thing and only the first two are badges. So: the
 * phase is a small {@link StatusTag} in one
 * corner of the picture, the cover badge is the primary one in the opposite
 * corner, and every outcome that is a sentence (the dedupe note, the
 * variants ladder) moved OUT of the tile into the grid's notice line, next
 * to the slot `settled` already owns. The tile holds no free text at all
 * now — only the two badges, the per-item error alert, and its controls.
 *
 * ── Whose queue is it ──────────────────────────────────────────────────────
 *
 * Either the caller's (`bag`) or this field's (`max`). A composer consumes
 * `bag.refs` as `images_draft` and `bag.settled` as its publish gate, so when
 * a composer is on the page the bag it holds and the bag drawn here must be
 * ONE object — see {@link MediaGalleryFieldBagProps}.
 *
 * ── Three things the wave-D pass fixed, all of them counting or size ───────
 *
 * The count is a PLURAL FAMILY now (`tPlural`, agreeing with the capacity), so
 * a one-photo gallery no longer says "1 of 1 photos" in three languages. The
 * tile's five controls lost `size="small"`: on a phone `SkinTheme` makes a
 * control 44px, and `small` opted every one of them out of the rule on the
 * surface it exists for. And the empty gallery is an `EmptyState` inside the
 * drop target rather than two lines of grey text.
 */
import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { useActionGate, useT, useTPlural } from "@stapel/core";
import { EmptyState, ErrorAlert, SkinTheme, StatusTag } from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { spacing } from "@stapel/tokens";
import { MediaUploader } from "../headless/MediaUploader.js";
import { imageRowOf } from "../headless/useUploadQueue.js";
import type { UploadItem, UploadQueueBag } from "../headless/useUploadQueue.js";
import { useUploadPreview } from "../headless/useUploadPreview.js";
import type { CdnRef } from "../api/types.js";
import type { CdnUploadTarget } from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import { DropZone } from "./DropZone.js";
import { PHASE_FAMILY, PHASE_KEYS, PREVIEW_BOX, PREVIEW_TILE_PX } from "./phase.js";
import { CdnThumbnail } from "./CdnThumbnail.js";

/**
 * The gallery over a queue the CALLER owns.
 *
 * This is the shape a composer needs and the one the field did not have. A
 * listing composer takes `bag.refs` as `images_draft` and `bag.settled` as its
 * publish gate, so the bag it was handed and the bag the gallery draws MUST be
 * the same object. When the field built its own, the container had two queues:
 * the composer's (empty, because nothing was ever added to it) and the one on
 * screen — so the publish gate said "wait for the photos" about photos it
 * could not see, and `images_draft` went out empty.
 */
export interface MediaGalleryFieldBagProps {
  /** The queue to draw. Hand it the same bag the composer got. */
  bag: UploadQueueBag;
  max?: undefined;
  target?: undefined;
  initialRefs?: undefined;
  onRefsChange?: undefined;
  /** Absent means "whatever the host document declares", never a hardcoded side. */
  mode?: ThemeMode;
}

/** The gallery that owns its own queue — a field standing alone. */
export interface MediaGalleryFieldOwnProps {
  bag?: undefined;
  /** How many photos this gallery holds. The storefront's composer: 10. */
  max: number;
  target?: CdnUploadTarget;
  /** References the gallery starts with — a reopened draft. */
  initialRefs?: readonly CdnRef[];
  /** The list to store, in display order, on every change. */
  onRefsChange?: (refs: readonly CdnRef[]) => void;
  mode?: ThemeMode;
}

/**
 * Either the caller owns the queue (`bag`) or this field does (`max` and the
 * options that configure one). Spelled as a union rather than as optional
 * props so that passing both — two queues, one screen, the defect above — is a
 * type error rather than a decision this component has to make at runtime.
 */
export type MediaGalleryFieldProps =
  | MediaGalleryFieldBagProps
  | MediaGalleryFieldOwnProps;

/**
 * The two badges sit in OPPOSITE corners of the picture so neither can be
 * read as a continuation of the other: the cover badge is the primary one
 * (top-start, where the eye lands), the phase badge is the small one
 * (bottom-end). Stamped `data-corner` so a test can assert the placement
 * without measuring pixels in jsdom, which measures nothing.
 */
export const COVER_CORNER = "top-start";
export const PHASE_CORNER = "bottom-end";

const BADGE_INSET_PX = 2;

const BADGE_CORNER: Readonly<Record<"coverCorner" | "phaseCorner", CSSProperties>> = {
  coverCorner: {
    position: "absolute",
    insetBlockStart: BADGE_INSET_PX,
    insetInlineStart: BADGE_INSET_PX,
    maxWidth: `calc(100% - ${BADGE_INSET_PX * 2}px)`,
  },
  phaseCorner: {
    position: "absolute",
    insetBlockEnd: BADGE_INSET_PX,
    insetInlineEnd: BADGE_INSET_PX,
    maxWidth: `calc(100% - ${BADGE_INSET_PX * 2}px)`,
  },
};

function Tile(props: {
  item: UploadItem;
  index: number;
  bag: UploadQueueBag;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
}): ReactElement {
  const t = useT();
  const preview = useUploadPreview(props.item);
  const { item, bag, index } = props;
  const busy =
    item.phase === "hashing" ||
    item.phase === "checking" ||
    item.phase === "uploading" ||
    item.phase === "processing";

  return (
    <div
      draggable
      onDragStart={() => props.onDragStart(index)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => props.onDrop(index)}
      data-testid="cdn-gallery-tile"
      data-phase={item.phase}
      style={{ width: PREVIEW_TILE_PX }}
    >
      {/* The picture and the two badges share ONE positioned box: a badge
          belongs to the photograph, not to the column under it. Anything
          that is a SENTENCE — the dedupe outcome, the variants ladder —
          is the grid's notice line, not a paragraph squeezed into 96px. */}
      <div style={{ position: "relative", width: PREVIEW_TILE_PX, height: PREVIEW_TILE_PX }}>
        {/* The tier comes from THIS tile's box at the live device pixel ratio,
            not from `smallestVariantUrl` — see `./CdnThumbnail.tsx`. A restored
            item (`file === null`) still resolving its row draws a skeleton;
            one that resolved to nothing draws the broken-image fallback —
            `useUploadQueue`'s `restoredLookup` is what tells the two apart
            from a plain in-flight tile, which has a `file` and never sets it. */}
        <CdnThumbnail
          localUrl={preview.localUrl}
          image={imageRowOf(item)}
          box={PREVIEW_BOX}
          alt={t(CDN_I18N_KEYS.itemAlt)}
          resolving={item.file === null && item.restoredLookup === "pending"}
          broken={item.file === null && item.restoredLookup === "done" && item.row === null}
          data-testid="cdn-tile-thumbnail"
        />
        {index === 0 ? (
          <span style={BADGE_CORNER.coverCorner} data-corner={COVER_CORNER}>
            <StatusTag status="info" bordered={false} testId="cdn-tile-cover">
              {t(CDN_I18N_KEYS.itemCover)}
            </StatusTag>
          </span>
        ) : null}
        <span
          style={BADGE_CORNER.phaseCorner}
          data-corner={PHASE_CORNER}
          aria-live="polite"
        >
          <StatusTag
            status={PHASE_FAMILY[item.phase]}
            bordered={false}
            testId="cdn-tile-phase"
          >
            {t(PHASE_KEYS[item.phase])}
          </StatusTag>
        </span>
      </div>
      <ErrorAlert
        {...(item.error === null ? {} : { thrown: item.error })}
        testId="cdn-tile-error"
      />
      <Flex gap={spacing[2]} wrap>
        {busy ? (
          <Button
            onClick={() => bag.cancel(item.id)}
            data-testid="cdn-tile-cancel"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CDN_I18N_KEYS.itemCancel)}
          </Button>
        ) : null}
        {item.phase === "failed" || item.phase === "canceled" ? (
          <Button
            onClick={() => bag.retry(item.id)}
            data-testid="cdn-tile-retry"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CDN_I18N_KEYS.itemRetry)}
          </Button>
        ) : null}
        <Button
          onClick={() => bag.remove(item.id)}
          data-testid="cdn-tile-remove"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(CDN_I18N_KEYS.itemRemove)}
        </Button>
        <Button
          disabled={index === 0}
          data-disabled-reason="this is the first tile — the cover label beside it says so, and there is nothing earlier to move it before"
          onClick={() => bag.reorder(index, index - 1)}
          data-testid="cdn-tile-earlier"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(CDN_I18N_KEYS.itemMoveEarlier)}
        </Button>
        <Button
          disabled={index === bag.items.length - 1}
          data-disabled-reason="this is the last tile — its position in the visible row is the reason, and there is nothing later to move it after"
          onClick={() => bag.reorder(index, index + 1)}
          data-testid="cdn-tile-later"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(CDN_I18N_KEYS.itemMoveLater)}
        </Button>
      </Flex>
    </div>
  );
}

function GalleryBody(props: { bag: UploadQueueBag }): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { bag } = props;
  const settledGate = useActionGate(bag.settled);
  const [dragging, setDragging] = useState<number | null>(null);

  // One line for the whole grid, whatever the count: the note is about the
  // queue's outcome, not about a tile's corner. Order is fixed so the line
  // does not reshuffle as items settle.
  const notices: string[] = [];
  if (bag.items.some((item) => item.deduped)) {
    notices.push(CDN_I18N_KEYS.deduped);
  }
  // The row's own word for its ladder, not an inference off `is_processed`:
  // while it reads `pending` the variant URLs in the payload are a prediction
  // and the tiles are showing the originals.
  if (bag.items.some((item) => item.variantsStatus === "pending")) {
    notices.push(CDN_I18N_KEYS.variantsPending);
  }

  const onDrop = (index: number): void => {
    if (dragging === null) return;
    bag.reorder(dragging, index);
    setDragging(null);
  };

  return (
    <Flex vertical gap={spacing[3]} data-testid="cdn-gallery">
      {/* A COUNTED sentence: `tPlural` asks Intl.PluralRules for the locale's
          category. The noun agrees with the CAPACITY, which is what makes
          "1 of 1 photo" right and "1 of 1 photos" the bug the review found. */}
      <Typography.Text data-testid="cdn-gallery-count">
        {tPlural(CDN_I18N_KEYS.galleryCount, {
          count: bag.capacity.max,
          used: bag.capacity.used,
          max: bag.capacity.max,
        })}
      </Typography.Text>
      <DropZone
        accept={bag.accept.attribute}
        multiple
        buttonLabel={t(CDN_I18N_KEYS.pickImages)}
        gate={bag.canAdd}
        onFiles={(files) => bag.add(files)}
        testId="cdn-gallery-drop"
      >
        {bag.items.length === 0 ? (
          <EmptyState
            compact
            title={t(CDN_I18N_KEYS.galleryEmpty)}
            hint={t(CDN_I18N_KEYS.galleryEmptyHint)}
            testId="cdn-gallery-empty"
          />
        ) : (
          <Flex wrap align="flex-start" gap={spacing[3]}>
            {bag.items.map((item, index) => (
              <Tile
                key={item.id}
                item={item}
                index={index}
                bag={bag}
                onDragStart={setDragging}
                onDrop={onDrop}
              />
            ))}
          </Flex>
        )}
      </DropZone>
      {/* The grid's NOTICE slot, beside the one `settled` already owns. An
          outcome is a sentence about the queue, and a sentence does not fit
          in a 96px tile: shipped inside one, the phase word + the cover
          label + the dedupe note wrapped into a single run-on column
          nobody could read. One line, under the grid, announced — and the
          tile keeps only its two badges. */}
      {notices.length === 0 ? null : (
        <Typography.Text
          type="secondary"
          aria-live="polite"
          data-testid="cdn-gallery-notice"
        >
          {notices.map((key) => t(key)).join(" · ")}
        </Typography.Text>
      )}
      {settledGate.reason === undefined ? null : (
        <Typography.Text type="secondary" data-testid="cdn-gallery-unsettled">
          {settledGate.reason}
        </Typography.Text>
      )}
    </Flex>
  );
}

export function MediaGalleryField(props: MediaGalleryFieldProps): ReactElement {
  // A queue handed in is drawn directly: no `MediaUploader`, because mounting
  // one would create the SECOND queue this prop exists to prevent.
  const body =
    props.bag !== undefined ? (
      <GalleryBody bag={props.bag} />
    ) : (
      <MediaUploader
        max={props.max}
        {...(props.target !== undefined ? { target: props.target } : {})}
        {...(props.initialRefs !== undefined ? { initialRefs: props.initialRefs } : {})}
        {...(props.onRefsChange !== undefined
          ? { onRefsChange: props.onRefsChange }
          : {})}
      >
        {(bag) => <GalleryBody bag={bag} />}
      </MediaUploader>
    );
  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      {body}
    </SkinTheme>
  );
}
