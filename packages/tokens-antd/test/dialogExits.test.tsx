// @vitest-environment jsdom
/**
 * D474 — THE WAY OUT OF A DIALOG, AND THE PAGE THAT MOVES BEHIND IT.
 *
 * Reviewers walked a live classified at 390, 768, 1280 and 1440 in both
 * themes and read the filters dialog as unclosable:
 *
 *  - at 390 the bottom sheet has a 40x4 grab handle and a title, and NOTHING
 *    a person recognises as a close: the exits are Esc, a swipe, or applying
 *    the filter. The handle IS a button and carries the caller's copy, which
 *    is why every test in the fleet passed — an affordance no one can see is
 *    not an affordance;
 *  - at 768 the same dialog is a centred modal TALLER than the viewport, so
 *    its apply button is off the bottom edge, partly under the host's fixed
 *    dock — and scrolling towards it scrolls the FEED BEHIND the dialog.
 *
 * The page behind is the load-bearing half of that last one, and it is not
 * antd's fault in the usual sense: rc-util locks the page by writing
 * `html body { overflow-y: hidden }`, which reaches the VIEWPORT only while
 * the root element's own overflow is `visible`. A host that writes
 * `html { overflow-x: clip }` — the standard cure for a sideways-scrolling
 * phone page, and what this storefront writes — takes that propagation away,
 * and the lock becomes inert while every assertion about it stays true. So
 * the substrate locks the element the browser actually scrolls.
 *
 * These tests assert the OUTCOMES: a visible, hittable control that closes
 * the dialog; the scrolling element resolving to `overflow: hidden` while a
 * dialog is open UNDER the host rule that defeats antd's own lock, and back to
 * what it was after; and a modal whose body is a capped scroll port, so its
 * footer cannot be pushed off the screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { SHEET_CLOSE_HIT, SkinDialog } from "../src/skin.js";

const DISMISS = "Close the filters";

/** The storefront's own rule, and the reason antd's body lock does nothing
 * there: with the root's overflow no longer `visible`, the viewport takes its
 * overflow from the ROOT and body's value is never propagated. */
const HOST_ROOT_RULE = "html{max-width:100%;overflow-x:clip}";

let hostSheet: HTMLStyleElement | null = null;

beforeEach(() => {
  hostSheet = document.createElement("style");
  hostSheet.textContent = HOST_ROOT_RULE;
  document.head.append(hostSheet);
});

afterEach(() => {
  cleanup();
  hostSheet?.remove();
  hostSheet = null;
});

function Dialog(props: {
  readonly surface: "sheet" | "modal";
  readonly open?: boolean;
  readonly onClose?: () => void;
  readonly dismissible?: boolean;
}): ReactElement {
  return (
    <SkinDialog
      open={props.open ?? true}
      onClose={props.onClose ?? (() => undefined)}
      surface={props.surface}
      title="Filters"
      dismissLabel={DISMISS}
      data-testid="dlg"
      {...(props.dismissible !== undefined ? { dismissible: props.dismissible } : {})}
      footer={<button data-testid="apply">Show results</button>}
    >
      <div style={{ blockSize: 3000 }}>a very long filter panel</div>
    </SkinDialog>
  );
}

describe("a sheet has a close control a person can see and hit", () => {
  it("draws one, names it with the caller's copy, and closes on a press", () => {
    const onClose = vi.fn();
    render(<Dialog surface="sheet" onClose={onClose} />);
    const close = screen.getByTestId("stapel-sheet-close");
    // Not the grab handle wearing a different id: the handle is a 4px bar and
    // this is the control that reads as a way out.
    expect(close).not.toBe(screen.getByTestId("stapel-sheet-handle"));
    expect(close.tagName).toBe("BUTTON");
    expect(close.getAttribute("aria-label")).toBe(DISMISS);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives it a thumb-sized box, not a hairline", () => {
    render(<Dialog surface="sheet" />);
    const close = screen.getByTestId("stapel-sheet-close");
    const box = getComputedStyle(close);
    // The phone touch floor the rest of the substrate raises controls to. The
    // handle measures 40x4, which is what made the existing exit invisible.
    expect(Number.parseInt(box.inlineSize || box.width, 10)).toBeGreaterThanOrEqual(
      SHEET_CLOSE_HIT
    );
    expect(Number.parseInt(box.blockSize || box.height, 10)).toBeGreaterThanOrEqual(
      SHEET_CLOSE_HIT
    );
  });

  it("draws NO close on a sheet that may not be dismissed", () => {
    // `dismissible={false}` is a real shape (a blocking first-run setup), and
    // a visible control that does nothing is worse than no control.
    render(<Dialog surface="sheet" dismissible={false} />);
    expect(screen.queryByTestId("stapel-sheet-close")).toBeNull();
  });

  it("keeps the modal's own close — one exit per surface, never two", () => {
    render(<Dialog surface="modal" />);
    expect(screen.queryByTestId("stapel-sheet-close")).toBeNull();
    expect(document.querySelector(".ant-modal-close")).not.toBeNull();
  });
});

describe("the page behind a dialog does not move", () => {
  /** What the browser scrolls: the root element, whose overflow the viewport
   * takes whenever it is not `visible`. */
  function rootOverflow(): string {
    const style = getComputedStyle(document.documentElement);
    return style.overflowY === "" ? style.overflow : style.overflowY;
  }

  it("locks the SCROLLING element while a modal is open, under the host rule", () => {
    // Before: the host's own rule is all there is, and the page scrolls.
    expect(rootOverflow()).not.toBe("hidden");
    const view = render(<Dialog surface="modal" />);
    expect(rootOverflow()).toBe("hidden");
    // antd's own lock is on `body` and is inert here — this is the fact that
    // makes the assertion above about the page and not about a second opinion.
    view.unmount();
    expect(rootOverflow()).not.toBe("hidden");
  });

  it("locks it for a sheet too", () => {
    const view = render(<Dialog surface="sheet" />);
    expect(rootOverflow()).toBe("hidden");
    view.unmount();
    expect(rootOverflow()).not.toBe("hidden");
  });

  it("gives the page back exactly the overflow the host had written", () => {
    document.documentElement.style.overflow = "auto";
    const view = render(<Dialog surface="modal" />);
    expect(document.documentElement.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.documentElement.style.overflow).toBe("auto");
    document.documentElement.style.removeProperty("overflow");
  });

  it("keeps the lock while a SECOND dialog opens and closes over the first", () => {
    // A picker sheet opens from inside the filters sheet, and closing the
    // inner one must not hand the page back while the outer one is standing.
    const outer = render(<Dialog surface="sheet" />);
    const inner = render(<Dialog surface="sheet" />);
    inner.unmount();
    expect(rootOverflow()).toBe("hidden");
    outer.unmount();
    expect(rootOverflow()).not.toBe("hidden");
  });

  it("unlocks when the dialog closes without unmounting", () => {
    const view = render(<Dialog surface="modal" open />);
    expect(rootOverflow()).toBe("hidden");
    view.rerender(<Dialog surface="modal" open={false} />);
    expect(rootOverflow()).not.toBe("hidden");
  });
});

describe("a dialog taller than the screen scrolls INSIDE itself", () => {
  it("caps the modal's body against the viewport and scrolls it there", () => {
    render(<Dialog surface="modal" />);
    const body = document.querySelector<HTMLElement>(".ant-modal-body");
    expect(body, "the modal has no body").not.toBeNull();
    const style = (body as HTMLElement).style;
    // Viewport-relative, so the panel cannot grow past the screen and take its
    // own footer with it — `dvh`, not `vh`, for a phone browser's live chrome.
    expect(style.maxHeight).toContain("dvh");
    expect(style.maxHeight).toContain("calc");
    expect(style.overflowY).toBe("auto");
    // …and the scroll stops at its own end rather than chaining into the page.
    expect(style.overscrollBehavior).toBe("contain");
  });

  it("keeps the apply footer OUT of the scroll port, in both surfaces", () => {
    // Measured in the rendered tree: the footer is a SIBLING after the scroll
    // port, never a bar painted over it — so the last row of a long panel can
    // always be scrolled clear of it. The bottom padding is what keeps that
    // last row off the footer's hairline.
    for (const [surface, bodyClass, footerClass] of [
      ["sheet", ".ant-drawer-body", ".ant-drawer-footer"],
      ["modal", ".ant-modal-body", ".ant-modal-footer"],
    ] as const) {
      const view = render(<Dialog surface={surface} />);
      const body = document.querySelector<HTMLElement>(bodyClass);
      const footer = document.querySelector<HTMLElement>(footerClass);
      expect(body, `${surface}: no scroll port`).not.toBeNull();
      expect(footer, `${surface}: no footer`).not.toBeNull();
      expect(body?.contains(footer as Node)).toBe(false);
      expect(
        (body as HTMLElement).compareDocumentPosition(footer as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect((body as HTMLElement).style.paddingBottom).not.toBe("");
      view.unmount();
    }
  });
});
