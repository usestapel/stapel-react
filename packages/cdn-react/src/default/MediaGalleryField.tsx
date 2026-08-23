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
 * ── Whose queue is it ──────────────────────────────────────────────────────
 *
 * Either the caller's (`bag`) or this field's (`max`). A composer consumes
 * `bag.refs` as `images_draft` and `bag.settled` as its publish gate, so when
 * a composer is on the page the bag it holds and the bag drawn here must be
 * ONE object — see {@link MediaGalleryFieldBagProps}.
 */
import { useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { Button, Space, Typography } from "antd";
import { useActionGate, useErrorDisplay, useT } from "@stapel/core";
import { MediaUploader } from "../headless/MediaUploader.js";
import type { UploadItem, UploadQueueBag } from "../headless/useUploadQueue.js";
import { useUploadPreview } from "../headless/useUploadPreview.js";
import type { CdnRef } from "../api/types.js";
import type { CdnUploadTarget } from "../model/upload.js";
import { CDN_I18N_KEYS } from "../i18n/keys.js";
import { ErrorAlert } from "./ErrorAlert.js";
import { PHASE_KEYS, PREVIEW_BOX } from "./phase.js";

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

function Tile(props: {
  item: UploadItem;
  index: number;
  bag: UploadQueueBag;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
}): ReactElement {
  const t = useT();
  const errorDisplay = useErrorDisplay(CDN_I18N_KEYS.unknownError);
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
      style={{ width: PREVIEW_BOX.width }}
    >
      {preview.url === null ? (
        <div style={{ ...PREVIEW_BOX, border: "1px dashed" }} />
      ) : (
        <img src={preview.url} alt={t(CDN_I18N_KEYS.itemAlt)} style={PREVIEW_BOX} />
      )}
      <Typography.Text type="secondary" data-testid="cdn-tile-phase">
        {t(PHASE_KEYS[item.phase])}
      </Typography.Text>
      {index === 0 ? (
        <Typography.Text type="secondary" data-testid="cdn-tile-cover">
          {t(CDN_I18N_KEYS.itemCover)}
        </Typography.Text>
      ) : null}
      {item.deduped ? (
        <Typography.Text type="secondary" data-testid="cdn-tile-deduped">
          {t(CDN_I18N_KEYS.deduped)}
        </Typography.Text>
      ) : null}
      <ErrorAlert error={errorDisplay(item.error)} testId="cdn-tile-error" />
      <Space size="small" wrap>
        {busy ? (
          <Button
            size="small"
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
            size="small"
            onClick={() => bag.retry(item.id)}
            data-testid="cdn-tile-retry"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
          >
            {t(CDN_I18N_KEYS.itemRetry)}
          </Button>
        ) : null}
        <Button
          size="small"
          onClick={() => bag.remove(item.id)}
          data-testid="cdn-tile-remove"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(CDN_I18N_KEYS.itemRemove)}
        </Button>
        <Button
          size="small"
          disabled={index === 0}
          onClick={() => bag.reorder(index, index - 1)}
          data-testid="cdn-tile-earlier"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(CDN_I18N_KEYS.itemMoveEarlier)}
        </Button>
        <Button
          size="small"
          disabled={index === bag.items.length - 1}
          onClick={() => bag.reorder(index, index + 1)}
          data-testid="cdn-tile-later"
          data-analytics="none"
          data-analytics-reason="business action — host app wraps with its own tracked()"
        >
          {t(CDN_I18N_KEYS.itemMoveLater)}
        </Button>
      </Space>
    </div>
  );
}

function GalleryBody(props: { bag: UploadQueueBag }): ReactElement {
  const t = useT();
  const { bag } = props;
  const addGate = useActionGate(bag.canAdd);
  const settledGate = useActionGate(bag.settled);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const onPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files;
    event.target.value = "";
    if (files === null || files.length === 0) return;
    bag.add(Array.from(files));
  };

  const onDrop = (index: number): void => {
    if (dragging === null) return;
    bag.reorder(dragging, index);
    setDragging(null);
  };

  return (
    <Space direction="vertical" data-testid="cdn-gallery">
      <Typography.Text data-testid="cdn-gallery-count">
        {t(CDN_I18N_KEYS.galleryCount, {
          used: bag.capacity.used,
          max: bag.capacity.max,
        })}
      </Typography.Text>
      <Space wrap align="start">
        {bag.items.length === 0 ? (
          <Typography.Text type="secondary" data-testid="cdn-gallery-empty">
            {t(CDN_I18N_KEYS.galleryEmpty)}
          </Typography.Text>
        ) : (
          bag.items.map((item, index) => (
            <Tile
              key={item.id}
              item={item}
              index={index}
              bag={bag}
              onDragStart={setDragging}
              onDrop={onDrop}
            />
          ))
        )}
      </Space>
      <input
        ref={input}
        type="file"
        multiple
        accept={bag.accept.attribute}
        onChange={onPick}
        style={{ display: "none" }}
        data-testid="cdn-gallery-input"
      />
      <Button
        onClick={() => input.current?.click()}
        disabled={addGate.disabled}
        data-testid="cdn-gallery-add"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {t(CDN_I18N_KEYS.pickImages)}
      </Button>
      {addGate.reason === undefined ? null : (
        <Typography.Text type="secondary" data-testid="cdn-gallery-add-blocked">
          {addGate.reason}
        </Typography.Text>
      )}
      {settledGate.reason === undefined ? null : (
        <Typography.Text type="secondary" data-testid="cdn-gallery-unsettled">
          {settledGate.reason}
        </Typography.Text>
      )}
    </Space>
  );
}

export function MediaGalleryField(props: MediaGalleryFieldProps): ReactElement {
  // A queue handed in is drawn directly: no `MediaUploader`, because mounting
  // one would create the SECOND queue this prop exists to prevent.
  if (props.bag !== undefined) return <GalleryBody bag={props.bag} />;
  return (
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
}
