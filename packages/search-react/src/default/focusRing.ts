/**
 * A focus ring the KEYBOARD gets and the mouse does not.
 *
 * On a live storefront, clicking the "collapse" control under a facet group
 * left a red outline standing around it until something else took focus. The
 * ring itself is right — it is the design system's `:focus-visible` outline,
 * and a keyboard must have it — but it was being drawn for a POINTER, which is
 * the one modality that already knows where it clicked.
 *
 * ── Why `:focus-visible` alone is not the fix ─────────────────────────────
 *
 * The usual answer, "draw the ring on `:focus-visible` and not on `:focus`",
 * was already true here: antd draws its button ring from
 * `&:not(:disabled):focus-visible` and nothing in this pair or the storefront's
 * sheet draws one on bare `:focus`. `:focus-visible` is a HEURISTIC, though,
 * not a statement about the last input device: the engine may match it for a
 * click when focus lands on an element whose surroundings have just changed
 * under it — which is exactly what a disclosure toggle does to its own list.
 * Suppressing the ring on `:focus:not(:focus-visible)` therefore fixes nothing
 * on the very control that showed the defect.
 *
 * ── What this states instead ──────────────────────────────────────────────
 *
 * The modality, as a fact the control records for itself: a pointer press
 * stamps `data-pointer-focus` on the element, and the first key it sees — or
 * losing focus — clears it. The sheet then turns the ring OFF while that stamp
 * is on, and leaves every other case to the design system. Tab to the control
 * and the ring is there; click it and it is not; click it and then Tab back to
 * it and it is there again, because the stamp died with the blur.
 *
 * The attribute is written straight to the node rather than held in state, on
 * purpose: it is presentation the frame does not depend on, one control at a
 * time, and a `useState` per facet button would re-render a rail of forty
 * groups to paint an outline. React does not own this attribute, so nothing
 * it renders fights over it.
 *
 * The class is doubled in the selector (`.c.c[…]`) for exactly one reason:
 * specificity. antd's own ring is `.ant-btn:not(:disabled):focus-visible`
 * (0,3,0); a single class plus the attribute plus the pseudo-class ties it, and
 * a tie is settled by whichever stylesheet the engine saw last — which for a
 * runtime CSS-in-JS design system is not a thing this pair gets to decide.
 */
import type { CSSProperties } from "react";

/** The class the pointer-focus rule is hung on. */
export const POINTER_FOCUS_CLASS = "stapel-search-pointer-focus";

/** The attribute a pointer press stamps, and a key or a blur clears. */
export const POINTER_FOCUS_ATTR = "data-pointer-focus";

/** The `href` the hoisted focus sheet is deduplicated by (React 19). */
export const POINTER_FOCUS_STYLE_HREF = "stapel-search-pointer-focus";

/** See the module note. */
export function pointerFocusCss(): string {
  const c = `.${POINTER_FOCUS_CLASS}`;
  return `${c}${c}[${POINTER_FOCUS_ATTR}]:focus-visible{outline:none;box-shadow:none}`;
}

/**
 * The handlers a control spreads to opt into the rule above.
 *
 * Typed against the DOM rather than against React's synthetic event so the
 * same object fits a native `<button>` and antd's `<Button>` — both forward
 * these three props to the element, which is the only thing this needs.
 */
export interface PointerFocusProps {
  readonly className: string;
  readonly onPointerDown: (event: { currentTarget: Element }) => void;
  readonly onKeyDown: (event: { currentTarget: Element }) => void;
  readonly onBlur: (event: { currentTarget: Element }) => void;
}

/**
 * Spread onto any control whose ring should be the keyboard's alone.
 *
 * A constant, not a hook: it closes over nothing, so one object serves every
 * control in the tree and a facet group of forty rows allocates none.
 */
export const POINTER_FOCUS: PointerFocusProps = {
  className: POINTER_FOCUS_CLASS,
  onPointerDown: (event) => {
    event.currentTarget.setAttribute(POINTER_FOCUS_ATTR, "");
  },
  onKeyDown: (event) => {
    event.currentTarget.removeAttribute(POINTER_FOCUS_ATTR);
  },
  onBlur: (event) => {
    event.currentTarget.removeAttribute(POINTER_FOCUS_ATTR);
  },
};

/** {@link POINTER_FOCUS} with a className of the caller's own merged in. */
export function pointerFocus(className: string): PointerFocusProps {
  return { ...POINTER_FOCUS, className: `${className} ${POINTER_FOCUS_CLASS}` };
}

/** Nothing this module styles inline — exported so a host composing its own
 * control can state the same intent without re-deriving the selector. */
export const POINTER_FOCUS_NO_RING: CSSProperties = { outline: "none" };
