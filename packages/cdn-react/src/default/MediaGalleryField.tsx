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
 * ── IT IS A GRID, AND THE TILE IS THE CELL ────────────────────────────────
 *
 * What shipped before this was a 96px thumbnail floating in a full-width
 * dashed rectangle with three stacked word buttons under it — a gallery that
 * read as an empty region containing one photograph. The shape is now the one
 * the ruling states and the one every photo grid a seller has ever used has:
 *
 *  - SQUARE CELLS filling their columns (`object-fit: cover`), with
 *    {@link PREVIEW_TILE_PX} as the floor rather than the size;
 *  - the column count from the CONTAINER's width through the fleet's one
 *    element-width primitive — three, four or six, see
 *    {@link galleryColumns} — because this gallery is mounted in a page
 *    column and in a dialog on the same desktop;
 *  - the picker as ONE MORE CELL of the same size ({@link AddTile}), which
 *    is the only thing carrying a dashed border; the drop target is the whole
 *    grid, which outlines on a drag;
 *  - every badge and control OVERLAID on the picture, one per corner (see
 *    {@link CORNER}), icon-only, always visible — a phone has no hover, so a
 *    control that appears on one does not exist there.
 *
 * ── A tile carries badges; the grid carries sentences ──────────────────────
 *
 * A tile is at least 96px wide and nothing else fits in it. Three
 * `Typography.Text` blocks stacked inside one printed as a single run-on
 * column on a phone — "ReadyCover photoAlready uploaded — nothing was sent
 * again", with no separator anywhere — because a status, a role and an
 * outcome are three different KINDS of thing and only the first two are
 * badges. So the phase is a small {@link StatusTag} in one corner and the
 * cover mark is the primary badge in the opposite one, while every outcome
 * that is a SENTENCE — the dedupe note, the variants ladder, an item's own
 * refusal — lives under the grid, beside the slot `settled` already owns.
 * The tile holds no free text at all.
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
 * tile's controls lost `size="small"`: on a phone `SkinTheme` makes a
 * control 44px, and `small` opted every one of them out of the rule on the
 * surface it exists for — which is why the icon buttons overlaid on the tile
 * did not take it back. And the empty gallery is an `EmptyState`, now beside
 * the grid rather than instead of it: the add tile is the control that
 * sentence is about, so replacing the grid would take it away.
 */
import { useId, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { useActionGate, useT, useTPlural } from "@stapel/core";
import {
  EmptyState,
  ErrorAlert,
  GatedButton,
  SkinTheme,
  StatusTag,
  useElementWidth,
  visuallyHidden,
} from "@stapel/tokens-antd/skin";
import type { ThemeMode } from "@stapel/tokens-antd";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { MediaUploader } from "../headless/MediaUploader.js";
import { imageRowOf } from "../headless/useUploadQueue.js";
import type { UploadItem, UploadQueueBag } from "../headless/useUploadQueue.js";
import { useUploadPreview } from "../headless/useUploadPreview.js";
import type { CdnRef } from "../api/types.js";
import type { CdnUploadTarget } from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import {
  PHASE_FAMILY,
  PHASE_KEYS,
  PREVIEW_CELL_BOX,
  PREVIEW_TILE_PX,
  PREVIEW_TILE_RADIUS_PX,
} from "./phase.js";
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
 * WHERE EACH THING SITS ON THE PICTURE.
 *
 * Four corners, one job each, stamped `data-corner` so a test can assert the
 * placement without measuring pixels — jsdom lays nothing out, so the
 * assertion that means anything is "this is absolutely positioned, at this
 * inset, inside the picture's own box".
 *
 *   top-start     the cover badge — the primary mark, where the eye lands
 *   top-end       remove, the one destructive control, furthest from it
 *   bottom-start  the two move arrows, reading left-to-right as order does
 *   bottom-end    what the upload is DOING: retry/cancel, then the phase tag
 */
export const COVER_CORNER = "top-start";
export const REMOVE_CORNER = "top-end";
export const MOVE_CORNER = "bottom-start";
export const PHASE_CORNER = "bottom-end";

/** The overlay's breathing room off the picture's edge — one step of the
 * fleet's scale, not a number picked for a screenshot. */
const OVERLAY_INSET = spacing[1];

function corner(
  block: "start" | "end",
  inline: "start" | "end"
): CSSProperties {
  return {
    position: "absolute",
    ...(block === "start"
      ? { insetBlockStart: OVERLAY_INSET }
      : { insetBlockEnd: OVERLAY_INSET }),
    ...(inline === "start"
      ? { insetInlineStart: OVERLAY_INSET }
      : { insetInlineEnd: OVERLAY_INSET }),
    display: "flex",
    alignItems: "center",
    gap: OVERLAY_INSET,
    maxInlineSize: `calc(100% - ${String(OVERLAY_INSET * 2)}px)`,
  };
}

const CORNER: Readonly<Record<string, CSSProperties>> = {
  [COVER_CORNER]: corner("start", "start"),
  [REMOVE_CORNER]: corner("start", "end"),
  [MOVE_CORNER]: corner("end", "start"),
  [PHASE_CORNER]: corner("end", "end"),
};

/**
 * HOW MANY COLUMNS, AND FROM WHICH WIDTH.
 *
 * The CONTAINER's, through `useElementWidth` — the fleet's one element-width
 * measurement — and never the viewport's. This gallery is mounted inside a
 * composer step that is a 1080px page column on a desktop and a full-bleed
 * phone screen, and it is also mounted inside a 560px dialog on that same
 * desktop: a viewport media query would draw the six-column arm into the
 * dialog and the three-column arm nowhere.
 *
 * The steps are the ruling's: three across a phone, four across a tablet or a
 * narrow pane, six across a desktop column.
 */
export const GALLERY_COLUMN_STEPS = { four: 480, six: 768 } as const;

/**
 * The column count for a measured width.
 *
 * `undefined` — before the first observation, or with no `ResizeObserver` at
 * all — answers with the NARROW arm. `useElementWidth` refuses to guess for
 * its callers and this is this caller's answer: three columns is the arm that
 * fits everywhere, and a grid that starts wide and snaps narrow is a reflow
 * on the first frame of the composer's first screen.
 */
export function galleryColumns(width: number | undefined): number {
  if (width === undefined || width < GALLERY_COLUMN_STEPS.four) return 3;
  if (width < GALLERY_COLUMN_STEPS.six) return 4;
  return 6;
}

/** One step of the fleet's scale between cells. */
const GALLERY_GAP = spacing[2];

/**
 * The cell: square, filling its column, never narrower than the tile floor.
 * `aspect-ratio` rather than a height, so the row's height follows the
 * column width the grid actually resolved to.
 */
const CELL: CSSProperties = {
  position: "relative",
  inlineSize: "100%",
  aspectRatio: "1 / 1",
  minInlineSize: PREVIEW_TILE_PX,
};

/**
 * An icon control on the picture.
 *
 * ICON-ONLY and ALWAYS VISIBLE. Not hover-only: this grid's first surface is
 * a phone, where there is no hover at all, and a control that appears on
 * hover is a control that does not exist to a thumb. The label is the
 * `aria-label` — the same i18n key the worded button used — so nothing is
 * lost to a screen reader.
 *
 * No `size="small"`: on a phone `SkinTheme` makes a control 44px, and that is
 * the touch floor these four controls exist inside. A denser tile is not
 * worth a target a thumb misses.
 */
function TileIconButton(props: {
  readonly glyph: string;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  /** The outcome, declared at the CALL SITE — `stapel/clickable-needs-event`
   * asks the place that knows what the click means, not the widget. */
  readonly "data-analytics": string;
  readonly "data-analytics-reason": string;
}): ReactElement {
  return (
    <Button
      aria-label={props.label}
      onClick={props.onClick}
      data-testid={props.testId}
      data-analytics={props["data-analytics"]}
      data-analytics-reason={props["data-analytics-reason"]}
      {...(props.disabled === true ? { disabled: true } : {})}
      {...(props.disabledReason !== undefined
        ? { "data-disabled-reason": props.disabledReason }
        : {})}
      /* A CIRCLE, not a filled rectangle. These sit ON a photograph, and a
         white square button over a picture reads as a hole punched in it.
         The raised surface is the token for "chrome standing above the
         content", so the glyph keeps its contrast over a dark photo without
         this file inventing a scrim colour. */
      shape="circle"
      type="text"
      style={{
        background: cssVar("surface-raised"),
        /* A switched-off arrow is SHOWN, dimmed, rather than removed: the
           pair of arrows is how a person reads "this tile can move", and a
           row whose controls come and go as tiles are reordered is a target
           that moves under the finger. */
        ...(props.disabled === true ? { opacity: 0.45 } : {}),
      }}
    >
      <span aria-hidden="true">{props.glyph}</span>
    </Button>
  );
}

/** The glyphs. Text rather than an icon package: this pair has no icon peer
 * dependency, and `CdnThumbnail`'s broken-image mark is already a glyph. */
const GLYPH = {
  cover: "\u2605",
  remove: "\u2715",
  earlier: "\u2039",
  later: "\u203a",
  retry: "\u21bb",
  cancel: "\u25a0",
  add: "+",
} as const;

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
      style={CELL}
    >
      {/* The tier comes from THIS tile's box at the live device pixel ratio,
          not from `smallestVariantUrl` — see `./CdnThumbnail.tsx`. A restored
          item (`file === null`) still resolving its row draws a skeleton;
          one that resolved to nothing draws the broken-image fallback —
          `useUploadQueue`'s `restoredLookup` is what tells the two apart
          from a plain in-flight tile, which has a `file` and never sets it. */}
      <CdnThumbnail
        localUrl={preview.localUrl}
        image={imageRowOf(item)}
        box={PREVIEW_CELL_BOX}
        alt={t(CDN_I18N_KEYS.itemAlt)}
        resolving={item.file === null && item.restoredLookup === "pending"}
        broken={item.file === null && item.restoredLookup === "done" && item.row === null}
        data-testid="cdn-tile-thumbnail"
      />
      {index === 0 ? (
        <span style={CORNER[COVER_CORNER]} data-corner={COVER_CORNER}>
          {/* THE MARK, NOT THE SENTENCE. At the floor width the cell is 96px
              and the overlay has 88 of them; the Russian cover label is 12
              characters and does not fit with the tag's own padding, and
              a cover badge that ellipsises is a worse badge than a star. The
              words are still there for anything that reads rather than looks:
              `visuallyHidden` puts them in the accessibility tree, which is
              what the ruling's icon-only arm asks for. */}
          <StatusTag
            status="info"
            bordered={false}
            icon={<span aria-hidden="true">{GLYPH.cover}</span>}
            testId="cdn-tile-cover"
          >
            <span style={visuallyHidden}>{t(CDN_I18N_KEYS.itemCover)}</span>
          </StatusTag>
        </span>
      ) : null}
      <span style={CORNER[REMOVE_CORNER]} data-corner={REMOVE_CORNER}>
        <TileIconButton
          glyph={GLYPH.remove}
          label={t(CDN_I18N_KEYS.itemRemove)}
          testId="cdn-tile-remove"
          onClick={() => bag.remove(item.id)}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        />
      </span>
      {/* ORDERING EXISTS ONLY WHERE THERE IS SOMETHING TO ORDER. One photo
          has no earlier and no later, so both arrows would be permanently
          dimmed — two dead controls covering a third of the only picture on
          the screen, which is the composer's own first screen. From two
          tiles up they are always both there, and the one that cannot move
          is dimmed rather than taken away (the pair must not shift under a
          finger as tiles are reordered). */}
      {bag.items.length > 1 ? (
      <span style={CORNER[MOVE_CORNER]} data-corner={MOVE_CORNER}>
        <TileIconButton
          glyph={GLYPH.earlier}
          label={t(CDN_I18N_KEYS.itemMoveEarlier)}
          testId="cdn-tile-earlier"
          disabled={index === 0}
          disabledReason="this is the first tile — the cover badge beside it says so, and there is nothing earlier to move it before"
          onClick={() => bag.reorder(index, index - 1)}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        />
        <TileIconButton
          glyph={GLYPH.later}
          label={t(CDN_I18N_KEYS.itemMoveLater)}
          testId="cdn-tile-later"
          disabled={index === bag.items.length - 1}
          disabledReason="this is the last tile — its position in the visible row is the reason, and there is nothing later to move it after"
          onClick={() => bag.reorder(index, index + 1)}
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        />
      </span>
      ) : null}
      <span
        style={CORNER[PHASE_CORNER]}
        data-corner={PHASE_CORNER}
        aria-live="polite"
      >
        {busy ? (
          <TileIconButton
            glyph={GLYPH.cancel}
            label={t(CDN_I18N_KEYS.itemCancel)}
            testId="cdn-tile-cancel"
            onClick={() => bag.cancel(item.id)}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          />
        ) : null}
        {item.phase === "failed" || item.phase === "canceled" ? (
          <TileIconButton
            glyph={GLYPH.retry}
            label={t(CDN_I18N_KEYS.itemRetry)}
            testId="cdn-tile-retry"
            onClick={() => bag.retry(item.id)}
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          />
        ) : null}
        <StatusTag
          status={PHASE_FAMILY[item.phase]}
          bordered={false}
          testId="cdn-tile-phase"
        >
          {t(PHASE_KEYS[item.phase])}
        </StatusTag>
      </span>
    </div>
  );
}

/**
 * THE ADD TILE — the picker, as one more cell of the grid.
 *
 * What it replaces is the shape the demo showed: a 96px thumbnail alone in a
 * full-width dashed rectangle with a button under it, which reads as an empty
 * region that happens to contain a photograph rather than as a grid of
 * photographs with a way to add one more.
 *
 * It is a real `<button>` and not a `<label>`. `./DropZone.tsx` argues the
 * point at length: a label is not focusable, so a label-driven picker is
 * unreachable by keyboard, and the hidden input is out of the tab order. The
 * dashed border is HERE and nowhere else — it is the affordance of the empty
 * cell, not a frame around the whole gallery.
 *
 * The gate travels with it: full, or uploads still in flight, is a sentence
 * `GatedButton` renders beside the control rather than a button that is
 * merely off. The drop half lives on the grid, so a file dropped on any cell
 * lands.
 */
function AddTile(props: { readonly bag: UploadQueueBag }): ReactElement {
  const t = useT();
  const inputId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const { bag } = props;
  const label = t(CDN_I18N_KEYS.pickImages);
  return (
    <div style={CELL} data-testid="cdn-gallery-add">
      <GatedButton
        gate={bag.canAdd}
        aria-label={label}
        onClick={() => input.current?.click()}
        testId="cdn-gallery-drop-pick"
        /* The cell states the square; the gate's own wrapper stands between
           it and the button, so it has to pass the height through or the
           button collapses to its content — which is what a cell with an
           `aspect-ratio` and a 0-height child looks like. */
        wrapperStyle={{ inlineSize: "100%", blockSize: "100%", display: "flex" }}
        style={{
          inlineSize: "100%",
          blockSize: "100%",
          border: `1px dashed ${cssVar("border-subtle")}`,
          borderRadius: PREVIEW_TILE_RADIUS_PX,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        <span aria-hidden="true" style={{ fontSize: ADD_GLYPH_PX, lineHeight: 1 }}>
          {GLYPH.add}
        </span>
      </GatedButton>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={bag.accept.attribute}
        multiple
        onChange={(event) => {
          const list = event.target.files;
          const files = list === null ? [] : Array.from(list);
          /* Reset BEFORE handing the files on, so picking the same file again
             still fires `change` — the classic reason a retry after a failure
             appears to do nothing (`./DropZone.tsx` makes the same move). */
          event.target.value = "";
          if (files.length > 0) bag.add(files);
        }}
        style={{ display: "none" }}
        data-testid="cdn-gallery-drop-input"
      />
    </div>
  );
}

/** The plus, at a size that reads as an affordance in a 96px cell rather
 * than as a stray character. */
const ADD_GLYPH_PX = 24;

function GalleryBody(props: { bag: UploadQueueBag }): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const { bag } = props;
  const settledGate = useActionGate(bag.settled);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  /* THE COLUMN COUNT COMES FROM THIS GRID'S OWN WIDTH — see
     `galleryColumns`. The ref is on the grid and not on the field, because
     the grid is the box the columns are laid into. */
  const grid = useRef<HTMLDivElement | null>(null);
  const { width } = useElementWidth(grid);
  const columns = galleryColumns(width);

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
      {/* THE GRID, AND IT IS THE DROP TARGET.
          Dropping anywhere on the grid adds, which is what a person aims at;
          the dashed edge belongs to the ADD TILE alone, and the drag-over
          state outlines the whole grid so the target reads as the target. */}
      <div
        ref={grid}
        data-testid="cdn-gallery-grid"
        data-columns={String(columns)}
        data-dragging={over ? "true" : "false"}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${String(columns)}, minmax(${String(PREVIEW_TILE_PX)}px, 1fr))`,
          gap: GALLERY_GAP,
          alignItems: "start",
          borderRadius: radii.lg,
          outline: over ? `2px solid ${cssVar("border-subtle")}` : "none",
          outlineOffset: OVERLAY_INSET,
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (bag.canAdd.available) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDropCapture={(event) => {
          /* A file dropped from the desktop and a TILE dragged within the
             grid arrive at the same handler. Only the first carries files;
             the second is the reorder the tiles handle themselves. */
          setOver(false);
          const files = Array.from(event.dataTransfer.files);
          if (files.length === 0 || !bag.canAdd.available) return;
          event.preventDefault();
          bag.add(files);
        }}
      >
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
        {/* ONE MORE CELL, LAST — the add tile. Last rather than first because
            the grid reads in upload order and the first cell is the cover:
            a picker standing where the cover belongs is a cover nobody can
            find. */}
        <AddTile bag={bag} />
      </div>
      {/* The empty gallery still SAYS it is empty, under the grid rather than
          instead of it: the add tile is on screen either way, so replacing
          the whole grid with a placeholder would take away the one control
          the sentence is about. */}
      {bag.items.length === 0 ? (
        <EmptyState
          compact
          title={t(CDN_I18N_KEYS.galleryEmpty)}
          hint={t(CDN_I18N_KEYS.galleryEmptyHint)}
          testId="cdn-gallery-empty"
        />
      ) : null}
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
      {/* A REFUSAL IS A SENTENCE TOO, and it left the tile for the same
          reason the dedupe note did: an alert inside a square picture is
          either clipped or it is not a square picture. The tile says which
          one failed — its phase tag is the error family and its retry is
          right there; the words are here, where there is a line to put them
          on. */}
      {bag.items.map((item) =>
        item.error === null ? null : (
          <ErrorAlert key={item.id} thrown={item.error} testId="cdn-gallery-error" />
        )
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
