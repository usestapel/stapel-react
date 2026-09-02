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
 * Deliberately NOT exported from `src/default/index.ts`: it is how this
 * pair's own gated hearts speak, not a control a host composes with — the
 * same standing `favorite.tsx` has.
 */
import { useId } from "react";
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
            events still arrive: hover, focus and click all bubble. */}
        <div>{props.children({ "aria-describedby": reasonId })}</div>
      </Popover>
    </>
  );
}
