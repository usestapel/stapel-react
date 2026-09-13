/**
 * THE DESKTOP GALLERY: a hero, a filmstrip, and a lightbox behind them.
 *
 * ── What was measured ─────────────────────────────────────────────────────
 *
 * The walk of 2026-09-12 read this page's photographs against the reference
 * classified and found three absences at once: a GRID of equal tiles where
 * the reference draws one large picture, no arrows anywhere, and no way to
 * open a photograph at all. On a listing with seven pictures a person could
 * see seven thumbnails of a phone and never one phone — which on a classified
 * is the whole read.
 *
 * `galleryLayout="hero"` is the reference's own anatomy, and it is three
 * things that only work as one:
 *
 *   the HERO       one large photograph, and it is a BUTTON — the click that
 *                  opens the set is the gesture every catalogue has trained
 *                  people to make, and a `<div onClick>` would be a control no
 *                  keyboard can reach and no screen reader can announce;
 *   the FILMSTRIP  a scrolling row of thumbnails, each one a button that
 *                  changes the hero. `aria-current` is the state, so the mark
 *                  a sighted reader sees (the undimmed, outlined thumbnail)
 *                  and the one a screen reader is told are the SAME fact —
 *                  never a class that means something only to the eye;
 *   the LIGHTBOX   the set at full size, with its own two arrows, the two
 *                  arrow keys, a swipe, and Escape.
 *
 * ── The lightbox is a SkinDialog, not a modal of our own ──────────────────
 *
 * `@stapel/tokens-antd/skin` owns the one dialog surface in this fleet
 * (`stapel/no-bare-dialog` fails lint on anything else), so the lightbox is
 * that surface with a photograph in it: the theming, the mask, the portal and
 * the destroy-on-close are the substrate's.
 *
 * `surface="modal"` is stated rather than resolved from the viewport, and the
 * reason is that this ARM is the desktop. A phone renders `galleryLayout=
 * "strip"` — the snap-scrolling row with its own counter — and never reaches
 * this file, so the design-system rule the surface hook exists for ("on a
 * phone a modal is a bottom sheet") is not being escaped here: a bottom sheet
 * for a full-size photograph would be the wrong shape for a surface a phone
 * does not get.
 *
 * ── What this component does for itself, and why ──────────────────────────
 *
 * Three things the dialog underneath does NOT do, each verified in a browserless
 * DOM before being written down:
 *
 *  1. FOCUS DOES NOT MOVE IN on open. The dialog mounts, `document.activeElement`
 *     stays on `<body>`, and a keyboard is then outside a surface with a mask
 *     over everything it could otherwise reach. So the lightbox focuses its own
 *     box (`tabIndex={-1}`) as it opens, which also puts the arrow keys under
 *     the hand immediately.
 *  2. TAB IS NOT TRAPPED. Without a trap the third Tab walks out of the
 *     lightbox and into the page behind the mask, where a sighted reader
 *     cannot see what is focused. The trap is a `keydown` listener on the
 *     DIALOG element rather than on this component's own box, because the
 *     dialog's close control is a sibling of the body and a handler on the
 *     body would never hear a Tab pressed on it.
 *  3. FOCUS IS NOT RESTORED on close. Every way out — the arrows' own close
 *     button, Escape, the mask — is routed through one `close()`, which puts
 *     focus back on the hero that opened the lightbox. A dialog that closes
 *     onto `<body>` has sent a keyboard back to the top of the document.
 *
 * The two arrow keys and Escape ride the same listener, so the set of keys the
 * lightbox answers is stated in one place rather than in three handlers that
 * drift.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from "react";
import { Typography } from "antd";
import { SkinButton as Button, SkinDialog } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { swipeStep } from "./cardGallery.js";
import {
  LIGHTBOX_MAX_HEIGHT,
  LISTINGS_FILMSTRIP_CLASS,
  LISTINGS_GALLERY_CLASS,
  LISTINGS_GALLERY_COUNTER_CLASS,
  LISTINGS_GALLERY_STYLE_HREF,
  LISTINGS_HERO_CLASS,
  LISTINGS_LIGHTBOX_CLASS,
  LISTINGS_LIGHTBOX_STAGE_CLASS,
  LISTINGS_THUMB_CLASS,
  detailGalleryCss,
} from "./detailGallery.js";
import { ListingPhoto } from "./ListingPhoto.js";
import { GalleryNextIcon, GalleryPrevIcon } from "./icons.js";

/**
 * Everything inside the dialog that a Tab can land on.
 *
 * Read off the live DOM rather than from a list of this component's own
 * controls: the dialog's close button belongs to the substrate and a trap that
 * only knew about the parts written here would skip it — which is a trap that
 * silently drops one stop out of the ring.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ListingHeroGalleryProps {
  /** The stored references, in the seller's order. Empty draws the designed
   * "no photo" box, exactly as every other surface in this pair does. */
  readonly images: readonly string[];
  /** The listing's title — the fallback alt for a listing with one picture. */
  readonly title: string;
  /**
   * Chrome pinned over the photographs — the pane's action cluster at
   * `actionsPlacement="gallery"`. It is a NODE and not a flag because the
   * cluster is the pane's one instance and may be travelling.
   */
  readonly overlay?: ReactNode;
  /** The page's own gutter between the hero and the filmstrip — the pane
   * reads the responsive token and hands the value down. */
  readonly gap: string;
}

/**
 * The hero, the filmstrip and the lightbox they open — see the file header.
 *
 * The active photograph is held HERE and not in the pane: it is the answer to
 * "which one am I looking at", the hero and the lightbox share it (closing the
 * lightbox on the fourth picture leaves the hero on the fourth picture), and
 * nothing above this box has a use for it.
 */
export function ListingHeroGallery(props: ListingHeroGalleryProps): ReactElement {
  const t = useT();
  const { images } = props;
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const hero = useRef<HTMLButtonElement>(null);

  const alt = (index: number): string =>
    images.length > 1
      ? t(LISTINGS_I18N_KEYS.detailPhotoAlt, {
          index: index + 1,
          total: images.length,
        })
      : props.title;

  /* THE ONE WAY OUT. Escape, the close control and the mask all land here, so
     the focus restoration cannot be true of one of them and false of the other
     two. The hero is the opener whichever control opened it — there is only
     one — so it is what focus goes back to. */
  const close = useCallback((): void => {
    setOpen(false);
    hero.current?.focus();
  }, []);

  return (
    <div
      data-testid="listings-detail-gallery"
      data-gallery-active={String(active)}
      className={LISTINGS_GALLERY_CLASS}
      data-gallery-layout="hero"
      style={{ gap: props.gap, position: "relative" }}
    >
      <style href={LISTINGS_GALLERY_STYLE_HREF} precedence="default">
        {detailGalleryCss()}
      </style>
      {/* The large photograph. `aria-haspopup="dialog"` because the press does
          not navigate and does not change the page — it opens a surface, and
          that is the one thing a person deciding whether to press it needs
          told in advance. */}
      <button
        type="button"
        ref={hero}
        className={LISTINGS_HERO_CLASS}
        aria-label={t(LISTINGS_I18N_KEYS.detailGalleryOpen)}
        aria-haspopup="dialog"
        data-testid="listings-detail-hero"
        /* WHICH photograph is the large one, as a fact anything can read.
           `@stapel/image` commits its `<img>` only once it has MEASURED the
           slot, so in a browserless DOM the alt text a reader would hear is
           not in the tree at all — and a gallery whose whole claim is "this
           press changes the picture" then has nothing to prove it with. The
           stored reference is the same fact one step earlier, and it is also
           what a host debugging a gallery in a live page wants to see. */
        data-photo={images[active] ?? ""}
        data-analytics="none"
        data-analytics-reason="a look, not an outcome — enlarging a photograph navigates nowhere and changes no record"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ListingPhoto
          {...(images[active] !== undefined ? { imageRef: images[active] } : { imageRef: undefined })}
          alt={alt(active)}
        />
      </button>

      {/* A strip of one is a control for a choice nobody has — the same rule
          the card's peek and dots already follow. */}
      {images.length > 1 ? (
        <div
          className={LISTINGS_FILMSTRIP_CLASS}
          data-testid="listings-detail-filmstrip"
        >
          {images.map((reference, index) => (
            <button
              key={reference}
              type="button"
              className={LISTINGS_THUMB_CLASS}
              // The state, once: the outline a reader SEES and the fact a
              // screen reader is TOLD are this one attribute, so they cannot
              // disagree. `undefined` rather than "false" — an `aria-current`
              // of "false" is still announced by some readers.
              {...(index === active ? { "aria-current": "true" as const } : {})}
              aria-label={alt(index)}
              data-testid="listings-detail-thumb"
              data-analytics="none"
              data-analytics-reason="a look, not an outcome — choosing a photograph navigates nowhere and changes no record"
              onClick={() => {
                setActive(index);
              }}
            >
              <ListingPhoto imageRef={reference} alt="" />
            </button>
          ))}
        </div>
      ) : null}

      {props.overlay}

      {open ? (
        <ListingLightbox
          images={images}
          index={active}
          alt={alt}
          onMove={setActive}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

interface ListingLightboxProps {
  readonly images: readonly string[];
  readonly index: number;
  readonly alt: (index: number) => string;
  readonly onMove: (index: number) => void;
  readonly onClose: () => void;
}

/**
 * The set at full size — see the file header for the three things this adds to
 * `<SkinDialog>` and why each one was needed.
 *
 * The photograph is drawn `object-fit: contain` and not `cover`: a lightbox
 * exists to show the WHOLE picture, and a crop at this size is the defect a
 * person opened it to get away from.
 */
function ListingLightbox(props: ListingLightboxProps): ReactElement {
  const t = useT();
  const { images, index, onMove, onClose } = props;
  const total = images.length;
  const box = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);

  /* A RING, not a line. Wrapping is what makes the two arrows live controls at
     both ends: a disabled arrow on the first photograph of four is a control
     that is visibly offered and does nothing, which this fleet treats as worse
     than its absence. */
  const move = useCallback(
    (step: number): void => {
      if (total === 0) return;
      onMove((index + step + total) % total);
    },
    [index, total, onMove]
  );

  /* FOCUS GOES IN, AND STAYS IN. See the file header, item 1 and item 2: the
     dialog underneath moves no focus on open and traps no Tab, so both are
     answered here — on the DIALOG element, because its own close control is a
     sibling of this box and a listener here would never hear it. */
  useEffect(() => {
    const node = box.current;
    if (node === null) return undefined;
    node.focus();
    const dialog = node.closest<HTMLElement>('[role="dialog"]') ?? node;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key !== "Tab") return;
      const stops = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (first === undefined || last === undefined) return;
      // Only the two EDGES are answered. Everything between them is the
      // browser's own order, which is the order a person expects.
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("keydown", onKey);
    };
  }, [move, onClose]);

  /* A FINGER. The same rule the card's strip commits on (`swipeStep`): far
     enough across, and further across than down, so a diagonal thumb scrolling
     the page changes no photograph. The stage's own width is the measure — a
     viewport-derived number would be about the screen and not about the
     picture. */
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    gesture.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>): void => {
    const start = gesture.current;
    gesture.current = null;
    if (start === null) return;
    const width = event.currentTarget.getBoundingClientRect().width;
    const step = swipeStep(event.clientX - start.x, event.clientY - start.y, width);
    if (step !== 0) move(step);
  };

  return (
    <SkinDialog
      open
      // See the file header: this arm IS the desktop, and a phone renders the
      // strip instead of ever reaching it.
      surface="modal"
      onClose={onClose}
      // The dialog's accessible NAME, and the reason it is a visible title
      // rather than an `aria-label`: the substrate forwards a title into
      // `aria-labelledby` on the `role="dialog"` element, where a bare
      // `aria-label` never arrives — measured in a DOM, not assumed.
      title={t(LISTINGS_I18N_KEYS.cardPhotos)}
      dismissLabel={t(LISTINGS_I18N_KEYS.detailGalleryClose)}
      width={LIGHTBOX_WIDTH}
      data-testid="listings-detail-lightbox"
    >
      <div
        ref={box}
        // Focused as the lightbox opens, so a keyboard is inside the surface
        // the mask has cut the rest of the page off from — and so the two
        // arrow keys are live without a Tab first.
        tabIndex={-1}
        className={LISTINGS_LIGHTBOX_CLASS}
        style={{ outline: "none" }}
      >
        <Button
          shape="circle"
          aria-label={t(LISTINGS_I18N_KEYS.detailGalleryPrev)}
          icon={<GalleryPrevIcon />}
          data-testid="listings-detail-lightbox-prev"
          data-analytics="none"
          data-analytics-reason="a look, not an outcome — moving through photographs navigates nowhere and changes no record"
          onClick={() => {
            move(-1);
          }}
        />
        <div
          className={LISTINGS_LIGHTBOX_STAGE_CLASS}
          data-testid="listings-detail-lightbox-stage"
          /* See the hero's own — the reference standing in for a picture a
             browserless DOM never paints. */
          data-photo={images[index] ?? ""}
          data-analytics="none"
          data-analytics-reason="a look, not an outcome — swiping photographs navigates nowhere and changes no record"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <ListingPhoto
            {...(images[index] !== undefined
              ? { imageRef: images[index] }
              : { imageRef: undefined })}
            alt={props.alt(index)}
            style={{
              objectFit: "contain",
              maxHeight: LIGHTBOX_MAX_HEIGHT,
              borderRadius: radii.md,
            }}
          />
        </div>
        <Button
          shape="circle"
          aria-label={t(LISTINGS_I18N_KEYS.detailGalleryNext)}
          icon={<GalleryNextIcon />}
          data-testid="listings-detail-lightbox-next"
          data-analytics="none"
          data-analytics-reason="a look, not an outcome — moving through photographs navigates nowhere and changes no record"
          onClick={() => {
            move(1);
          }}
        />
        {/* Where in the set this is. `aria-live` for the same reason the
            strip's counter carries one: an arrow key and a swipe both change
            the picture with nothing a screen reader would otherwise report. */}
        <Typography.Text
          className={LISTINGS_GALLERY_COUNTER_CLASS}
          data-testid="listings-detail-lightbox-counter"
          aria-live="polite"
        >
          {t(LISTINGS_I18N_KEYS.cardPhotoCounter, {
            index: index + 1,
            total,
          })}
        </Typography.Text>
        {/* The way out, stated as a word rather than only as the dialog's own
            corner glyph: the lightbox is operated from its middle, and the
            nearest control to a hand that has been pressing arrows should be
            an arrow's neighbour. */}
        <Button
          data-testid="listings-detail-lightbox-close"
          data-analytics="none"
          data-analytics-reason="local-ui-dismiss-lightbox"
          style={{ position: "absolute", insetBlockStart: spacing[2], insetInlineEnd: spacing[2] }}
          onClick={onClose}
        >
          {t(LISTINGS_I18N_KEYS.detailGalleryClose)}
        </Button>
      </div>
    </SkinDialog>
  );
}

/**
 * How wide the lightbox gets.
 *
 * `min()` and not a fixed track: a 1600px photograph on a 1280px laptop would
 * otherwise put its own arrows off the screen. The `90vw` arm is what a narrow
 * window gets and the rem arm is the ceiling on a large one.
 */
const LIGHTBOX_WIDTH = "min(90vw, 60rem)";
