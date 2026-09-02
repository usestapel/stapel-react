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
 * ── Why the disclosure is CONTROLLED: hover opened it, the click shut it ───
 *
 * An uncontrolled popover triggered by hover AND click treats the click as a
 * TOGGLE, so the natural pointer gesture — rest on the control, then press it
 * — opens the disclosure on the hover and closes it again on the press. The
 * overlay comes back marked `ant-popover-hidden` and the person has pressed
 * the one control that was supposed to explain itself and watched it go
 * blank. Reproduced in jsdom and gated by `test/favoriteGesture.test.tsx`.
 *
 * It needs the DELAY to reproduce, which is the interesting part: antd opens
 * a hover popover after 0.1s, so two events fired back to back (a thumb's
 * emulated `mouseenter` + `click`) land while nothing is open yet and the
 * click opens it correctly. A cursor that lingers is past the delay, and its
 * click closes what the hover opened. The suite was green throughout because
 * every existing test fired `click` alone — a synthetic click carries no
 * hover in front of it, so it exercised the one ordering that worked.
 *
 * So `open` is this component's own state and activation is MONOTONIC: a
 * click may only open the disclosure, never close it. Hover-out, blur and a
 * click outside still close it, because those arrive as an `onOpenChange`
 * that no activation is claiming.
 *
 * Deliberately NOT exported from `src/default/index.ts`: it is how this
 * pair's own gated hearts speak, not a control a host composes with — the
 * same standing `favorite.tsx` has.
 */
import { useCallback, useId, useRef, useState } from "react";
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
  // Set in the capture phase of a click, i.e. BEFORE the popover's own
  // handler runs on the same event, and dropped once that event is fully
  // dispatched. While it is set, "close" is the tap's own toggle and is
  // refused; see the file header.
  const activating = useRef(false);

  const handleOpenChange = useCallback((next: boolean): void => {
    if (!next && activating.current) return;
    setOpen(next);
  }, []);

  const activate = useCallback((): void => {
    activating.current = true;
    setOpen(true);
    // A microtask runs after the whole event dispatch, so the flag covers
    // exactly this gesture and no later hover-out.
    queueMicrotask(() => {
      activating.current = false;
    });
  }, []);

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
          <Flex vertical gap={spacing[1]} data-testid={props.testId}>
            <Typography.Text>{props.reason}</Typography.Text>
            <SignInLink cta={props.cta} testId={props.signInTestId} />
          </Flex>
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
