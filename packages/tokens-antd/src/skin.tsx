/**
 * `@stapel/tokens-antd/skin` — the ONE dialog surface every default skin
 * renders through.
 *
 * ## Why this lives in the token bridge
 *
 * Owner ruling (2026-08-24): **on a phone a modal is a bottom sheet. Modals
 * are tablet/desktop only.** That is a DESIGN-SYSTEM rule, not a per-component
 * preference — so it cannot live in a component, because the next package to
 * ship a dialog would have to remember it, and the record says it does not:
 * of the eleven `Modal` sites in every package's `src/default` tree when this module
 * was written, eight rendered a centred desktop modal on a 390px phone. The
 * three that got it right had each hand-written the same
 * `isPhone ? <Drawer placement="bottom"> : <Modal>` branch, with three
 * different sets of behaviours and none of the ones a real sheet needs.
 *
 * `@stapel/tokens-antd` is the only package EVERY antd default skin already
 * depends on — it is what makes a skin self-theming — so it is the only place
 * a rule can be stated once and inherited by all of them without inverting
 * the dependency graph (a pair must not depend on the shell, and `@stapel/
 * core` is deliberately design-system-agnostic and carries no antd). The root
 * export stays what it always was — pure functions, no components; this
 * subpath is the one antd SURFACE the bridge owns, and a host that only wants
 * the theme mapping never loads it.
 *
 * Regression is held by `stapel/no-bare-dialog` (@stapel/eslint-plugin),
 * which fails lint on a bare antd `Modal`/`Drawer` under `src/default/**`.
 *
 * ## What a bottom sheet has to actually do
 *
 * A `Drawer placement="bottom"` is not a bottom sheet; it is a drawer that
 * comes from the bottom. {@link SkinDialog} adds the rest:
 *
 *  - **swipe to dismiss** from the grab handle / header, with a distance
 *    threshold and a rubber-band return when the gesture does not commit;
 *  - **a keyboard equivalent for that gesture** — the handle IS a button with
 *    an accessible name, reachable by Tab and activated by Enter/Space, so
 *    the dismissal is never gesture-only (Esc also closes, via antd);
 *  - **safe-area insets** — a sheet sits ON the home indicator otherwise;
 *  - **scroll containment** — `overscroll-behavior: contain`, so flicking
 *    past the end of the sheet's own content does not scroll the page under
 *    it (and, on iOS, does not drag the sheet's own dismissal gesture);
 *  - **focus management** — antd traps focus inside the panel and restores it
 *    to the opener on close; the sheet keeps that and adds the accessible
 *    name (`aria-label`) a header-less sheet would otherwise not have.
 *
 * ## The surface decision is not a measurement
 *
 * Which surface to render is a decision about the VIEWPORT's shape — the one
 * legitimate use of a viewport query (an element-sized decision would be a
 * defect; see `@stapel/image`). It reads one `matchMedia` against
 * `@stapel/tokens`' `tablet` breakpoint through `useSyncExternalStore`, so
 * the very first CLIENT render already has the right answer: the
 * `useBreakpoint()` pattern (`undefined` until an effect runs) would paint a
 * desktop modal on a phone for one frame and then swap it for a sheet.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from "react";
import { Drawer, Modal, theme as antdTheme } from "antd";
import { breakpoints } from "@stapel/tokens";

/**
 * Which shape a dialog takes: a bottom `"sheet"` (phone) or a centred
 * `"modal"` (tablet and desktop).
 */
export type DialogSurface = "sheet" | "modal";

/**
 * The rule, as a media query: at or above the `tablet` breakpoint a dialog is
 * a modal; below it, a sheet. One query, derived from the same generated
 * `@stapel/tokens` breakpoints `@stapel/core`'s `useBreakpoint()` reads, so
 * the two can never disagree about where a phone ends.
 */
export const MODAL_MEDIA_QUERY: string = `(min-width: ${String(breakpoints.tablet)}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const query = window.matchMedia(MODAL_MEDIA_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function readSurface(): DialogSurface {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "modal";
  }
  return window.matchMedia(MODAL_MEDIA_QUERY).matches ? "modal" : "sheet";
}

/** `"modal"` where there is no DOM to ask (SSR): the server cannot know the
 * viewport, and a dialog is closed on the first paint either way, so the
 * hydrated client render is the first one that can be seen. */
function serverSurface(): DialogSurface {
  return "modal";
}

/**
 * The surface a dialog should take right now — `"sheet"` on a phone,
 * `"modal"` on tablet/desktop — recomputed when the viewport crosses the
 * breakpoint (rotation, a resized desktop window, a split-screen tablet).
 *
 * Exported so a skin that cannot use {@link SkinDialog} (an antd
 * `Modal.confirm` imperative call, a third-party dialog) can still obey the
 * same rule from the same source.
 */
export function useDialogSurface(): DialogSurface {
  return useSyncExternalStore(subscribe, readSurface, serverSurface);
}

/** How far the sheet must be dragged down before letting go dismisses it. */
const DISMISS_DISTANCE_PX = 88;
/** …or how fast, for a quick flick that never travels that far. */
const DISMISS_VELOCITY_PX_PER_MS = 0.5;
/** A flick still has to be a flick. Without a floor, a 6px twitch during a tap
 * on the header divides by a near-zero elapsed time and reads as a very fast
 * dismissal — the sheet vanishing under a finger that only meant to touch it. */
const FLICK_MIN_DISTANCE_PX = 40;

export interface SkinDialogProps {
  readonly open: boolean;
  /** Dismissal — the close button, the mask, Esc, and the swipe all call it. */
  readonly onClose: () => void;
  /** Visible heading. Omit for a chrome-less dialog, and pass `ariaLabel`. */
  readonly title?: ReactNode;
  /**
   * The dialog's accessible name when {@link SkinDialogProps.title} is
   * absent — a dialog with neither is announced as an unnamed region.
   */
  readonly ariaLabel?: string;
  /**
   * The accessible name of the sheet's grab handle, and of the modal's close
   * button — i18n copy, so the CALLER supplies it from its own key registry.
   * The token bridge owns no i18n and must not invent user-facing English.
   */
  readonly dismissLabel: string;
  readonly children?: ReactNode;
  /** Action row. Omitted = no footer (the body owns its own buttons). */
  readonly footer?: ReactNode;
  /** Modal width. Ignored by the sheet, which is always viewport-wide. */
  readonly width?: number | string;
  /** Default `true` — a dialog's body is a journey, and a closed journey
   * should not keep its half-filled state alive off-screen. */
  readonly destroyOnHidden?: boolean;
  /**
   * Whether clicking the backdrop dismisses. Left UNSET by default rather
   * than defaulted to `true`: antd 6 deprecated `Modal.maskClosable` in favour
   * of `mask.closable` and warns on its mere presence, so forwarding it
   * unconditionally would print a deprecation for every dialog in the fleet.
   * Set `false` for a dialog that must be answered.
   */
  readonly maskClosable?: boolean;
  /**
   * Force a surface instead of reading the viewport. For tests and for the
   * rare host that renders a modal inside a phone-width container that is not
   * the viewport. Not an escape hatch for "I prefer a modal on phones".
   */
  readonly surface?: DialogSurface;
  readonly className?: string;
  readonly "data-testid"?: string;
}

/**
 * A dialog that is a bottom sheet on a phone and a centred modal on
 * tablet/desktop.
 *
 * Every default skin's dialogs render through this. The rendered surface is
 * stamped on the body wrapper as `data-stapel-dialog-surface`, so a package's
 * own tests can prove it inherits the rule rather than asserting it in prose.
 */
export function SkinDialog(props: SkinDialogProps): ReactElement {
  const auto = useDialogSurface();
  const surface = props.surface ?? auto;
  const { token } = antdTheme.useToken();
  const {
    open,
    onClose,
    title,
    ariaLabel,
    dismissLabel,
    children,
    footer,
    destroyOnHidden = true,
  } = props;

  const body = (
    <div
      data-stapel-dialog-surface={surface}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
    >
      {children}
    </div>
  );

  if (surface === "modal") {
    return (
      <Modal
        open={open}
        onCancel={onClose}
        destroyOnHidden={destroyOnHidden}
        footer={footer ?? null}
        closable={{ "aria-label": dismissLabel }}
        {...(props.maskClosable !== undefined ? { maskClosable: props.maskClosable } : {})}
        {...(title !== undefined ? { title } : {})}
        {...(ariaLabel !== undefined && title === undefined
          ? { "aria-label": ariaLabel }
          : {})}
        {...(props.width !== undefined ? { width: props.width } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
      >
        {body}
      </Modal>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      dismissLabel={dismissLabel}
      destroyOnHidden={destroyOnHidden}
      radius={token.borderRadiusLG}
      handleColor={token.colorFillSecondary}
      bodyPadding={token.paddingLG}
      {...(props.maskClosable !== undefined ? { maskClosable: props.maskClosable } : {})}
      {...(title !== undefined ? { title } : {})}
      {...(ariaLabel !== undefined ? { ariaLabel } : {})}
      {...(footer !== undefined ? { footer } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
    >
      {body}
    </BottomSheet>
  );
}

interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly dismissLabel: string;
  readonly destroyOnHidden: boolean;
  readonly maskClosable?: boolean;
  readonly radius: number;
  readonly handleColor: string;
  readonly bodyPadding: number;
  readonly title?: ReactNode;
  readonly ariaLabel?: string;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * The sheet half of {@link SkinDialog}.
 *
 * The drag is applied to antd's own content wrapper through `styles.wrapper`
 * rather than to a div of ours inside the panel: the panel is what the mask
 * sits behind and what the close animation moves, so translating anything
 * inside it would slide the content out of its own chrome.
 */
function BottomSheet(props: BottomSheetProps): ReactElement {
  const { open, onClose, radius, handleColor, bodyPadding } = props;
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ startY: number; startedAt: number } | null>(null);

  // A sheet that was dragged halfway and then closed some other way (Esc, the
  // mask, an action inside it) must not reopen still translated.
  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
      gesture.current = null;
    }
  }, [open]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    // Primary pointer only: a second finger landing mid-drag must not restart
    // the gesture from its own position, which reads as the sheet jumping.
    // Compared against `false`, not coerced: an environment whose pointer
    // events carry no `isPrimary` (jsdom, some webviews) would otherwise have
    // every gesture refused, which is a dead sheet, not a safe default.
    if (event.isPrimary === false) return;
    gesture.current = { startY: event.clientY, startedAt: event.timeStamp };
    setDragging(true);
    // Guarded: jsdom (and a couple of older webviews) ship pointer events
    // without the capture API. An unguarded call throws out of the handler and
    // the whole gesture — including the dismissal at the end of it — is lost.
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    const start = gesture.current;
    if (start === null) return;
    // Downward only. Dragging a bottom sheet UP is not "open it more" — there
    // is no more — and letting it travel up detaches it from the screen edge.
    setDragY(Math.max(0, event.clientY - start.startY));
  }, []);

  const endGesture = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const start = gesture.current;
      gesture.current = null;
      setDragging(false);
      if (start === null) return;
      if (
        typeof event.currentTarget.hasPointerCapture === "function" &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const distance = Math.max(0, event.clientY - start.startY);
      const elapsed = Math.max(1, event.timeStamp - start.startedAt);
      const velocity = distance / elapsed;
      const flicked =
        distance >= FLICK_MIN_DISTANCE_PX && velocity >= DISMISS_VELOCITY_PX_PER_MS;
      if (distance >= DISMISS_DISTANCE_PX || flicked) {
        onClose();
        return;
      }
      // Did not commit: spring back rather than leaving it half-open.
      setDragY(0);
    },
    [onClose]
  );

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
  };

  const grabArea: CSSProperties = {
    // The gesture owns vertical panning here; without this the browser scrolls
    // the page instead and the sheet never moves on a real phone.
    touchAction: "none",
    cursor: "grab",
  };

  const header = (
    <div style={{ ...grabArea, userSelect: "none" }} {...dragHandlers}>
      {/* The handle is a real button: the swipe is a shortcut, never the only
          way out. Tab reaches it, Enter/Space dismisses, and a screen reader
          announces it with the caller's own copy. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={props.dismissLabel}
        data-testid="stapel-sheet-handle"
        data-analytics="none"
        data-analytics-reason="local-ui-dismiss-sheet"
        style={{
          display: "block",
          width: 40,
          height: 4,
          margin: "0 auto",
          padding: 0,
          border: "none",
          borderRadius: 2,
          background: handleColor,
          cursor: "grab",
        }}
      />
      {props.title !== undefined && (
        <div style={{ marginTop: 12 }}>{props.title}</div>
      )}
    </div>
  );

  // `exactOptionalPropertyTypes`: an explicit `undefined` is not the same as
  // an absent key, so the transform is added only when there is one.
  //
  // Geometry goes on the WRAPPER (`.ant-drawer-content-wrapper`), which is the
  // one panel element antd 5 and antd 6 both name the same way. The inner
  // panel was renamed `content` → `section` in antd 6 and `styles.content` now
  // prints a deprecation warning, so styling it directly would mean either a
  // warning on every sheet (antd 6) or no rounded corners at all (antd 5).
  const wrapperStyle: CSSProperties = {
    // The sheet is as tall as its content, up to the cap below — a fixed
    // drawer height leaves a half-empty panel under a three-line confirm.
    height: "auto",
    // `dvh`, not `vh`: on mobile Safari `vh` is the tallest the viewport ever
    // gets, so a `90vh` sheet is taller than the visible page and its own
    // footer sits under the browser chrome.
    maxHeight: "90dvh",
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    // …so the square-cornered panel inside is actually clipped by them.
    overflow: "hidden",
    transition: dragging ? "none" : "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
    ...(dragY > 0 ? { transform: `translateY(${String(dragY)}px)` } : {}),
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      // `size`, not `height`: antd 6 deprecated `height` in favour of it and
      // warns on presence. A non-numeric string passes straight through to the
      // panel, which is how the sheet gets `height: auto`.
      size="auto"
      closable={false}
      title={header}
      destroyOnHidden={props.destroyOnHidden}
      {...(props.maskClosable !== undefined ? { maskClosable: props.maskClosable } : {})}
      {...(props.ariaLabel !== undefined ? { "aria-label": props.ariaLabel } : {})}
      {...(props.footer !== undefined ? { footer: props.footer } : {})}
      {...(props.className !== undefined ? { className: props.className } : {})}
      styles={{
        wrapper: wrapperStyle,
        body: {
          overflowY: "auto",
          // Flicking past the end of the sheet must not scroll the page behind
          // it, and on iOS must not chain into the browser's own pull gesture.
          overscrollBehavior: "contain",
          // A sheet is flush with the bottom edge, which on a notched phone is
          // the home indicator. Without this its last control is under it.
          paddingBottom: `calc(${String(bodyPadding)}px + env(safe-area-inset-bottom))`,
        },
      }}
    >
      {props.children}
    </Drawer>
  );
}
