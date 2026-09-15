# `stapel/no-self-measuring-ref`

> A measurement must not decide the size of the thing it measures.

- **Type:** problem
- **Recommended:** yes — `warn` in `configs.recommended`, `error` in `configs.strict`
- **Fixable:** no. Moving a ref is a layout decision; a codemod that picked the
  wrapper for you would pick the wrong one.

## The worked example: `@stapel/video-react` 0.3.6

`<IncomingCallOverlay>` is the ring that draws on every page. It picks
full-screen or card by **measuring an element** — the house rule everywhere in
this fleet, because the constraint is the width of the box the component is
drawn in, not the device. A desktop host that mounts the ring in a narrow
column should get the phone treatment.

The ref sat on the dialog whose own width that choice *sets*:

```tsx
// 0.3.6 — shipped, and it cost every desktop call
const { ref, narrow: measured } = useNarrow<HTMLDivElement>();
const variant = props.variant ?? "auto";
const narrow = variant === "auto" ? measured : variant === "fullscreen";

return (
  <div
    ref={ref}
    role="dialog"
    style={
      narrow
        ? { position: "fixed", inset: 0, padding: token.paddingLG }   // full-bleed
        : { position: "fixed", top: 24, right: 24, maxWidth: 360 }    // a 360 card
    }
  >
    {narrow ? body : <Card>{body}</Card>}
  </div>
);
```

Follow it at a 1440px viewport:

| the box reports | `narrow` | the arm drawn | the box is now |
| --- | --- | --- | --- |
| 1440 | `false` | card | 360 |
| 360 | `true` | full-screen | 1440 |
| 1440 | `false` | card | 360 |

There is no fixed point. The overlay flipped arm on **every animation frame**,
and because the two arms are different trees — a `<Card>` wrapper in one, a
bare body in the other — React rebuilt the subtree each time. The stand counted
**120 distinct accept-button DOM nodes over 120 frames**, the button jumping
between x=1250 and x=728.

A pointer press and its release on two different DOM nodes never become a
`click`. So the accept button was unpressable, no `POST /calls/<id>/accept` was
ever issued, and every desktop call rang until the server timed it out as
missed.

**At 390 there was no loop**: the full-screen arm measures 390, which is still
narrow, so the phone sat on the one stable arm. That is why the defect was
invisible on the width everyone tested — and why this is a lint rule rather
than something anybody was going to notice by looking.

### The fix (0.3.7)

Measure a full-bleed **frame** whose style is identical in both arms, and let
the arms differ *inside* it:

```tsx
const RING_FRAME: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1200,
  pointerEvents: "none",
};

return (
  <div ref={ref} style={RING_FRAME}>
    <div role="dialog" style={narrow ? fullscreen : card}>
      {narrow ? body : <Card>{body}</Card>}
    </div>
  </div>
);
```

A `position: fixed` element is laid out against its containing block — the
viewport, or whatever column the host mounted it in — so the number still
answers "how wide is the box this is drawn in?", with one the answer cannot
move. `useNarrow()`'s own header now states the invariant, and
`video-react/test/ringWidth.test.tsx` is the gate for that one component: the
measured element's style must be identical in both arms, and nothing the arms
redraw may be observed.

This rule is the fleet-wide net under that test, not a replacement for it.

## What the rule reports

All three require the hook binding, the `ref={…}` attribute, and the dependence
to be visible in **one function body**.

### `measuredStyleSwitch` — the whole `style` switches on the answer

```tsx
// ✗
<div ref={ref} style={narrow ? { inset: 0 } : { maxWidth: 360 }} />
<div ref={ref} style={narrow ? FULL : CARD} />        // one const hop, resolved
<div ref={ref} style={narrow && { position: "fixed", inset: 0 }} />
```

Reported only when the two arms **differ in a width-affecting property**. Two
arms that differ only in colour, height or `aspectRatio` are silent — that is
exactly the "identical geometry in both arms" invariant, satisfied.

### `measuredStyle` — one width property read off the answer

```tsx
// ✗
<div ref={ref} style={{ maxWidth: narrow ? 360 : 1120 }} />
<div ref={boxRef} style={{ flexBasis: below.cards ? 320 : 960 }} />
```

### `measuredClass` — the class is chosen by the answer

```tsx
// ✗
<div ref={ref} className={narrow ? "pane pane--stacked" : "pane pane--split"} />
<div ref={ref} className={clsx("pane", width < 768 && "pane--stacked")} />
```

**This is the one place the rule over-approximates, deliberately.** A class can
set any width and the stylesheet is not visible from here, so a class chosen by
the measurement is reported whether or not it actually moves the width. If your
class genuinely does not, the answer is an `eslint-disable-next-line … -- reason`
saying which class and why — which is a sentence the next reader needs anyway.

### `measuredArms` — the measured box is returned from several paths that disagree

```tsx
// ✗ — same ref, two arms, two different widths
if (below.cards) return <div ref={ref} style={{ maxWidth: 360 }}><Cards/></div>;
return <div ref={ref} style={{ maxWidth: "none" }}><Table/></div>;
```

```tsx
// ✓ — same ref, three arms, identical geometry (SkinDataTable)
if (props.rows.length === 0) return <div ref={ref} style={{ minWidth: 0, ...props.style }}>…</div>;
if (layout === "table")     return <div ref={ref} style={{ minWidth: 0, ...props.style }}>…</div>;
return <div ref={ref} style={{ display: "flex", flexDirection: "column", minWidth: 0, ...props.style }}>…</div>;
```

Returning the measured box from several arms is fine — React sees the same
element type at the same tree position, so the node and the ref survive rather
than remounting. What matters is that its own geometry is the same on every
path.

### `measuredBranch` — the element only exists in one arm

```tsx
// ✗
return narrow ? <div ref={ref}>{body}</div> : <Card>{body}</Card>;
return <div>{narrow && <section ref={ref}>{body}</section>}</div>;
if (narrow) return <div ref={ref}>{body}</div>;
return <Card>{body}</Card>;
```

An element that is in the tree in one arm and not the other has no stable width
by construction: the observer is disconnected and reconnected against a
differently-sized box on every flip.

## What the rule does **not** report

### `aspectRatio`, and why that decides the rule's shape

`CallPanel`'s measured frame is real, shipped, correct code:

```tsx
// ✓ — never reported
<div
  ref={frameRef}
  style={{
    position: "relative",
    width: "100%",                                 // pinned by the layout
    aspectRatio: narrow ? "3 / 4" : "16 / 9",      // moves the HEIGHT only
  }}
/>
```

An aspect ratio on a box whose width is already pinned changes only its height,
so there is no loop. "Width-affecting" is therefore an **allowlist**
(`WIDTH_PROPS` in the rule source), not a denylist of safe properties. A
denylist would report `CallPanel`, the pair would disable the rule, and the
rule would then guard nothing.

Absent from the allowlist on purpose: `height`, `minHeight`, `maxHeight`,
`aspectRatio`, `top`, `bottom`, every colour, `borderRadius`, `boxShadow`,
`opacity`, `zIndex`, `pointerEvents`, `alignItems`, `justifyContent`, `gap`,
`fontSize`. `transform` **is** in the list: `getBoundingClientRect().width` —
the synchronous first read every one of these hooks does — includes it, even
though `ResizeObserver`'s `contentRect` does not.

Also absent: `flexDirection` and `flexWrap`. They lay out the element's
*children*; the element's own width follows only if it is shrink-to-fit, which
is already listed as out of reach below.

And `display` is in the list but judged on its **values**, not on the fact that
it changed:

| switch | reported | why |
| --- | --- | --- |
| `block` ↔ `flex` ↔ `grid` ↔ `flow-root` | no | all block-level; each fills the same parent |
| `block` ↔ `inline-block` / `inline-flex` | yes | shrink-to-fit: the box is then sized by its content |
| `block` ↔ `table` / `none` | yes | a different box model, or no box at all |
| an unreadable value | yes | refusing to decide is not deciding it is safe |

The `flexDirection` and `display` entries are both here because they were
**false positives on this rule's first sweep**, on `@stapel/tokens-antd`'s
`SkinDataTable`. Both shapes are now pinned as valid cases in the test suite.

### A descendant is not an ancestor

`ScopeUsageTable` measures a `maxWidth: 100%` wrapper and swaps a table for
cards several levels down inside it. The wrapper's width is the column's,
whatever it draws. Not reported, and correctly so.

## What it provably cannot catch

Written down because a rule whose limits are unwritten gets read as a proof.
A clean run of this rule is **not** evidence that a component's measurement is
sound; the component's own test is.

| Not caught | Why |
| --- | --- |
| **Across files.** `<Frame ref={ref}/>` where `Frame` sizes itself from a prop derived from the measurement. | The rule never leaves the function body. A cross-file version needs type information and would be guessing about every forwarded ref in the fleet. |
| **Through CSS.** A *constant* `className="ring"` whose stylesheet sizes it by a `data-variant={narrow ? …}` attribute on the same element. | The CSS is not readable from the AST. The tainted-className case *is* caught; a constant class whose CSS varies is not. |
| **Shrink-to-fit boxes.** An `inline-block` or absolutely-positioned box with no `width` takes its width from its **content**, so changing the children by the measurement is a loop with no width property in sight. | Undecidable statically — a layout fact, not a syntactic one. |
| **An opaque style.** `style={styleFor(narrow)}`, or `style={narrow ? a : b}` where an arm is not a resolvable object literal. | The rule does not report what it cannot read. One hop of `const X = { … }` is resolved; a function call is not. |
| **Through an ancestor's size.** The ref element is `width: 100%` of a *parent* whose width the same measurement sets. | Same loop, one element up, and usually in a different component. |
| **A threaded or merged ref.** `ref={(n) => { containerRef(n); mine(n); }}`, a ref stored in a variable first, a `mergeRefs` helper. | Only `ref={ref}` and `ref={box.ref}` are recognised. |
| **Direct `ResizeObserver` in a component.** `new ResizeObserver(…)` wired by hand to a ref and a `useState` setter. | Every direct use in this repo lives *inside* a measuring hook (`useNarrow`, `useElementWidth`, `useElementBox`, `useRailEdges`, `useSplitLayout`, `useImageSlot`, `railFit`, `TileMap`) — functions that render no JSX, so there is no ref attribute to correlate. Covered by naming the hook, not the observer. If a component ever inlines one, add its name to `options.hooks` is no help; that case is genuinely uncovered. |
| **The height twin.** A hook that decided a layout from *height*. | Every hook in this fleet measures width. `measuredBranch` and `measuredClass` would still fire; only the style-property case is width-shaped. |

## The fleet sweep (2026-09-15)

Run over every `packages/*/src` in `stapel-react` with only this rule enabled.
Three passes; the first two found false positives in the rule, which were fixed
and pinned as valid cases. The third pass reports **one** hit:

| File | Verdict |
| --- | --- |
| `packages/tokens-antd/src/skin/pane.tsx:112` | **Real.** For the `@stapel/tokens-antd` owner. |
| ~~`packages/tokens-antd/src/skin/dataTable.tsx:105`~~ | False positive ×2, fixed in the rule (multi-arm refs; `display`/`flexDirection`). |

### `Pane` — the same defect class, a narrower band

`Pane` is `box-sizing: border-box; width: 100%`, so its **border-box** width is
the parent's. `useElementWidth` commits `entry.contentBoxSize[0].inlineSize` —
the **content** box, padding excluded. And the padding is chosen by the
measurement:

```tsx
const { below } = useElementWidth(ref, { thresholds: { narrow: breakpoints.tablet } });
const padding = panePadding(props.padding ?? "regular", below.narrow ?? phone, token);
const style = { boxSizing: "border-box", width: "100%", paddingInline: padding, … };
return <Element ref={ref} style={style}>…</Element>;
```

With the default `regular` step (`padding` 16 narrow / `paddingLG` 24 wide) and
the `narrow` threshold at `breakpoints.tablet` = 768, take a border-box width
`W`:

- wide arm → padding 24 → content `W − 48` → narrow when `W < 816`
- narrow arm → padding 16 → content `W − 32` → narrow when `W < 800`

For **`W` in [800, 816)** the two arms each imply the other: a two-cycle
oscillation on every animation frame, and the browser's
"ResizeObserver loop completed with undelivered notifications". `roomy`
(24/32) gives the band [800, 832); `compact` (12/16) gives [792, 800).

`measure="reading"` caps `maxWidth` at 768 and `measure="narrow"` at 576, so
those are out of the band by construction. **`measure="wide"` and
`measure="full"` are not** — a `<Pane measure="wide">` rendered at 800–816 CSS
px oscillates. The visible symptom is milder than the ring's (the element type
and subtree do not change, so nothing remounts and nothing becomes unclickable
— the gutter flickers), but it is the same feedback loop, in the fleet's most
widely used layout primitive.

The fix is the ring's: measure a wrapper the padding does not touch, or read
the border-box width rather than the content box. Not made here — this rule's
package does not own `tokens-antd`.

## Options

```js
"stapel/no-self-measuring-ref": ["error", {
  hooks: ["usePaneWidth"],          // ADD to the defaults
  hooksOverride: ["usePaneWidth"],  // REPLACE them outright
}]
```

The default list is this repo's actual hooks, found by grep, not a standard:

`useElementWidth`, `useNarrow`, `useSplitLayout`, `useImageSlot`,
`useElementBox`, `useRailEdges`, `useRailFits`, plus `useElementSize`,
`useResizeObserver`, `useContainerWidth`, `useBoundingRect` and `useMeasure`
for the names a pair is likely to reach for next.

Both call shapes are recognised per call site, because the fleet uses both:

```tsx
const { ref, narrow } = useNarrow();                    // hook HANDS BACK a ref
const { below } = useElementWidth(boxRef, { … });       // hook TAKES one
const box = useNarrow();                                // box.ref / box.narrow
```

The measured value is followed through a `const` alias chain of **any depth** —
without that the rule would have missed the very defect it exists for, since
`<IncomingCallOverlay>` binds `narrow` under the alias `measured` and the style
reads a later `const` derived from it.
