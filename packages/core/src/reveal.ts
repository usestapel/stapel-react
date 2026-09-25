/**
 * TAKE THE PERSON TO THE FIELD — one mechanism for every form in the fleet.
 *
 * A refusal that only says "fill in the title" leaves the person to find the
 * title. Every submit that refuses a field should do the same four things,
 * in this order:
 *
 *  1. **Open what the field is folded inside** — a closed `<details>`, or a
 *     disclosure whose toggle names the field's container in `aria-controls`.
 *     Scrolling to a control inside a closed section scrolls to nothing.
 *  2. **Scroll it into the part of the screen nobody is covering.** A sticky
 *     header and a phone's bottom bar are `position: fixed | sticky` boxes
 *     over the scrollport; `scrollIntoView` does not know they exist, so a
 *     field "in view" can sit under either. The obstruction is MEASURED at
 *     the scrollport's two edges, not configured, so a host that grows a new
 *     bar needs no setting. The scroll is smooth unless the person asked for
 *     reduced motion, and is re-checked once it settles, because chrome that
 *     answers to scrolling may have moved while it ran.
 *  3. **Focus the control the person answers** — the input itself, or the
 *     first focusable control of a group (select, chips, radios, a picker's
 *     button). Focus never scrolls on its own (`preventScroll`), which would
 *     undo step 2. A searchable select on a touch screen is focused with its
 *     keyboard held back until the person touches it.
 *  4. **Say what is wrong** through a polite live region: the field's label
 *     and its error, so a screen reader hears the reason and not only a caret
 *     that moved.
 *
 * No design system: the skins pass a row or a control, and
 * `revealFirstInvalid` finds one by `aria-invalid` and a selector.
 * `useRevealOnRefusal` is the one React hook, for refusals that arrive from a
 * server.
 */
import { useEffect, useRef } from "react";

/** What can take the caret. Hidden and file inputs are skipped: a file
 * picker's real input is visually hidden and its button is the control. */
const FOCUSABLE =
  'input:not([type="hidden"]):not([type="file"]):not([disabled]),' +
  "textarea:not([disabled]),select:not([disabled]),button:not([disabled])," +
  '[href],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

/** What marks a field as refused. `aria-invalid` is the standard; the
 * `data-invalid` hook is for a control that cannot carry it. Skins append
 * their design system's own row marker (see `revealFirstInvalid`). */
export const INVALID_FIELD_SELECTOR: string =
  '[aria-invalid="true"],[data-invalid="true"]';

/** Breathing room between a revealed field and the nearest bar, in px. */
const GAP = 12;

export interface RevealFieldOptions {
  /** The box that must end up fully visible — the row carrying the label and
   * the error. Default: the field itself. */
  readonly frame?: Element | null;
  /** The control to focus. Default: the field if focusable, else its first
   * focusable descendant; the frame (made programmatically focusable) when
   * there is none. */
  readonly control?: Element | null;
  /** Text for the live region. Default: the frame's label and error text.
   * `false`: announce nothing. */
  readonly announce?: string | false;
  /** Scroll behaviour. Default `smooth`, `auto` under reduced motion. */
  readonly behavior?: ScrollBehavior;
}

export interface RevealResult {
  /** The element that holds focus after the reveal, if any took it. */
  readonly focused: Element | null;
  /** The text handed to the live region, or `null`. */
  readonly announced: string | null;
}

/** Visible insets at a scrollport's top and bottom edges, in px. */
export interface ObstructedInsets {
  readonly top: number;
  readonly bottom: number;
}

/** Rendered at all. `checkVisibility` where the engine has one (it also
 * answers "inside a closed `<details>`"); otherwise no ancestor is
 * `display: none` or `hidden` — an engine without layout (jsdom) is not a
 * reason to call every control invisible. */
function isVisible(element: Element): boolean {
  const check = (element as { checkVisibility?: () => boolean }).checkVisibility;
  if (typeof check === "function") return check.call(element);
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || getComputedStyle(node).display === "none") return false;
    if (node instanceof HTMLDetailsElement && !node.open && node !== element) {
      // Only the summary of a closed disclosure is drawn.
      const summary = node.querySelector(":scope > summary");
      if (summary === null || !summary.contains(element)) return false;
    }
  }
  return true;
}

/** Drawn, or folded inside a closed `<details>` that is itself drawn. */
function revealable(element: Element): boolean {
  if (isVisible(element)) return true;
  const folded = element.closest("details:not([open])");
  return folded !== null && isVisible(folded);
}

/** The first control of `root` a person can answer, or `null`. */
export function firstFocusableIn(root: Element): HTMLElement | null {
  if (root instanceof HTMLElement && root.matches(FOCUSABLE) && isVisible(root)) {
    return root;
  }
  for (const candidate of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    // A radio group: the checked one is the group's tab stop.
    if (candidate instanceof HTMLInputElement && candidate.type === "radio" && candidate.name) {
      const checked = root.querySelector<HTMLInputElement>(
        `input[type="radio"][name="${cssEscape(candidate.name)}"]:checked`
      );
      if (checked !== null && !checked.disabled) return checked;
    }
    if (isVisible(candidate)) return candidate;
  }
  return null;
}

function cssEscape(value: string): string {
  const escape = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS?.escape;
  return escape === undefined ? value.replace(/([^\w-])/g, "\\$1") : escape(value);
}

/** Open every disclosure `target` sits inside. Returns whether any toggle had
 * to be CLICKED (a framework re-render will follow). */
function expandAncestors(target: Element): boolean {
  let clicked = false;
  for (let node: Element | null = target; node !== null; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
    if (node.id !== "") {
      const toggle = document.querySelector<HTMLElement>(
        `[aria-controls="${cssEscape(node.id)}"][aria-expanded="false"]`
      );
      if (toggle !== null) {
        toggle.click();
        clicked = true;
      }
    }
  }
  return clicked;
}

function isScrollable(element: Element): boolean {
  const style = getComputedStyle(element);
  return (
    /(auto|scroll|overlay)/.test(style.overflowY) &&
    element.scrollHeight > element.clientHeight
  );
}

/** The nearest scrolling ancestor, or `null` for the document itself. */
function scrollParentOf(target: Element): HTMLElement | null {
  for (let node = target.parentElement; node !== null; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) return null;
    if (isScrollable(node)) return node;
  }
  return null;
}

interface Band {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

function viewportBand(): Band {
  const height = window.visualViewport?.height ?? window.innerHeight;
  const width = window.visualViewport?.width ?? window.innerWidth;
  return { top: 0, bottom: height, left: 0, right: width };
}

function bandOf(scroller: HTMLElement | null): Band {
  const view = viewportBand();
  if (scroller === null) return view;
  const rect = scroller.getBoundingClientRect();
  return {
    top: Math.max(rect.top, view.top),
    bottom: Math.min(rect.bottom, view.bottom),
    left: Math.max(rect.left, view.left),
    right: Math.min(rect.right, view.right),
  };
}

/** The fixed/sticky box at `(x, y)` that is not part of `target`, if any. */
function barAt(x: number, y: number, target: Element, band: Band): DOMRect | null {
  if (typeof document.elementsFromPoint !== "function") return null;
  for (const hit of document.elementsFromPoint(x, y)) {
    for (let node: Element | null = hit; node !== null; node = node.parentElement) {
      if (node === document.body || node === document.documentElement) break;
      // The field's own ancestors are the page it lives in, not a bar over it.
      if (node.contains(target) || target.contains(node)) break;
      const position = getComputedStyle(node).position;
      if (position !== "fixed" && position !== "sticky") continue;
      const rect = node.getBoundingClientRect();
      // A box covering half the band is a sheet or an overlay, not a bar.
      if (rect.height >= (band.bottom - band.top) / 2) break;
      return rect;
    }
  }
  return null;
}

/**
 * How much of the scrollport's top and bottom is covered by bars, measured
 * at three points across each edge.
 */
export function obstructedInsets(target: Element): ObstructedInsets {
  const band = bandOf(scrollParentOf(target));
  let top = 0;
  let bottom = 0;
  // Probed across the FIELD's own width: a sticky rail beside the form is
  // not over it.
  const own = target.getBoundingClientRect();
  const left = Math.max(band.left, own.width > 0 ? own.left : band.left);
  const right = Math.min(band.right, own.width > 0 ? own.right : band.right);
  const width = Math.max(0, right - left);
  for (const fraction of [0.1, 0.5, 0.9]) {
    const x = left + width * fraction;
    top = Math.max(top, stackFrom(x, band.top, 1, target, band) - band.top);
    bottom = Math.max(bottom, band.bottom - stackFrom(x, band.bottom, -1, target, band));
  }
  return { top, bottom };
}

/** How far bars reach in from one edge. Bars STACK (a sticky footer above a
 * fixed dock) and FLOAT (a dock with a margin under it), so each bar found
 * moves the edge and the next few pixels past it are probed again; a gap of
 * {@link BAR_REACH} with nothing in it ends the stack. */
const BAR_REACH = 24;

function stackFrom(x: number, from: number, step: 1 | -1, target: Element, band: Band): number {
  let edge = from;
  for (let guard = 0; guard < 8; guard += 1) {
    let found: DOMRect | null = null;
    for (let offset = 1; offset <= BAR_REACH && found === null; offset += 4) {
      const y = edge + step * offset;
      if (y <= band.top || y >= band.bottom) break;
      found = barAt(x, y, target, band);
    }
    if (found === null) return edge;
    const next = step === 1 ? found.bottom : found.top;
    // A bar that does not move the edge any further ends the scan.
    if (step === 1 ? next <= edge : next >= edge) return edge;
    edge = next;
  }
  return edge;
}

/** How far to scroll so `frame` sits in the uncovered band; 0 when it does. */
function scrollDelta(frame: Element): number {
  const band = bandOf(scrollParentOf(frame));
  const insets = obstructedInsets(frame);
  const top = band.top + insets.top + GAP;
  const bottom = band.bottom - insets.bottom - GAP;
  const rect = frame.getBoundingClientRect();
  // No box at all: nothing laid out (no layout engine) — nowhere to go.
  if (rect.width === 0 && rect.height === 0) return 0;
  if (rect.top >= top && rect.bottom <= bottom) return 0;
  const room = bottom - top;
  // Centred in what is left when it fits; its top edge (the label) first
  // when it does not.
  if (rect.height <= room) return rect.top - (top + (room - rect.height) / 2);
  return rect.top - top;
}

function scrollBy(frame: Element, delta: number, behavior: ScrollBehavior): void {
  if (delta === 0) return;
  const scroller = scrollParentOf(frame);
  if (scroller === null) {
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: window.scrollY + delta, behavior });
    }
  } else if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({ top: scroller.scrollTop + delta, behavior });
  } else {
    scroller.scrollTop += delta;
  }
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function coarsePointer(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Focus without scrolling, holding a searchable select's keyboard back on a
 * touch screen: the person was taken to a CHOICE, and a keyboard that covers
 * half the screen was not what they asked for. The first touch gives it back.
 */
function focusControl(control: HTMLElement): void {
  const holdKeyboard =
    control instanceof HTMLInputElement &&
    control.getAttribute("role") === "combobox" &&
    !control.readOnly &&
    coarsePointer();
  if (holdKeyboard) {
    const previous = control.getAttribute("inputmode");
    control.setAttribute("inputmode", "none");
    const restore = (): void => {
      if (previous === null) control.removeAttribute("inputmode");
      else control.setAttribute("inputmode", previous);
      control.removeEventListener("pointerdown", restore);
      control.removeEventListener("blur", restore);
    };
    control.addEventListener("pointerdown", restore);
    control.addEventListener("blur", restore);
  }
  control.focus({ preventScroll: true });
}

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** "<label>: <error>" off the frame, as far as the frame says either. */
function describeFrame(frame: Element, control: Element | null): string {
  let label = textOf(frame.querySelector("label"));
  const labelledBy = control?.getAttribute("aria-labelledby");
  if (label === "" && labelledBy) label = textOf(document.getElementById(labelledBy));
  if (label === "") label = control?.getAttribute("aria-label") ?? "";
  const describedBy = control?.getAttribute("aria-describedby");
  let error = "";
  for (const id of (describedBy ?? "").split(/\s+/).filter(Boolean)) {
    error = textOf(document.getElementById(id));
    if (error !== "") break;
  }
  if (error === "") error = textOf(frame.querySelector('[role="alert"]'));
  return [label, error].filter((part) => part !== "").join(": ");
}

const ANNOUNCER = "data-stapel-reveal-announcer";

/** Hand `message` to the one polite live region, re-announcing a repeat. */
export function announce(message: string): void {
  if (typeof document === "undefined" || message === "") return;
  let region = document.querySelector<HTMLElement>(`[${ANNOUNCER}]`);
  if (region === null) {
    region = document.createElement("div");
    region.setAttribute(ANNOUNCER, "");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    Object.assign(region.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
      border: "0",
    });
    document.body.appendChild(region);
  }
  // Cleared first, or the same sentence twice is read once.
  region.textContent = "";
  const target = region;
  setTimeout(() => {
    target.textContent = message;
  }, 50);
}

/** Where the scroller stands, so a check can tell its own scroll from the
 * person's. */
function positionOf(frame: Element): number {
  const scroller = scrollParentOf(frame);
  return scroller === null ? window.scrollY : scroller.scrollTop;
}

/**
 * Re-check the landing after the page has settled, and correct it.
 *
 * Two things move a field after it was revealed: chrome that answers to
 * scrolling, and the form itself — a dependent row filling in once its
 * vocabulary answers pushes the refused row down after it was measured
 * (seen at 390: a modification row measured clear, then 10px under the footer).
 * So the check runs whether or not this reveal scrolled, once the smooth
 * scroll ends and again a little later. It never fights the person: if the
 * position is no longer where this left it, they have scrolled, and it stops.
 */
function settleThenCorrect(frame: Element, scrolled: boolean): void {
  const scroller = scrollParentOf(frame) ?? window;
  let expected: number | null = scrolled ? null : positionOf(frame);
  let checks = 0;
  const check = (): void => {
    checks += 1;
    const now = positionOf(frame);
    if (expected !== null && Math.abs(now - expected) > 4) return;
    const delta = scrollDelta(frame);
    scrollBy(frame, delta, "auto");
    expected = positionOf(frame);
    if (checks < 2) setTimeout(check, 600);
  };
  if (scrolled) {
    let fired = false;
    const once = (): void => {
      if (fired) return;
      fired = true;
      scroller.removeEventListener("scrollend", once);
      check();
    };
    scroller.addEventListener("scrollend", once, { once: true });
    setTimeout(once, 900);
  } else {
    setTimeout(check, 350);
  }
}

function revealNow(field: Element, options: RevealFieldOptions): RevealResult {
  const frame = options.frame ?? field;
  const behavior = options.behavior ?? (reducedMotion() ? "auto" : "smooth");
  const delta = scrollDelta(frame);
  scrollBy(frame, delta, behavior);
  settleThenCorrect(frame, delta !== 0 && behavior === "smooth");

  const wanted =
    options.control instanceof HTMLElement ? options.control : firstFocusableIn(field);
  let focused: Element | null = null;
  if (wanted !== null) {
    focusControl(wanted);
    if (document.activeElement === wanted) focused = wanted;
  }
  if (focused === null && frame instanceof HTMLElement) {
    // Nothing answerable (a switched-off control, a slot with no input): the
    // ROW takes the caret, programmatically only, so the tab order is intact.
    frame.tabIndex = -1;
    frame.focus({ preventScroll: true });
    if (document.activeElement === frame) focused = frame;
  }
  const message =
    options.announce === false
      ? null
      : (options.announce ?? describeFrame(frame, focused === frame ? null : focused));
  if (message !== null && message !== "") announce(message);
  return { focused, announced: message === "" ? null : message };
}

/**
 * Open, scroll to, focus and announce one field (see the module header).
 *
 * Returns the result synchronously when nothing had to be clicked open;
 * when a disclosure toggle was clicked, the reveal runs two frames later (the
 * framework has to render the opened section) and this returns `null`.
 */
export function revealField(
  field: Element,
  options: RevealFieldOptions = {}
): RevealResult | null {
  if (typeof document === "undefined") return null;
  const clicked = expandAncestors(options.frame ?? field);
  if (!clicked || typeof requestAnimationFrame !== "function") {
    return revealNow(field, options);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => revealNow(field, options)));
  return null;
}

export interface RevealFirstInvalidOptions extends Omit<RevealFieldOptions, "frame" | "control"> {
  /** Extra selector for a refused ROW (a design system's error class). */
  readonly rowSelector?: string;
  /** How to find a field's row from its control, e.g. `.ant-form-item`. */
  readonly rowOf?: (element: Element) => Element | null;
}

/**
 * Reveal the first refused field under `root`, in document order. Returns
 * whether one was found. Hidden refusals (another step's rows scoped out by
 * CSS) are skipped.
 */
export function revealFirstInvalid(
  root: ParentNode,
  options: RevealFirstInvalidOptions = {}
): boolean {
  const selector =
    options.rowSelector === undefined
      ? INVALID_FIELD_SELECTOR
      : `${INVALID_FIELD_SELECTOR},${options.rowSelector}`;
  const hit = [...root.querySelectorAll(selector)].find(revealable);
  if (hit === undefined) return false;
  const row = options.rowOf?.(hit) ?? hit;
  const { rowSelector: _rows, rowOf: _rowOf, ...rest } = options;
  revealField(row, { ...rest, frame: row, control: hit === row ? null : hit });
  return true;
}

/** What {@link useRevealOnRefusal} needs to find a design system's rows. */
export type RevealOnRefusalOptions = RevealFirstInvalidOptions;

/**
 * Land on the first refused field when a SERVER refusal arrives (a submit
 * answered 400 with field errors), not only when the client refused it.
 *
 * `refusedKeys` is the set of fields currently refused, in any order. The
 * reveal runs when a key appears that was not refused a render ago — the
 * answer to a press — and never when errors only clear as the person types.
 */
export function useRevealOnRefusal(
  root: { readonly current: ParentNode | null },
  refusedKeys: readonly string[],
  options: RevealOnRefusalOptions = {}
): void {
  const seen = useRef<ReadonlySet<string>>(new Set());
  const key = [...refusedKeys].sort().join("\u0001");
  useEffect(() => {
    const now = new Set(refusedKeys);
    const fresh = [...now].some((one) => !seen.current.has(one));
    seen.current = now;
    if (!fresh || root.current === null) return;
    revealFirstInvalid(root.current, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the refused set; options are read at the moment of the refusal
  }, [key]);
}
