/**
 * `SkinDialog` — the ONE dialog surface every default skin renders through
 * (re-exported by `@stapel/tokens-antd/skin`).
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
 *  - **a visible, keyboard-reachable way out** — a ✕ at the phone touch floor
 *    on the trailing edge of the title line, carrying the caller's own dismiss
 *    copy, so the dismissal is never gesture-only (Esc also closes, via antd).
 *    The grab handle presses it too but is presentational: it is 4px tall, and
 *    a reviewer walking a live sheet read it as decoration and the sheet as
 *    unclosable (D474);
 *  - **safe-area insets** — a sheet sits ON the home indicator otherwise;
 *  - **scroll containment** — `overscroll-behavior: contain`, so flicking
 *    past the end of the sheet's own content does not scroll the page under
 *    it (and, on iOS, does not drag the sheet's own dismissal gesture);
 *  - **focus management** — antd traps focus inside the panel and restores it
 *    to the opener on close; the sheet keeps that and adds the accessible
 *    name (`aria-label`) a header-less sheet would otherwise not have.
 *
 * ## A dialog is themed where it is PAINTED, not where it is written
 *
 * A dialog PORTALS to `<body>`. React context still flows down the element
 * tree, so the panel is themed by whatever `ConfigProvider` stands above the
 * `<SkinDialog>` ELEMENT — which is next to the trigger that opens it, not
 * inside the screen's painted panel. A pair that wrapped its screen in
 * `SkinTheme` but declared the dialog outside that wrapper (or that leaned on
 * the document's `data-theme` alone, which antd cannot see) shipped a dialog
 * on antd's default LIGHT algorithm over a dark app. The visual pass found it
 * in calendar, docs and chat; the reading it produced first — "three sheet
 * implementations, one of them theme-aware" — was wrong, all three already
 * rendered through this component. Only the wrapper differed, and a rule that
 * every caller has to remember is not a rule.
 *
 * So the surface themes itself: {@link SkinDialog} renders its own
 * `SkinTheme surface="bare"` around the antd component (so the PANEL, its
 * header and its footer are on the right algorithm, not just the body) and a
 * second one inside the portal (so the painted content carries
 * `data-stapel-skin-mode` where a test can see it). The mode comes from the
 * nearest enclosing `SkinTheme` at the declaration site, and from the live
 * document mode when there is none — the same order `SkinTheme` itself uses.
 *
 * A caller that already wraps its dialog keeps working and pays nothing:
 * `AppliedThemeContext` makes a nested `SkinTheme` with the same answer a
 * plain `<div>` and no second provider. The outer wrapper is `display:
 * contents`, so it adds no box to the declaring layout — an empty flex child
 * would otherwise open a gap in the row the trigger sits in.
 *
 * This is why there is no `stapel/dialog-needs-theme` lint rule: a rule would
 * only tell the twelfth pair to write the wrapper the substrate now writes for
 * it, and it could not see the case that actually broke — a `SkinTheme` that
 * IS in the file but does not enclose the dialog element.
 *
 * The viewport rule itself (`useDialogSurface`, `MODAL_MEDIA_QUERY`) lives in
 * `./dialogSurface.js`, because `SkinTheme` reads it too and two modules that
 * import each other are a cycle.
 */
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from "react";
import { ConfigProvider, Drawer, Modal, theme as antdTheme } from "antd";
import { isDevBuild } from "@stapel/core";
import { useDialogSurface } from "./dialogSurface.js";
import { lockPageScroll } from "./pageScroll.js";
import type { DialogSurface } from "./dialogSurface.js";
import { reportContractViolation, useSkinComponents } from "./components.js";
import { SkinTheme } from "./theme.js";

export { MODAL_MEDIA_QUERY, useDialogSurface } from "./dialogSurface.js";
export type { DialogSurface } from "./dialogSurface.js";

/**
 * The wrapper that carries the theme to the portal without adding a box to
 * the tree the dialog is DECLARED in: the antd component renders nothing
 * where it stands, so this element must not either.
 */
const CONTENTS_STYLE: CSSProperties = { display: "contents" };

/** The tallest a sheet gets: the rest of the page must stay visible behind it. */
export const SHEET_MAX_HEIGHT: string = "90dvh";

/**
 * The sheet's close button, edge to edge (D474).
 *
 * 44px is the phone touch floor `SkinTheme` raises every control to, and the
 * number is here because the control it describes is the one a reviewer could
 * not find: the grab handle is 40x4, which is a drag affordance and reads as
 * decoration. A sheet's exits were Esc, a swipe and the apply button.
 */
export const SHEET_CLOSE_HIT = 44;

/** The close control's handle, so the drag gesture can tell a press on it from
 * a press on the header it lives in. */
const SHEET_CLOSE_TESTID = "stapel-sheet-close";

/**
 * THE ROOM A MODAL LEAVES AROUND ITSELF, and why the body is capped at all.
 *
 * Measured on a live stand at 768: the filters dialog was a centred modal
 * TALLER than the viewport, so its own footer — the apply button — stood below
 * the bottom edge of the screen, partly under the host's fixed dock, and the
 * only way towards it scrolled the page behind the dialog.
 *
 * antd puts the panel at `top: 100px` with a `padding-bottom: 24px` of its
 * own and caps nothing: a modal is as tall as what is in it. So the BODY (the
 * one part that can be long) becomes a scroll port measured against the
 * viewport, and the header, the close and the footer keep their boxes — which
 * is the same arrangement `sheetSizingCss` gives the sheet.
 *
 * The allowance is deliberately generous rather than exact: it covers antd's
 * own offset plus a header and a footer, and being a few pixels short of the
 * screen costs nothing, while being over it is the defect. `dvh`, not `vh`,
 * for the same reason the sheet uses it — on mobile Safari `vh` is the
 * tallest the viewport ever gets, so a `vh` cap hides its own footer under the
 * browser chrome.
 */
export const MODAL_VIEWPORT_ALLOWANCE = 220;

/** The modal body's cap: the viewport, minus the room antd's own geometry and
 * the dialog's chrome take. See {@link MODAL_VIEWPORT_ALLOWANCE}. */
export const MODAL_BODY_MAX_HEIGHT: string = `calc(100dvh - ${String(MODAL_VIEWPORT_ALLOWANCE)}px)`;

/** The class the sheet's panel wrapper carries, for {@link sheetSizingCss}. */
export const SHEET_WRAPPER_CLASS: string = "stapel-sheet-wrapper";

/** The `href` the hoisted sheet stylesheet is deduplicated by. */
export const SHEET_STYLE_HREF: string = "stapel-skin-sheet-sizing";

/**
 * A sheet is as tall as its content, up to {@link SHEET_MAX_HEIGHT}; past
 * that its BODY scrolls while the header and the footer stay put.
 *
 * antd's bottom drawer is a fixed 378px (`height` prop) — the "~45% of the
 * viewport" the visual pass measured (VC-B5) — and everything past it was
 * reachable only by scrolling a body nothing marked as scrollable, with the
 * primary action below the fold in five packages. `height: auto` on the
 * wrapper alone is not enough: antd's panel inside it is `height: 100%`,
 * and 100% of an auto parent is nothing (jsdom cannot see this; a browser
 * can). So the wrapper becomes a flex column, the panel a shrinkable item
 * capped at the same maximum, and antd's own body rule (`flex: 1; min-height:
 * 0; overflow: auto`) does the scrolling. `!important` beats the inline
 * `height` rc-drawer writes; `transition`/`transform` are left to rc-motion.
 */
export function sheetSizingCss(prefix: string): string {
  const wrapper = `.${SHEET_WRAPPER_CLASS}`;
  const panel = `${wrapper} > .${prefix}-drawer-section, ${wrapper} > .${prefix}-drawer-content`;
  return [
    `${wrapper}{height:auto !important;max-height:${SHEET_MAX_HEIGHT};display:flex;flex-direction:column}`,
    `${panel}{height:auto;max-height:${SHEET_MAX_HEIGHT};flex:0 1 auto;min-height:0}`,
    `${wrapper} .${prefix}-drawer-footer{flex-shrink:0}`,
  ].join("\n");
}

/** The sheet's title line: the caller's heading, and the close on the trailing
 * edge of it. */
const SHEET_TITLE_ROW: CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

/** The heading itself — it shrinks rather than pushing the close off the row. */
const SHEET_TITLE_BOX: CSSProperties = { flex: "1 1 auto", minInlineSize: 0 };

/** The close control's own box: a thumb-sized target with a 16px glyph in it,
 * and no chrome of its own — see {@link SHEET_CLOSE_HIT}. */
const SHEET_CLOSE: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  inlineSize: SHEET_CLOSE_HIT,
  blockSize: SHEET_CLOSE_HIT,
  marginInlineEnd: -8,
  padding: 0,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  cursor: "pointer",
};

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
   * Default `true`. `false` draws NO dismissal affordance at all — no close
   * button on the modal, no grab handle on the sheet — and stops Esc and the
   * mask from closing it.
   *
   * This exists because a dialog that cannot be dismissed is a real shape and
   * the fleet has one: `profiles-react`'s first-run setup in blocking mode,
   * where a guest genuinely cannot proceed nameless. Without the prop, that
   * component had to keep drawing a ✕ and wire `onClose` to do nothing — a
   * control that is visibly offered and silently inert, which is worse than
   * either answer. It is NOT a general escape hatch: a dialog with no way out
   * is a trap unless its body itself contains the only two exits.
   */
  readonly dismissible?: boolean;
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
  // Spacing only, and read at the declaration site on purpose: the body's end
  // padding is the same measure the sheet's body uses, and a length does not
  // change with the light/dark algorithm the portal is painted under.
  const { token } = antdTheme.useToken();
  const surface = props.surface ?? auto;
  const Override = useSkinComponents().Dialog;
  const {
    open,
    onClose,
    title,
    ariaLabel,
    dismissLabel,
    children,
    footer,
    destroyOnHidden = true,
    dismissible = true,
  } = props;
  // Dev contract check for an overridden surface: once it is open, the
  // stamped body must be in the document (the replacement rendered its
  // children) and inside an element with a dialog role. Checked on a delay so
  // a replacement's mount animation is not a false report; dev builds only.
  const stampRef = useRef<HTMLDivElement>(null);
  // The page behind stays where it is for as long as this dialog is open —
  // see `lockPageScroll`. Every surface, including a registered replacement:
  // a host's own dialog anatomy does not change what the page under it does.
  useEffect(() => {
    if (!open) return undefined;
    return lockPageScroll();
  }, [open]);
  useEffect(() => {
    if (Override === undefined || !open || !isDevBuild()) return undefined;
    const id = setTimeout(() => {
      const stamp = stampRef.current;
      if (stamp === null || !stamp.isConnected) {
        reportContractViolation(
          "Dialog",
          Override,
          "it must render its children (the dialog body) whenever `open` is true"
        );
        return;
      }
      if (stamp.closest('[role="dialog"], [role="alertdialog"]') === null) {
        reportContractViolation(
          "Dialog",
          Override,
          'the body must sit inside an element with role="dialog" and an accessible name (from `title` or `ariaLabel`)'
        );
      }
    }, 250);
    return () => clearTimeout(id);
  }, [Override, open]);

  // The inner half of the theming: inside the portal, where the content is
  // actually painted. Under the outer `SkinTheme` this is a plain `<div>` —
  // same mode, same phone answer, so `AppliedThemeContext` renders no second
  // provider — and it stamps `data-stapel-skin-mode` on the panel's content so
  // a test can prove which side the PORTAL is on, not which side the file is.
  const body = (
    <SkinTheme surface="bare" style={CONTENTS_STYLE}>
      <div
        ref={stampRef}
        data-stapel-dialog-surface={surface}
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      >
        {children}
      </div>
    </SkinTheme>
  );

  // A registered Dialog slot replaces the SURFACE (the chrome antd draws),
  // never what stands around it: the substrate still resolves `surface` from
  // the viewport, still themes both halves, and still stamps the body — so a
  // pair's `data-stapel-dialog-surface` assertions hold under any host's
  // anatomy. Contract: `SkinDialogSlotProps` in ./components.tsx.
  const dialog =
    Override !== undefined ? (
      <Override
        open={open}
        onClose={onClose}
        surface={surface}
        dismissLabel={dismissLabel}
        dismissible={dismissible}
        destroyOnHidden={destroyOnHidden}
        {...(title !== undefined ? { title } : {})}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
        {...(footer !== undefined ? { footer } : {})}
        {...(props.width !== undefined ? { width: props.width } : {})}
        {...(props.maskClosable !== undefined ? { maskClosable: props.maskClosable } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
      >
        {body}
      </Override>
    ) : surface === "modal" ? (
      <Modal
        open={open}
        onCancel={onClose}
        destroyOnHidden={destroyOnHidden}
        footer={footer ?? null}
        closable={dismissible ? { "aria-label": dismissLabel } : false}
        keyboard={dismissible}
        /* The panel cannot outgrow the screen and take its footer with it:
           the body is the part that is long, so the body is the scroll port,
           capped against the viewport — see `MODAL_BODY_MAX_HEIGHT`. Inline,
           not a rule, because there is nothing for it to win against and
           nothing that may quietly win over it. `contain` keeps a flick at
           the end of the list out of the page behind, the way the sheet's
           body already does. */
        styles={{
          body: {
            maxHeight: MODAL_BODY_MAX_HEIGHT,
            overflowY: "auto",
            overscrollBehavior: "contain",
            // The scroll port ends ABOVE the footer rather than against it:
            // scrolled to the end, the last row of a long panel used to sit
            // flush on the apply bar's hairline and read as cut in half.
            paddingBottom: token.paddingLG,
          },
        }}
        {...(dismissible ? {} : { maskClosable: false })}
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
    ) : (
      <BottomSheet
        open={open}
        onClose={onClose}
        dismissLabel={dismissLabel}
        dismissible={dismissible}
        destroyOnHidden={destroyOnHidden}
        {...(props.maskClosable !== undefined ? { maskClosable: props.maskClosable } : {})}
        {...(title !== undefined ? { title } : {})}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
        {...(footer !== undefined ? { footer } : {})}
        {...(props.className !== undefined ? { className: props.className } : {})}
      >
        {body}
      </BottomSheet>
    );

  // The outer half: above the antd component itself, so the PANEL — its
  // background, its header, its close button, its footer — is on the same
  // algorithm as the content, and not just the body inside it. `display:
  // contents` because the dialog renders nothing where it is declared, so
  // neither may its theme wrapper.
  return (
    <SkinTheme surface="bare" style={CONTENTS_STYLE}>
      {dialog}
    </SkinTheme>
  );
}

interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly dismissLabel: string;
  readonly dismissible: boolean;
  readonly destroyOnHidden: boolean;
  readonly maskClosable?: boolean;
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
  const { open, onClose, dismissible } = props;
  // Read INSIDE the sheet, not in `SkinDialog`: the token the grab handle is
  // painted with has to come from the provider the sheet is rendered under
  // (the one `SkinDialog` puts above it), not from whatever theme happened to
  // stand where the dialog was written. A light `colorFillSecondary` handle on
  // a dark sheet is the same defect as a light panel, one element smaller.
  const { token } = antdTheme.useToken();
  const radius = token.borderRadiusLG;
  const handleColor = token.colorFillSecondary;
  const bodyPadding = token.paddingLG;
  const { getPrefixCls } = useContext(ConfigProvider.ConfigContext);
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
    // Not on the close: the drag captures the pointer, and a captured pointer
    // delivers its `click` to the capturing element — a press on the ✕ would
    // travel zero pixels, commit nothing, and never reach the button.
    if (
      event.target instanceof Element &&
      event.target.closest(`[data-testid="${SHEET_CLOSE_TESTID}"]`) !== null
    ) {
      return;
    }
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

  const closeColor = token.colorIcon;

  const header = (
    <div
      style={dismissible ? { ...grabArea, userSelect: "none" } : { userSelect: "none" }}
      {...(dismissible ? dragHandlers : {})}
    >
      {/* The handle is where the swipe starts, and pressing it dismisses too —
          but it is PRESENTATIONAL since D474: the sheet's named exit is the ✕
          below, and two controls carrying one name announce the same dismissal
          twice to a screen reader and make "the close button" ambiguous to
          every test that asks for it. A non-dismissible sheet draws no handle
          at all rather than an inert one — an affordance that is visibly
          offered and does nothing is worse than its absence. */}
      {dismissible && (
      <button
        type="button"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
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
      )}
      {/* THE VISIBLE WAY OUT (D474). The handle above is 4px tall and reads as
          decoration: reviewers walking a live sheet at 390 reported it had no
          close control at all, and the exits were Esc, a swipe, or applying
          the filter. The modal surface has drawn antd's ✕ since the first
          release; this is the sheet's own, at the phone touch floor, on the
          trailing edge of the title line where a reader looks for it.

          The row is drawn whenever there is a title OR a close, so a
          chrome-less sheet is not given an empty band. */}
      {(props.title !== undefined || dismissible) && (
        <div style={SHEET_TITLE_ROW}>
          <div style={SHEET_TITLE_BOX}>{props.title}</div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label={props.dismissLabel}
              data-testid={SHEET_CLOSE_TESTID}
              data-analytics="none"
              data-analytics-reason="local-ui-dismiss-sheet"
              style={{ ...SHEET_CLOSE, color: closeColor }}
            >
              {/* Drawn here: this package ships no icon set, and pulling one
                  in for two strokes would put an icon font in every skin. */}
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3 3 L13 13 M13 3 L3 13"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>
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
  // ── Two things this style must NOT do, both learned in a browser ────────
  //
  // 1. NOT `height: auto`. antd's rule for the panel INSIDE this wrapper is
  //    `height: 100%`, and 100% of an auto-height parent is zero. The sheet
  //    mounted, the accessibility tree had a dialog in it, every jsdom
  //    assertion passed — and nothing was drawn, because jsdom computes no
  //    layout and therefore cannot collapse anything. The height stays antd's;
  //    the BODY scrolls inside it (see `styles.body`).
  //
  // 2. NOT a `transition` while the sheet is opening. rc-motion drives the
  //    open with a transform on this very element and watches for the
  //    transition to END; overriding the transition property left the panel
  //    parked in its "prepare" state — translated a full height BELOW the
  //    viewport — so the mask dimmed and the sheet itself was never seen. The
  //    drag styles are therefore applied ONLY while a drag is live, and antd
  //    owns this element the rest of the time.
  const dragActive = dragging || dragY > 0;
  const wrapperStyle: CSSProperties = {
    // `dvh`, not `vh`: on mobile Safari `vh` is the tallest the viewport ever
    // gets, so a `90vh` sheet is taller than the visible page and its own
    // footer sits under the browser chrome. The content-fit height itself is
    // in `sheetSizingCss` (a class rule can `!important` over rc-drawer's
    // inline height; an inline style here cannot).
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    // …so the square-cornered panel inside is actually clipped by them.
    overflow: "hidden",
    ...(dragActive
      ? {
          transform: `translateY(${String(dragY)}px)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
        }
      : {}),
  };

  return (
    <>
      <style href={SHEET_STYLE_HREF} precedence="default">
        {sheetSizingCss(getPrefixCls())}
      </style>
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      keyboard={dismissible}
      closable={false}
      title={header}
      classNames={{ wrapper: SHEET_WRAPPER_CLASS }}
      destroyOnHidden={props.destroyOnHidden}
      {...(dismissible
        ? props.maskClosable !== undefined
          ? { maskClosable: props.maskClosable }
          : {}
        : { maskClosable: false })}
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
    </>
  );
}
