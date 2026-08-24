---
"@stapel/image": minor
---

A small image asks for a small file. The slot is measured, not remembered.

`useImageSlot` reported a per-axis HIGH-WATER MARK: the size only ever grew.
The intent was right — never re-fetch a smaller variant for an image already
on screen — but it was enforced one layer too early, and it cost three things.

It stopped being a measurement: a page that lays out wide and settles narrow (a
card grid before its container query resolves, a flex row before it wraps, a
phone that starts in landscape) was measured WIDE once and frozen there, so a
96px thumbnail asked for the tier a hero needs. The two axes were maxed
independently, so `size` could describe a box that never existed — the widest
width the element ever had beside the tallest height — and `chooseVariant`
derives the limiting AXIS from that pair. And "never downgrade" is a statement
about the NETWORK, true only once a larger variant is actually loaded and
painted; before that, re-picking smaller is exactly right.

So the rule moved to where it belongs — `<Image>`'s load effect, which knows
what is on screen — and the hook now answers the question it is named for: how
big is this element, right now. It stays cheap by coalescing a resize burst
into one trailing measurement (`settleMs`, default 120, exposed as
`<Image slotSettleMs>`), so a window-edge drag is one tier decision rather than
forty. A zero-sided box is ignored rather than pinning an axis at 0 — the guard
used `&&`, so a `200 x 0` pre-layout box got through.

The load-layer guard compares TIERS, not pixel areas: `width`/`height` are
`null` on every variant of a ladder whose resolver cannot read them, and an
area comparison of `0 <= 0` is the bug 0.3.1 had to work around. An equal tier
on a DIFFERENT branch is now allowed through — that is the slot's limiting axis
having changed, not a downgrade.

New: `useDevicePixelRatio()`, re-read when it changes. DPR is not a constant —
browser zoom moves it, and so does dragging a window from a 1x monitor to a
Retina one; read once at mount, the image stays visibly soft after the move.
