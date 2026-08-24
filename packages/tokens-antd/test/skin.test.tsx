// @vitest-environment jsdom
/**
 * The design-system rule, tested where it is DECLARED.
 *
 * Every package's own suite asserts that its dialogs inherit this (each one
 * renders its default surface at phone width and looks for
 * `data-stapel-dialog-surface="sheet"`); this file is the one that pins what
 * the rule IS, and the behaviours a sheet has to have to be one.
 *
 * The viewport is mocked at the ENVIRONMENT edge — `window.innerWidth` plus a
 * `matchMedia` that actually evaluates the query against it — not by stubbing
 * `useDialogSurface`. A hand-stubbed hook would agree with whatever this file
 * believes the breakpoint is; driving the real `matchMedia` means the test
 * fails if the rule's query and `@stapel/tokens`' breakpoints ever disagree.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { SkinConfirm, SkinDialog, MODAL_MEDIA_QUERY } from "../src/skin.js";
import { breakpoints } from "@stapel/tokens";

configure({ asyncUtilTimeout: 10_000 });

type Listener = () => void;

const listeners = new Set<Listener>();

/** A `matchMedia` that answers `(min-width: Npx)` from the live
 * `window.innerWidth`, and notifies subscribers when the width changes —
 * which is what a real browser does on resize/rotation. */
function installMatchMedia(): void {
  window.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const matches = (): boolean =>
      min === null ? false : window.innerWidth >= Number(min[1]);
    return {
      get matches() {
        return matches();
      },
      media: query,
      onchange: null,
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  // Wrapped: the media-query listener is what `useSyncExternalStore`
  // subscribes with, so notifying it IS a React state update.
  act(() => {
    for (const l of [...listeners]) l();
  });
}

/** jsdom ships no `PointerEvent`, so `fireEvent.pointerDown(…, {clientY})`
 * would construct a bare `Event` with no coordinates — a gesture test that
 * exercises nothing. This is the browser's own class, minimally. */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}

beforeEach(() => {
  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
    window.PointerEvent = globalThis.PointerEvent;
  }
  installMatchMedia();
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  cleanup();
  listeners.clear();
});

const DISMISS = "close-dialog";

describe("the surface rule", () => {
  it("is a bottom sheet below the tablet breakpoint", () => {
    setViewport(390);
    render(
      <SkinDialog open onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(screen.getByText("body").closest("[data-stapel-dialog-surface]")).toHaveProperty(
      "dataset.stapelDialogSurface",
      "sheet"
    );
  });

  it("is a modal at the tablet breakpoint and above", () => {
    setViewport(breakpoints.tablet);
    render(
      <SkinDialog open onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(screen.getByText("body").closest("[data-stapel-dialog-surface]")).toHaveProperty(
      "dataset.stapelDialogSurface",
      "modal"
    );
  });

  it("names the breakpoint the tokens package does, not a second one", () => {
    expect(MODAL_MEDIA_QUERY).toBe(`(min-width: ${String(breakpoints.tablet)}px)`);
  });

  it("re-decides when the viewport crosses the breakpoint", () => {
    setViewport(1200);
    render(
      <SkinDialog open onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(
      screen.getByText("body").closest("[data-stapel-dialog-surface]")
    ).toHaveProperty("dataset.stapelDialogSurface", "modal");
    setViewport(390);
    expect(
      screen.getByText("body").closest("[data-stapel-dialog-surface]")
    ).toHaveProperty("dataset.stapelDialogSurface", "sheet");
  });

  it("picks the surface on the FIRST render, with no desktop frame first", () => {
    // The `useBreakpoint()` pattern this replaces returns `undefined` until an
    // effect has run, so a phone painted a centred desktop modal for one frame
    // and then swapped it. `useSyncExternalStore` reads synchronously, so the
    // very first committed DOM is already the sheet — asserted by rendering
    // with effects suppressed is not possible here, so instead: the first
    // queryable DOM after a synchronous render carries the sheet.
    setViewport(390);
    const { container } = render(
      <SkinDialog open onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(container.ownerDocument.querySelector(".ant-modal")).toBeNull();
  });
});

describe("what makes it a sheet and not a bottom drawer", () => {
  function renderSheet(onClose: () => void): void {
    setViewport(390);
    render(
      <SkinDialog open onClose={onClose} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
  }

  it("dismisses on a downward drag past the threshold", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const handle = screen.getByTestId("stapel-sheet-handle").parentElement as HTMLElement;
    fireEvent.pointerDown(handle, { clientY: 100, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 260, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back — and does NOT dismiss — on a drag that does not commit", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const handle = screen.getByTestId("stapel-sheet-handle").parentElement as HTMLElement;
    // 20px, below both the distance threshold and the flick floor: a twitch
    // during a tap on the header, which must not take the sheet away.
    fireEvent.pointerDown(handle, { clientY: 100, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 120, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
    const wrapper = document.querySelector(".ant-drawer-content-wrapper") as HTMLElement;
    expect(wrapper.style.transform).toBe("");
  });

  it("dismisses on a fast flick that never travels the full distance", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const handle = screen.getByTestId("stapel-sheet-handle").parentElement as HTMLElement;
    // 50px — under the 88px distance threshold, over the flick floor, and
    // covered in ~no time, which is what a flick is.
    fireEvent.pointerDown(handle, { clientY: 100, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 150, pointerId: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores an UPWARD drag rather than lifting the sheet off the edge", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const handle = screen.getByTestId("stapel-sheet-handle").parentElement as HTMLElement;
    fireEvent.pointerDown(handle, { clientY: 300, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 40, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("gives the gesture a keyboard equivalent: the handle is a named button", () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    // A swipe-only dismissal is unreachable without a pointer. The handle is a
    // real <button> with an accessible name, so Tab reaches it and Enter/Space
    // (which fire `click`) dismiss.
    const handle = screen.getByRole("button", { name: DISMISS });
    expect(handle.tagName).toBe("BUTTON");
    fireEvent.click(handle);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("contains its own scrolling and clears the home indicator", () => {
    renderSheet(() => undefined);
    const body = document.querySelector(".ant-drawer-body") as HTMLElement;
    expect(body.style.overscrollBehavior).toBe("contain");
    expect(body.style.paddingBottom).toContain("env(safe-area-inset-bottom)");
  });

  it("caps its height in dvh, not vh, and rounds its top corners", () => {
    // `vh` on mobile Safari is the TALLEST the viewport ever gets, so a 90vh
    // sheet is taller than the visible page and hides its own footer under the
    // browser chrome. The geometry sits on the wrapper, the one panel element
    // antd 5 and 6 agree on the name of (`styles.content` is deprecated in 6).
    renderSheet(() => undefined);
    const wrapper = document.querySelector(".ant-drawer-content-wrapper") as HTMLElement;
    expect(wrapper.style.maxHeight).toBe("90dvh");
    expect(wrapper.style.borderTopLeftRadius).not.toBe("");
    expect(wrapper.style.overflow).toBe("hidden");
    // NOT `height: auto`, and NOT a transition. antd's rule for the panel
    // inside this wrapper is `height: 100%` (zero inside an auto parent), and
    // rc-motion drives the open with a transform on this element and waits for
    // the transition to end. Overriding either one renders a sheet that mounts,
    // passes every assertion here, and draws nothing in a browser — jsdom
    // computes no layout, so it can neither collapse a box nor run a
    // transition, and cannot see this class of defect at all. The assertions
    // below are therefore about what this component must NOT set.
    expect(wrapper.style.height).not.toBe("auto");
    expect(wrapper.style.transition).toBe("");
  });

  it("translates the sheet with the finger while the drag is live", () => {
    renderSheet(() => undefined);
    const handle = screen.getByTestId("stapel-sheet-handle").parentElement as HTMLElement;
    fireEvent.pointerDown(handle, { clientY: 100, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 140, pointerId: 1 });
    const wrapper = document.querySelector(".ant-drawer-content-wrapper") as HTMLElement;
    expect(wrapper.style.transform).toBe("translateY(40px)");
    // …and no transition while the finger is down, or the panel lags behind it.
    // (The transition exists ONLY while a drag is live — see the note above.)
    expect(wrapper.style.transition).toBe("none");
  });
});

describe("the modal half", () => {
  it("names its close button with the caller's copy, not invented English", () => {
    setViewport(1200);
    render(
      <SkinDialog open onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(screen.getByRole("button", { name: DISMISS })).toBeDefined();
  });

  it("dismissible={false} draws no way out at all — not an inert one", () => {
    // A real shape (first-run setup that a guest cannot skip). Before this
    // prop existed the component had to keep drawing a close button and wire
    // it to nothing, which is a control that is visibly offered and silently
    // dead — worse than either answer.
    setViewport(1200);
    render(
      <SkinDialog open dismissible={false} onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(screen.queryByRole("button", { name: DISMISS })).toBeNull();
  });

  it("dismissible={false} removes the sheet's grab handle too", () => {
    setViewport(390);
    render(
      <SkinDialog open dismissible={false} onClose={() => undefined} dismissLabel={DISMISS} title="t">
        <p>body</p>
      </SkinDialog>
    );
    expect(screen.queryByTestId("stapel-sheet-handle")).toBeNull();
  });

  it("takes a forced surface for a host whose dialog is not viewport-sized", () => {
    setViewport(1200);
    render(
      <SkinDialog open surface="sheet" onClose={() => undefined} dismissLabel={DISMISS}>
        <p>body</p>
      </SkinDialog>
    );
    expect(
      screen.getByText("body").closest("[data-stapel-dialog-surface]")
    ).toHaveProperty("dataset.stapelDialogSurface", "sheet");
  });
});

describe("SkinConfirm — a question is a dialog, not an anchored popover", () => {
  it("is a bottom sheet on a phone, like every other dialog", () => {
    setViewport(390);
    render(
      <SkinConfirm
        open
        title="Remove this?"
        body="MacBook Touch ID"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => undefined}
        onCancel={() => undefined}
        data-testid="confirm"
      />
    );
    expect(screen.getByTestId("confirm").dataset["stapelDialogSurface"]).toBe("sheet");
  });

  it("answers with the confirm button and dismisses with the other one", () => {
    setViewport(1200);
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <SkinConfirm
        open
        title="Remove this?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    // Two buttons carry this label: the footer's, and the modal's close
    // button, which is named with the same copy on purpose — a person who
    // reads "Cancel" on the ✕ and on the button is told the same thing twice,
    // which is better than being told two different things.
    const cancels = screen.getAllByRole("button", { name: "Cancel" });
    expect(cancels).toHaveLength(2);
    fireEvent.click(cancels[cancels.length - 1] as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("stapel-confirm-ok"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("a destructive question cannot be answered by a tap beside it", () => {
    // On a phone the backdrop IS most of the screen, and this particular
    // dismissal deletes something permanently.
    setViewport(390);
    const onCancel = vi.fn();
    render(
      <SkinConfirm
        open
        danger
        title="Delete forever?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => undefined}
        onCancel={onCancel}
      />
    );
    const mask = document.querySelector(".ant-drawer-mask") as HTMLElement;
    fireEvent.click(mask);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("while confirming, neither answer can be given twice", () => {
    setViewport(1200);
    const onConfirm = vi.fn();
    render(
      <SkinConfirm
        open
        confirming
        title="Remove this?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />
    );
    fireEvent.click(screen.getByTestId("stapel-confirm-ok"));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
