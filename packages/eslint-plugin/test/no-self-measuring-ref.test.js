// The shapes here are TRANSCRIBED, not invented: the invalid cases are
// `@stapel/video-react` 0.3.6's `<IncomingCallOverlay>` as it shipped, and the
// valid cases are 0.3.7's fix plus the two other `useNarrow()` call sites in
// the same package. A rule for one production defect has to fail on the code
// that caused it and pass on the code that fixed it — anything else is a
// gate that proves nothing.
import rule from "../rules/no-self-measuring-ref.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const RING = "/repo/packages/video-react/src/default/IncomingCallOverlay.tsx";
const PANEL = "/repo/packages/video-react/src/default/CallPanel.tsx";
const USAGE = "/repo/packages/video-react/src/default/ScopeUsageTable.tsx";

tester.run("no-self-measuring-ref", rule, {
  valid: [
    // ── video-react 0.3.7, the fix ────────────────────────────────────────
    //
    // The measured element is a full-bleed frame whose style object is the
    // SAME in both arms (a module-level const, which the rule resolves), and
    // the dialog that does switch is inside it. This is the shape the rule
    // exists to bless.
    {
      filename: RING,
      code:
        'const RING_FRAME = { position: "fixed", inset: 0, zIndex: 1200, pointerEvents: "none" };\n' +
        "function RingOverlay(props) {\n" +
        "  const { ref, narrow: measured } = useNarrow();\n" +
        '  const variant = props.variant ?? "auto";\n' +
        '  const narrow = variant === "auto" ? measured : variant === "fullscreen";\n' +
        "  return (\n" +
        '    <div ref={ref} style={RING_FRAME} data-testid="video-ring-frame">\n' +
        '      <div style={narrow ? { position: "absolute", inset: 0 } : { position: "absolute", maxWidth: 360 }}>\n' +
        "        {narrow ? body : <Card>{body}</Card>}\n" +
        "      </div>\n" +
        "    </div>\n" +
        "  );\n" +
        "}",
    },
    // The same fix written inline rather than through a const — still one
    // object, still no dependence on the answer.
    {
      filename: RING,
      code:
        "function RingOverlay() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return (\n" +
        '    <div ref={ref} style={{ position: "fixed", inset: 0 }}>\n' +
        "      <div style={narrow ? A : B}>{narrow ? body : <Card>{body}</Card>}</div>\n" +
        "    </div>\n" +
        "  );\n" +
        "}",
    },

    // ── the other two real `useNarrow()` call sites ───────────────────────
    //
    // CallPanel's frame. `width: "100%"` is pinned by the layout and the only
    // thing the answer changes is `aspectRatio`, which on a width-pinned box
    // moves the HEIGHT. This is the case that decides the rule's shape: an
    // allowlist of width-affecting properties rather than a denylist of safe
    // ones. A denylist reports this, the pair disables the rule, and the rule
    // then guards nothing.
    {
      filename: PANEL,
      code:
        "function CallPanelBody(props) {\n" +
        "  const { ref: frameRef, narrow } = useNarrow();\n" +
        "  useAudioKeepAlive(narrow);\n" +
        "  return (\n" +
        "    <div\n" +
        "      ref={frameRef}\n" +
        '      style={{ position: "relative", width: "100%", aspectRatio: narrow ? "3 / 4" : "16 / 9", background: token.colorBgLayout, borderRadius: token.borderRadiusLG, overflow: "hidden" }}\n' +
        '      data-testid="video-call-frame"\n' +
        "    >\n" +
        "      <div style={{ width: narrow ? 96 : 160 }}>{renderLocal()}</div>\n" +
        "    </div>\n" +
        "  );\n" +
        "}",
    },
    // ScopeUsageTable. The ref is on a `maxWidth: 100%` wrapper and the answer
    // is consumed DEEP INSIDE it (the `ready` arm of matchList swaps a table
    // for cards). A descendant is not an ancestor: the wrapper's width is the
    // column's, whatever it draws.
    {
      filename: USAGE,
      code:
        "function ScopeUsageTable(props) {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return (\n" +
        '    <Flex vertical ref={ref} style={{ maxWidth: "100%" }}>\n' +
        "      {matchList(rows, {\n" +
        "        ready: (people) => (narrow ? <Cards rows={people}/> : <Table rows={people}/>),\n" +
        "      })}\n" +
        "    </Flex>\n" +
        "  );\n" +
        "}",
    },

    // ── the false-positive guard: an UNRELATED boolean ────────────────────
    //
    // Everything about this element switches — its class, a width property,
    // and whether it is rendered at all — on values that are not the
    // measurement. A rule that fired here would be flagging every responsive
    // component in the fleet.
    {
      filename: RING,
      code:
        "function Panel(props) {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  const { collapsed, loading } = props;\n" +
        "  return loading ? null : (\n" +
        "    <div ref={ref} className={collapsed ? \"rail rail--tight\" : \"rail\"} style={{ maxWidth: collapsed ? 240 : 960 }}>\n" +
        "      {narrow ? <Stack/> : <Row/>}\n" +
        "    </div>\n" +
        "  );\n" +
        "}",
    },
    // A measurement used for something that is not layout at all.
    {
      filename: PANEL,
      code:
        "function A() {\n" +
        "  const { ref, width } = useElementWidth();\n" +
        "  useEffect(() => { report(width); }, [width]);\n" +
        '  return <div ref={ref} style={{ width: "100%" }}/>;\n' +
        "}",
    },
    // A hook that is not a measuring hook, with a ref-shaped return.
    {
      filename: PANEL,
      code:
        "function A() {\n" +
        "  const { ref, open } = useDisclosure();\n" +
        "  return <div ref={ref} style={{ maxWidth: open ? 640 : 320 }}/>;\n" +
        "}",
    },
    // The ref-TAKING shape, used correctly: the measured box is pinned and the
    // arms are inside it (`@stapel/tokens-antd/skin`'s documented example).
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const ref = useRef(null);\n" +
        "  const { below } = useElementWidth(ref, { thresholds: { cards: breakpoints.tablet } });\n" +
        "  const cards = below.cards ?? phone;\n" +
        '  return <div ref={ref} style={{ width: "100%" }}>{cards ? <Cards/> : <Table/>}</div>;\n' +
        "}",
    },
    // Two different measurements in one component: the arm switched by the
    // FIRST one lives inside the element measured by the second. Neither ref
    // sits on a box its own answer resizes.
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const { ref: outerRef, narrow } = useNarrow();\n" +
        "  const { ref: innerRef, width } = useElementWidth();\n" +
        '  return <div ref={outerRef} style={{ width: "100%" }}><div ref={innerRef} style={{ minWidth: narrow ? 0 : 320 }}/></div>;\n' +
        "}",
    },
    // A style switch on the measurement whose two arms differ only in
    // properties that cannot move the width. The ring's own invariant —
    // "identical geometry in both arms" — allows exactly this.
    {
      filename: RING,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        '  return <div ref={ref} style={narrow ? { width: "100%", background: "red", minHeight: 40 } : { width: "100%", background: "blue", minHeight: 80 }}/>;\n' +
        "}",
    },
    // ── the first sweep's two false positives, now pinned valid cases ─────
    //
    // `@stapel/tokens-antd`'s `SkinDataTable`, transcribed: it returns the
    // measured box from THREE arms — empty, table, cards — and the arm is
    // chosen by the measurement. The rule's first run over `packages/*/src`
    // reported it twice, and both reports were wrong.
    //
    //  1. Not a BRANCH defect: React sees a `div` at the same tree position in
    //     every arm, so the node and the ref survive rather than remounting.
    //     The branch check is therefore skipped when the ref is attached more
    //     than once, and the arms are compared for real disagreement instead.
    //  2. Not a WIDTH disagreement either, though the cards arm is
    //     `display: flex` and the other two are plain blocks: a block-level
    //     box fills its parent's inline size whatever kind of box it is. Hence
    //     `flexDirection` leaving the width list and `display` being judged on
    //     its VALUES rather than on the fact that it changed.
    {
      filename: "/repo/packages/tokens-antd/src/skin/dataTable.tsx",
      code:
        "function DataTable(props) {\n" +
        "  const ref = useRef(null);\n" +
        "  const { below } = useElementWidth(ref, { thresholds: { cards: breakpoints.tablet } });\n" +
        "  const cards = below.cards ?? phone;\n" +
        '  const layout = props.layout !== undefined && props.layout !== "auto" ? props.layout : cards ? "cards" : "table";\n' +
        "  if (props.rows.length === 0) {\n" +
        "    return <div ref={ref} data-stapel-datatable={layout} {...attrs} style={{ minWidth: 0, ...props.style }}>{props.empty}</div>;\n" +
        "  }\n" +
        '  if (layout === "table") {\n' +
        '    return <div ref={ref} data-stapel-datatable="table" {...attrs} style={{ minWidth: 0, ...props.style }}><Table/></div>;\n' +
        "  }\n" +
        '  return <div ref={ref} data-stapel-datatable="cards" role="list" {...attrs} style={{ display: "flex", flexDirection: "column", gap: token.paddingSM, minWidth: 0, ...props.style }}><Cards/></div>;\n' +
        "}",
    },
    // The same judgement inside one style object: two block-level boxes.
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        '  return <div ref={ref} style={{ width: "100%", display: narrow ? "flex" : "block" }}/>;\n' +
        "}",
    },
  ],

  invalid: [
    // …and the same multi-arm shape when the arms actually DISAGREE about the
    // geometry. Returning the measured box from several paths is fine; having
    // it be a different size on each path is the ring defect wearing an
    // early-return costume, and the per-element style check cannot see it
    // (each arm's own style object is a constant).
    {
      filename: "/repo/packages/tokens-antd/src/skin/dataTable.tsx",
      code:
        "function DataTable(props) {\n" +
        "  const ref = useRef(null);\n" +
        "  const { below } = useElementWidth(ref, { thresholds: { cards: 768 } });\n" +
        "  if (below.cards) {\n" +
        "    return <div ref={ref} style={{ maxWidth: 360 }}><Cards/></div>;\n" +
        "  }\n" +
        '  return <div ref={ref} style={{ maxWidth: "none" }}><Table/></div>;\n' +
        "}",
      errors: [{ messageId: "measuredArms" }],
    },
    // …and `display` going INLINE-level under the measurement, which really
    // does change the element's own width: an inline-block box is sized by its
    // content, so it measures whatever the arm happened to draw.
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        '  return <div ref={ref} style={{ display: narrow ? "inline-block" : "block" }}/>;\n' +
        "}",
      errors: [{ messageId: "measuredStyle" }],
    },
    // ── video-react 0.3.6, the defect, transcribed ────────────────────────
    //
    // The ref is on the dialog, and the dialog's style switches on the answer
    // between a full-bleed `inset: 0` and a `maxWidth: 360` card. 1440 → card
    // → 360 → full-screen → 1440. The accept button was never clickable and
    // desktop calls never connected.
    //
    // Note the two hops the rule has to follow to see it: the hook binds
    // `narrow` under the alias `measured`, and the name the style reads is a
    // LATER const derived from it.
    {
      filename: RING,
      code:
        "function RingOverlay(props) {\n" +
        "  const { ref, narrow: measured } = useNarrow();\n" +
        '  const variant = props.variant ?? "auto";\n' +
        '  const narrow = variant === "auto" ? measured : variant === "fullscreen";\n' +
        "  return (\n" +
        "    <div\n" +
        "      ref={ref}\n" +
        '      role="dialog"\n' +
        '      data-variant={narrow ? "fullscreen" : "card"}\n' +
        "      style={\n" +
        "        narrow\n" +
        '          ? { position: "fixed", inset: 0, zIndex: 1200, background: token.colorBgContainer, display: "flex", padding: token.paddingLG }\n' +
        '          : { position: "fixed", top: token.paddingLG, right: token.paddingLG, zIndex: 1200, maxWidth: 360 }\n' +
        "      }\n" +
        "    >\n" +
        "      {narrow ? body : <Card>{body}</Card>}\n" +
        "    </div>\n" +
        "  );\n" +
        "}",
      errors: [{ messageId: "measuredStyleSwitch" }],
    },
    // The same defect after somebody "tidies" the two arms into named consts.
    // Resolving one hop of `const X = {…}` is what keeps the refactor from
    // silencing the rule.
    {
      filename: RING,
      code:
        'const FULL = { position: "fixed", inset: 0 };\n' +
        'const CARD = { position: "fixed", maxWidth: 360 };\n' +
        "function RingOverlay() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return <div ref={ref} style={narrow ? FULL : CARD}>{body}</div>;\n" +
        "}",
      errors: [{ messageId: "measuredStyleSwitch" }],
    },
    // One width property read straight off the answer — the smallest version
    // of the same loop, and the one a pair writes by accident.
    {
      filename: PANEL,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return <div ref={ref} style={{ maxWidth: narrow ? 360 : 1120 }}>{body}</div>;\n" +
        "}",
      errors: [{ messageId: "measuredStyle" }],
    },
    // The ref-TAKING shape, wrong: the caller holds the ref, the hook reads
    // it, and the element it is on is sized from the reading.
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const boxRef = useRef(null);\n" +
        "  const { below } = useElementWidth(boxRef, { thresholds: { cards: 768 } });\n" +
        "  return <div ref={boxRef} style={{ flexBasis: below.cards ? 320 : 960 }}/>;\n" +
        "}",
      errors: [{ messageId: "measuredStyle" }],
    },
    // ── the ternary-over-className case ───────────────────────────────────
    //
    // Deliberately over-approximating: the stylesheet is not visible from
    // here, so a class chosen by the measurement is reported whether or not
    // it sets a width. This is the one place the rule guesses, and it says so.
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        '  return <div ref={ref} className={narrow ? "pane pane--stacked" : "pane pane--split"}>{body}</div>;\n' +
        "}",
      errors: [{ messageId: "measuredClass" }],
    },
    // A class chosen through a helper is still a class chosen by the answer.
    {
      filename: USAGE,
      code:
        "function A() {\n" +
        "  const { ref, width } = useElementWidth();\n" +
        "  return <div ref={ref} className={clsx(\"pane\", width < 768 && \"pane--stacked\")}/>;\n" +
        "}",
      errors: [{ messageId: "measuredClass" }],
    },
    // ── the ancestor-branch case ──────────────────────────────────────────
    //
    // The measured element exists in ONE arm of a branch taken on its own
    // measurement: in the other arm it is not in the tree at all, so the
    // observer is disconnected and reconnected against a differently-sized
    // box on every flip.
    {
      filename: RING,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return narrow ? <div ref={ref} style={{ inset: 0 }}>{body}</div> : <Card><div>{body}</div></Card>;\n" +
        "}",
      errors: [{ messageId: "measuredBranch" }],
    },
    // The `&&` spelling of the same thing.
    {
      filename: RING,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return <div>{narrow && <section ref={ref}>{body}</section>}</div>;\n" +
        "}",
      errors: [{ messageId: "measuredBranch" }],
    },
    // …and the early-return spelling, which is how it reads when the two arms
    // have grown too big to sit in one expression.
    {
      filename: RING,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  if (narrow) {\n" +
        "    return <div ref={ref}>{body}</div>;\n" +
        "  }\n" +
        "  return <Card>{body}</Card>;\n" +
        "}",
      errors: [{ messageId: "measuredBranch" }],
    },
    // The non-destructured binding: `box.narrow` decides `box.ref`'s width.
    {
      filename: PANEL,
      code:
        "function A() {\n" +
        "  const box = useNarrow();\n" +
        "  return <div ref={box.ref} style={{ width: box.narrow ? 360 : 1120 }}/>;\n" +
        "}",
      errors: [{ messageId: "measuredStyle" }],
    },
    // A spread arm: the switch is buried in `...(narrow ? A : B)`, which reads
    // as a tidy base-plus-override and is the same loop.
    {
      filename: RING,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        '  return <div ref={ref} style={narrow ? { ...base, inset: 0 } : { ...base, maxWidth: 360 }}/>;\n' +
        "}",
      errors: [{ messageId: "measuredStyleSwitch" }],
    },
    // `style={narrow && {…}}` — an object in one arm and nothing in the other
    // is a switch with an empty alternate.
    {
      filename: RING,
      code:
        "function A() {\n" +
        "  const { ref, narrow } = useNarrow();\n" +
        "  return <div ref={ref} style={narrow && { position: \"fixed\", inset: 0 }}/>;\n" +
        "}",
      errors: [{ messageId: "measuredStyleSwitch" }],
    },
  ],
});
