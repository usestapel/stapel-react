---
"@stapel/tokens-antd": minor
---

A new `/skin` subpath: `SkinDialog`, the one dialog surface the fleet renders through.

The owner's ruling — on a phone a modal is a bottom sheet; modals are
tablet/desktop only. That is a design-system decision, and a design-system
decision re-taken in every component is not a decision: of the eleven `Modal`
sites in the pairs' default skins, eight rendered a centred desktop modal on a
390px phone, and the three that got it right had each hand-written their own
`isPhone ? <Drawer> : <Modal>` branch, giving the fleet three different sheets.

This package is the only one every antd default skin already depends on, so it
is the only place the rule can be stated once and inherited by all of them
without inverting the dependency graph. The root export is unchanged — still
pure functions, no components; a host that only wants the theme mapping never
loads a component.

The sheet is a sheet, not a drawer that comes from the bottom: swipe-to-dismiss
with a distance threshold and a flick floor, a real `<button>` grab handle so
the gesture has a keyboard and screen-reader equivalent, safe-area inset
padding, `overscroll-behavior: contain`, and a `dvh` height cap (mobile
Safari's `vh` is the tallest the viewport ever gets, so a `90vh` sheet hides
its own footer under the browser chrome). `dismissible={false}` draws no way
out at all — for the one shape that genuinely has none — rather than an
affordance that is offered and inert.

The surface is read through `useSyncExternalStore` on one `matchMedia` against
`@stapel/tokens`' own `tablet` breakpoint, so the FIRST client render is
already right; `useBreakpoint()` returns `undefined` until an effect runs,
which painted a desktop modal for a frame on every phone. `useDialogSurface()`
is exported for a skin that cannot use the component (an imperative
`Modal.confirm`) and must still obey the same rule from the same source.

Geometry sits on `.ant-drawer-content-wrapper`, the one panel element antd 5
and antd 6 name identically (`styles.content` is deprecated in 6 and warns).
