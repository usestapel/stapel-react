/**
 * `GateReasonPopover` — a blocked control's reason and its sign-in door,
 * disclosed on interaction instead of standing in the layout.
 *
 * ── Why this exists next to a house rule that bans hovers ──────────────────
 *
 * `stapel/no-tooltip-in-skin` bans tooltips for two failure modes: hover-only
 * text that a touch device never shows, and text anchored to a disabled antd
 * button — which swallows the very pointer events the tooltip listens for.
 * Both were about the reason becoming UNREACHABLE. This component is built so
 * that neither can happen, which is the whole argument for the exception:
 *
 *  - it opens on click/tap as well as hover and focus, so a thumb has a
 *    gesture where a cursor has a hover;
 *  - the anchor is NEVER an html-disabled control. The caller renders it
 *    `aria-disabled` and keeps it focusable and pointer-live (its action is
 *    already refused by the gate, so the click is a safe no-op), which is
 *    what lets focus and click open the disclosure at all;
 *  - the reason never leaves the accessibility tree: a visually-hidden copy
 *    stays in the DOM, wired to the control via `aria-describedby`, so
 *    assistive tech reads the refusal with the control's name whether or not
 *    a pointer ever arrives.
 *
 * What moved on interaction is only the VISUAL standing copy — the measured
 * defect it answers is 24 copies of "sign in to do this" per catalogue
 * screen (see `ListingCardBlockedReason`). The rule's disables below are the
 * documented decision §2.4 asks for, not a hole.
 *
 * ── Why the disclosure is CONTROLLED, and why activation PINS it ──────────
 *
 * An uncontrolled popover triggered by hover AND click treats the click as a
 * TOGGLE, so the natural pointer gesture — rest on the control, then press it
 * — opens the disclosure on the hover and closes it again on the press. The
 * overlay comes back marked `ant-popover-hidden` and the person has pressed
 * the one control that was supposed to explain itself and watched it go
 * blank. Reproduced in jsdom and gated by `test/favoriteGesture.test.tsx`.
 *
 * So `open` is this component's own state. The first version of that made
 * activation MONOTONIC for the duration of the click's own dispatch — a flag
 * set in the capture phase and dropped a microtask later — and it closed the
 * toggle, which was the half of the problem a synthetic click can show.
 *
 * It was not the half a THUMB meets, and the deployed measurement (walker
 * D72, pass 7, the whole timeline in `logs-fp8/fp8-d72-diag3.json`) is
 * unambiguous about which half that is. A real tap DOES open this: the
 * overlay loses `ant-popover-hidden` 7 ms after `click`. Then the emulated
 * hover the tap carried ENDS — a finger that has lifted is hovering nothing —
 * `mouseleave` arrives ~10 ms later, antd's `mouseLeaveDelay` runs its 0.1 s,
 * the leave motion runs, and the overlay is hidden again ~260 ms after it
 * appeared. A quarter-second flash on a phone is indistinguishable from a
 * control that did nothing, which is exactly how six passes read it. The
 * microtask flag could not see this: the closer is not the click's toggle,
 * it is a TIMER two hundred milliseconds behind the gesture.
 *
 * A disclosure that a person deliberately opened therefore PINS: once
 * activated it stays open until it is dismissed, and hover-out, blur and the
 * trigger's own toggle may no longer close it. Dismissal is the two gestures
 * that mean "I am done reading" — a pointer down outside the control and
 * outside the overlay, or `Escape` — and this component listens for both
 * itself, because refusing antd's close is what takes them away.
 *
 * Hover keeps its old, unpinned behaviour: a cursor that rests on the control
 * opens it and a cursor that leaves closes it, with no click involved.
 *
 * Deliberately NOT exported from `src/default/index.ts`: it is how this
 * pair's own gated hearts speak, not a control a host composes with — the
 * same standing `favorite.tsx` has.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Flex, Typography } from "antd";
// eslint-disable-next-line stapel/no-tooltip-in-skin -- interaction disclosure, not a hover: opens on click/tap and focus too, anchored to a non-disabled control, with the reason kept in the a11y tree via aria-describedby (see this file's header)
import { Popover } from "antd";
import { visuallyHidden } from "@stapel/tokens-antd/skin";
import type { SignInCta } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { SignInLink } from "./SignInLink.js";

/** What the render prop hands the anchor control: point the control's
 * `aria-describedby` at the hidden copy of the reason. */
export interface GateReasonPopoverBinding {
  readonly "aria-describedby": string;
}

export interface GateReasonPopoverProps {
  /** The gate's reason, already localized (`useActionGate(...).reason`). */
  readonly reason: string;
  /** The container's sign-in door. Absent: the disclosure holds the reason
   * alone, exactly as the standing volumes do. */
  readonly cta: SignInCta | undefined;
  /** Test id of the disclosure's content. */
  readonly testId: string;
  /** Test id of the door inside it — each surface names its own, so a screen
   * holding both a card and the pane hands a test one element per name. */
  readonly signInTestId: string;
  /** The anchor control. Spread the binding onto it, render it
   * `aria-disabled` (not `disabled`) so it stays focusable and pointer-live. */
  readonly children: (binding: GateReasonPopoverBinding) => ReactNode;
}

export function GateReasonPopover(props: GateReasonPopoverProps): ReactElement {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  // Set by an ACTIVATION and cleared only by a dismissal. While it is set,
  // every close antd asks for — the click's own toggle, the hover-out timer,
  // a blur — is refused; see the file header.
  const pinned = useRef(false);
  // The two regions a dismissing gesture must NOT land in: the control itself
  // (pressing it again restates the refusal) and the overlay (the sign-in
  // door lives in there, and closing on its own pointerdown would take the
  // link away before the click that follows it).
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const dismiss = useCallback((): void => {
    pinned.current = false;
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next && pinned.current) return;
    setOpen(next);
  }, []);

  const activate = useCallback((): void => {
    pinned.current = true;
    setOpen(true);
  }, []);

  // Antd closes an unpinned popover on an outside click of its own; a pinned
  // one has to be given those gestures back, or it would be a panel with no
  // way out on the one device that most needs the pin.
  useEffect(() => {
    if (!open) return undefined;
    const doc = anchorRef.current?.ownerDocument ?? document;
    const outside = (target: EventTarget | null): boolean =>
      target instanceof Node &&
      anchorRef.current?.contains(target) !== true &&
      overlayRef.current?.contains(target) !== true;
    const onPointerDown = (event: Event): void => {
      if (outside(event.target)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") dismiss();
    };
    // Capture, so a handler that stops propagation on its own container
    // cannot leave this stuck open.
    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("keydown", onKeyDown, true);
    return () => {
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, dismiss]);

  return (
    <>
      {/* The floor: the reason reaches AT without a pointer, popover or no
          popover. Off-screen, never `display:none` — hidden text is not
          announced at all. */}
      <span id={reasonId} style={visuallyHidden}>
        {props.reason}
      </span>
      {/* eslint-disable-next-line stapel/no-tooltip-in-skin -- interaction disclosure, not a hover: click/tap and focus open it too, and the reason stays in the a11y tree (header) */}
      <Popover
        trigger={["hover", "focus", "click"]}
        open={open}
        onOpenChange={handleOpenChange}
        content={
          <div ref={overlayRef}>
            <Flex vertical gap={spacing[1]} data-testid={props.testId}>
              <Typography.Text>{props.reason}</Typography.Text>
              <SignInLink cta={props.cta} testId={props.signInTestId} />
            </Flex>
          </div>
        }
      >
        {/* A plain wrapper takes the props Popover clones onto its direct
            child — its open/close listeners and its own aria plumbing, which
            OVERWRITES that child's `aria-describedby` in both states. With
            the wrapper in between, the control keeps its own wiring to the
            hidden copy whether the disclosure is open or closed, and the
            events still arrive: hover, focus and click all bubble.

            The two capture listeners are the tap's half of the fix. `click`
            covers a mouse and a thumb; `keydown` covers Enter and Space,
            which a browser does NOT turn into a click on a button carrying
            `aria-disabled` in every engine. Capture, so they run before the
            popover's own toggle sees the same event. */}
        <div
          ref={anchorRef}
          onClickCapture={activate}
          onKeyDownCapture={(event) => {
            if (event.key === "Enter" || event.key === " ") activate();
          }}
        >
          {props.children({ "aria-describedby": reasonId })}
        </div>
      </Popover>
    </>
  );
}
