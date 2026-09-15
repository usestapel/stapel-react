// stapel/no-self-measuring-ref — a measurement must not decide the size of the
// thing it measures.
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
//
// `@stapel/video-react`'s `<IncomingCallOverlay>` picked full-screen or card
// from `useNarrow()`, and the observed ref sat on the dialog whose own width
// that choice SETS:
//
//     const { ref, narrow } = useNarrow<HTMLDivElement>();
//     <div ref={ref} style={narrow ? { inset: 0 } : { maxWidth: 360 }}>
//
// 1440 says "card". The card is 360 across. 360 says "full-screen".
// Full-screen is 1440 across. 1440 says "card". There is no fixed point, so
// the overlay flipped arm on every animation frame, and because the two arms
// are different trees React rebuilt the subtree each time — the stand counted
// 120 distinct accept-button DOM nodes over 120 frames, the button jumping
// between x=1250 and x=728. A pointer press and its release on two different
// nodes never become a `click`, so the accept button was unpressable, no
// `POST /calls/<id>/accept` was ever issued, and every desktop call rang until
// the server timed it out as missed.
//
// At 390 there was no loop — the full-screen arm measures 390, which is still
// narrow — so the phone sat on the one stable arm. That is why the defect was
// invisible on the width everyone tested, and why this is a lint rule rather
// than a thing anybody was ever going to notice by looking.
//
// Fixed in video-react 0.3.7 by measuring a full-bleed frame whose style is
// byte-identical in both arms, with the dialog inside it.
//
// ── WHAT TO WRITE INSTEAD ───────────────────────────────────────────────────
//
//     <div ref={ref} style={RING_FRAME}>          {/* same in both arms */}
//       <div style={narrow ? fullscreen : card}>  {/* the arms, INSIDE */}
//
// Measure a wrapper the layout sizes — full-bleed, `width: 100%`, the host's
// column — and let the arms differ inside it.
//
// ── THE DETECTION BOUNDARY (read this before trusting a green run) ──────────
//
// The rule is deliberately narrow and in-component. It reports only when all
// of these are visible in ONE function body:
//
//   1. a measuring-hook binding — `useNarrow()`, `useElementWidth(ref, …)`,
//      or any name in `options.hooks` — in either of the two shapes the fleet
//      uses (the hook HANDS BACK a ref, or the hook TAKES one);
//   2. a JSX `ref={…}` attribute naming that ref;
//   3. that same element's own WIDTH depending on the hook's measured value,
//      through a local `const` chain of any depth.
//
// (3) is one of four things, each its own message:
//
//   `measuredStyle`  — a width-affecting style property on the ref element
//                      whose value depends on the measurement, or a whole
//                      `style={measured ? A : B}` whose two object literals
//                      DIFFER in a width-affecting property.
//   `measuredClass`  — `className`/`class` on the ref element depending on the
//                      measurement. A class can set any width and the CSS is
//                      not visible from here, so this one is deliberately an
//                      over-approximation; it is the only one.
//   `measuredBranch` — the ref element is rendered only inside a ternary, a
//                      `&&`, or an `if`-return arm taken on the measurement,
//                      and the ref is attached ONCE. An element that exists in
//                      one arm and not the other has no stable width by
//                      construction.
//   `measuredArms`   — the component returns the measured element from several
//                      paths and those paths DISAGREE about a width-affecting
//                      property. Returning the measured box from three arms is
//                      fine (`SkinDataTable` does it: React keeps the node at
//                      the same tree position, so the ref survives); having it
//                      be a different size on each is the same loop wearing an
//                      early-return costume.
//
// "Width-affecting" is an ALLOWLIST (`WIDTH_PROPS` below), not a denylist of
// safe properties. That is what keeps `CallPanel`'s frame quiet: it is
// `width: "100%"` with `aspectRatio: narrow ? "3 / 4" : "16 / 9"`, and an
// aspect ratio on a box whose width is pinned changes only its HEIGHT. A
// denylist would have flagged it, the pair would have disabled the rule, and
// the rule would then guard nothing.
//
// The allowlist is narrower than "properties with a width in them", for the
// same reason. `flexDirection`/`flexWrap` are absent: they lay out the
// element's CHILDREN. `display` is present but judged on its VALUES —
// block → flex → grid is three block-level boxes, all of which fill the same
// parent, while inline-block, table and `none` genuinely change the box's own
// width. Both of those were false positives on this rule's first sweep, on
// `@stapel/tokens-antd`'s `SkinDataTable`, and both are pinned as valid cases
// in the test suite.
//
// ── WHAT IT PROVABLY CANNOT CATCH ───────────────────────────────────────────
//
// Say so out loud, because a rule whose limits are unwritten gets read as a
// proof:
//
//   * ACROSS FILES. `<Frame ref={ref}/>` where `Frame` is another component
//     that sizes itself from a prop derived from the measurement. The rule
//     never leaves the function body; a cross-file version would need type
//     information and would be guessing about every forwarded ref in the
//     fleet.
//   * THROUGH CSS. `className={"ring"}` (constant) where `.ring` is sized by
//     a stylesheet, or a `data-variant={narrow ? …}` attribute that a
//     stylesheet keys off. The tainted-className case above is caught; a
//     constant class whose CSS varies is not, and cannot be without reading
//     the CSS.
//   * SHRINK-TO-FIT BOXES. An `inline-block` / absolutely-positioned box with
//     no `width` takes its width from its CONTENT, so changing the children by
//     the measurement is a loop with no width property in sight. Undecidable
//     statically — that is a layout fact, not a syntactic one.
//   * AN OPAQUE STYLE. `style={styleFor(narrow)}` or `style={narrow ? a : b}`
//     where an arm is not a resolvable object literal. The rule does not
//     report what it cannot read; it would be a coin flip.
//   * THROUGH AN ANCESTOR'S SIZE. The ref element is `width: 100%` of a PARENT
//     whose width the same measurement sets. Same loop, one element up, and
//     invisible unless the parent is in the same component (it usually is not).
//   * A REF THREADED THROUGH A VARIABLE, a callback ref that forwards to the
//     hook's (`ref={(n) => { containerRef(n); mine(n); }}`), or a ref merged by
//     a helper. `ref={ref}` and `ref={box.ref}` are recognised; anything else
//     is not.
//   * THE HEIGHT TWIN. Every hook in this fleet measures WIDTH; a hook that
//     decided a layout from HEIGHT would need the mirror-image property list.
//     Add the hook to `options.hooks` and the rule still catches the branch
//     and class cases — only the style-property case is width-shaped.
//
// The gate that actually proves the fix for one component is the component's
// own test (`video-react/test/ringWidth.test.tsx`: the measured element's
// style must be identical in both arms, and nothing the arms redraw may be
// observed). This rule is the fleet-wide net under it, not a replacement.

/**
 * The hooks in this repo that hand out a measurement of an element.
 *
 * Enumerated, not guessed: every one of these is a real hook in a real
 * package (`grep -rn 'ResizeObserver' packages/<pair>/src`). Two shapes, both
 * supported, because the fleet uses both:
 *
 *   ref HANDED BACK   `const { ref, narrow } = useNarrow()`
 *                     `const { containerRef, stacked } = useSplitLayout()`
 *   ref TAKEN         `const { below } = useElementWidth(boxRef, {…})`
 *
 * `useElementWidth` is BOTH: the canonical one in `@stapel/tokens-antd/skin`
 * takes a ref, and four pairs still ship a local copy that returns one. The
 * rule decides per call site rather than per name.
 */
const DEFAULT_HOOKS = [
  // @stapel/tokens-antd/skin — the fleet's one element-width measurement.
  "useElementWidth",
  // video-react: the narrow/wide question, the hook this defect was found on.
  "useNarrow",
  // docs-react: master/detail stacking, via a callback ref.
  "useSplitLayout",
  // @stapel/image: the slot an image is drawn into.
  "useImageSlot",
  // geo-react: the tile map's viewport box.
  "useElementBox",
  // listings-react / search-react: rail geometry.
  "useRailEdges",
  "useRailFits",
  // Names the fleet does not use yet but that mean exactly this, so a pair
  // that reaches for the usual one is covered on the day it writes it.
  "useElementSize",
  "useResizeObserver",
  "useContainerWidth",
  "useBoundingRect",
  "useMeasure",
];

/**
 * Style properties that can change the element's own WIDTH.
 *
 * An allowlist on purpose — see the header. `height`, `minHeight`,
 * `maxHeight`, `aspectRatio`, every colour, `borderRadius`, `boxShadow`,
 * `opacity`, `zIndex`, `pointerEvents`, `alignItems`, `justifyContent`,
 * `gap` and `fontSize` are all absent, and each absence is a decision:
 * none of them changes the width of a box whose width the layout already
 * pinned, and `aspectRatio` in particular is `CallPanel`'s legitimate shape.
 *
 * `transform` is IN: `getBoundingClientRect().width` — the synchronous first
 * read every one of these hooks does — includes it, even though
 * `ResizeObserver`'s `contentRect` does not.
 */
const WIDTH_PROPS = new Set([
  "width",
  "minWidth",
  "maxWidth",
  "inlineSize",
  "minInlineSize",
  "maxInlineSize",
  "flex",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  // `flexDirection` / `flexWrap` are DELIBERATELY absent: they lay out the
  // element's CHILDREN and leave the element's own width alone — unless it is
  // shrink-to-fit, which this rule already lists as out of reach. Their
  // presence was the second false positive on the first sweep
  // (`SkinDataTable`'s cards arm is a flex column, its table arm a plain
  // block, and both fill the same parent).
  "display",
  "position",
  "boxSizing",
  "float",
  "zoom",
  "transform",
  "scale",
  "inset",
  "insetInline",
  "insetInlineStart",
  "insetInlineEnd",
  "left",
  "right",
  "padding",
  "paddingLeft",
  "paddingRight",
  "paddingInline",
  "paddingInlineStart",
  "paddingInlineEnd",
  "margin",
  "marginLeft",
  "marginRight",
  "marginInline",
  "marginInlineStart",
  "marginInlineEnd",
  "border",
  "borderLeft",
  "borderRight",
  "borderWidth",
  "borderLeftWidth",
  "borderRightWidth",
  "borderInline",
  "borderInlineWidth",
  "gridTemplateColumns",
  "gridColumn",
  "gridArea",
  "columns",
  "columnCount",
  "columnWidth",
  "overflow",
  "overflowX",
  "writingMode",
  "direction",
  "containerType",
  "contain",
]);

/** `ref`, `boxRef`, `containerRef`, `frameRef` — the name a ref is handed out
 * under. Used on the destructuring KEY, never on the local alias, so
 * `{ ref: frameRef }` and `{ narrow: measured }` are both read correctly. */
const REF_NAME_RE = /^(?:ref|.*[Rr]ef)$/;

/** Key prefix for a spread this rule could not read into. Never a real CSS
 * property, so it can never collide with one. */
const OPAQUE_SPREAD = " spread:";

/**
 * `display` values that change the element's OWN width.
 *
 * A block-level box fills its parent's inline size whatever kind of box it is,
 * so `block` -> `flex` -> `grid` -> `flow-root` is not a width change and must
 * not be reported — `SkinDataTable`'s cards arm is a flex column and its table
 * arm a plain block, and both fill the same parent. Going inline-level, to a
 * table, or out of the tree altogether IS one: the box then takes its width
 * from its content, or has none.
 */
const INLINE_LEVEL_DISPLAY = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "inline-table",
  "table",
  "table-cell",
  "table-column",
  "contents",
  "none",
]);

/**
 * Can a difference in this property actually move the element's width?
 *
 * Everything in {@link WIDTH_PROPS} can, with one exception whose VALUES have
 * to be read: `display`. `texts` are the property's source texts across the
 * arms, with `undefined` for an arm that omits it — which means the element's
 * default, and for the block-level wrappers these always are, that is
 * block-level too. A `display` switch counts only when some arm explicitly
 * names an inline-level, table or `none` value; an unreadable value counts,
 * because refusing to decide is not the same as deciding it is safe.
 */
function movesWidth(key, texts) {
  if (key !== "display") return true;
  let sawReadable = false;
  for (const text of texts) {
    if (text === undefined) continue;
    const value = String(text).trim().replace(/^["'`]|["'`]$/g, "");
    if (!/^[a-z-]+$/.test(value)) return true;
    sawReadable = true;
    if (INLINE_LEVEL_DISPLAY.has(value)) return true;
  }
  return !sawReadable;
}

/** Every string literal value in a subtree — the readable half of an
 * expression, so a `display` chosen by the measurement can be judged the same
 * way a `display` that differs between two arms is. */
function stringLiteralsIn(node, into = []) {
  if (node === null || typeof node !== "object") return into;
  if (Array.isArray(node)) {
    for (const item of node) stringLiteralsIn(item, into);
    return into;
  }
  if (typeof node.type !== "string") return into;
  if (node.type === "Literal" && typeof node.value === "string") {
    into.push(node.value);
    return into;
  }
  if (node.type === "TemplateLiteral") {
    for (const quasi of node.quasis) into.push(quasi.value.cooked ?? "");
    for (const expression of node.expressions) stringLiteralsIn(expression, into);
    return into;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    stringLiteralsIn(value, into);
  }
  return into;
}

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/** The nearest enclosing function, or null at the top level. */
function enclosingFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (FUNCTION_TYPES.has(current.type)) return current;
  }
  return null;
}

/** Is `fn` `node` itself or one of its ancestors? */
function isWithin(node, fn) {
  for (let current = node; current; current = current.parent) {
    if (current === fn) return true;
  }
  return false;
}

/** Every `Identifier` name read in a subtree, skipping the property half of a
 * non-computed member access (`props.narrow` reads `props`, not `narrow`) and
 * object-literal keys (`{ narrow: 1 }` defines a key, reads nothing). */
function identifiersIn(node, into = new Set()) {
  if (node === null || typeof node !== "object") return into;
  if (Array.isArray(node)) {
    for (const item of node) identifiersIn(item, into);
    return into;
  }
  if (typeof node.type !== "string") return into;
  if (node.type === "Identifier") {
    into.add(node.name);
    return into;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    if (node.type === "MemberExpression" && key === "property" && !node.computed) {
      continue;
    }
    if (node.type === "Property" && key === "key" && !node.computed) continue;
    if (node.type === "JSXAttribute" && key === "name") continue;
    identifiersIn(value, into);
  }
  return into;
}

/** Strip `as const`, `satisfies`, parentheses and non-null assertions. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "ChainExpression")
  ) {
    current = current.expression;
  }
  return current;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid attaching a measuring hook's ref to an element whose own width that same measurement decides — a feedback loop with no fixed point, which flips the layout every animation frame and makes every control inside it unclickable.",
      recommended: true,
      url: "https://github.com/usestapel/stapel-react/blob/main/packages/eslint-plugin/docs/rules/no-self-measuring-ref.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Extra measuring-hook names, on top of {@link DEFAULT_HOOKS}. */
          hooks: { type: "array", items: { type: "string" } },
          /** Replace the default hook list outright (an app with its own
           * vocabulary; the defaults are this repo's hooks, not a standard). */
          hooksOverride: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      measuredStyle:
        "`{{measured}}` is measured on this element, and `{{prop}}` on this same element is set from it — the measurement decides its own input. There is no fixed point: the wide arm measures narrow, the narrow arm measures wide, so the layout flips every animation frame and React rebuilds the subtree each time, which makes every control inside unclickable (a press and a release land on two different DOM nodes, so no `click` is ever dispatched). That is how `<IncomingCallOverlay>` became unanswerable on a desktop while working on a phone — the phone happened to sit on the stable arm — and the symptom was a call that rang until it timed out as missed. Measure a wrapper the LAYOUT sizes (full-bleed, `width: 100%`, the host's column) whose style is identical in both arms, and let the arms differ inside it.",
      measuredStyleSwitch:
        "`{{measured}}` is measured on this element, and this element's whole `style` switches on it — the two arms differ in {{props}}, so the measurement decides its own input. The wide arm measures narrow and the narrow arm measures wide: no fixed point, a flip every animation frame, a rebuilt subtree, and controls that cannot be clicked because a press and a release land on different nodes (`<IncomingCallOverlay>`, video-react 0.3.6: desktop calls never connected). Put the ref on a wrapper whose style is the SAME in both arms and let the arms differ inside it.",
      measuredClass:
        "`{{measured}}` is measured on this element, and this element's `{{attribute}}` is chosen from it. A class can set any width, and the stylesheet is not visible from here — if it does, the measurement decides its own input and the layout flips every animation frame, which makes every control inside unclickable. Measure a wrapper whose class does not change with the answer.",
      measuredArms:
        "`{{measured}}` is measured on this element, this component returns the measured element from more than one path, and the paths DISAGREE about {{props}} — so the measurement decides its own input. The wide arm measures narrow and the narrow arm measures wide: no fixed point, a flip every animation frame, and controls that cannot be clicked because a press and a release land on different DOM nodes. Returning the same measured box from several arms is fine — `SkinDataTable` does it — as long as its own geometry is identical in all of them. Make these agree, or measure a wrapper outside the branch.",
      measuredBranch:
        "`{{measured}}` is measured on this element, and this element is only rendered when `{{measured}}` takes one value — so in the other arm it does not exist, and its width is decided by the very answer it produces. There is no fixed point; the layout flips every animation frame and React rebuilds the subtree, so controls inside it cannot be clicked. Render the measured wrapper unconditionally and branch INSIDE it.",
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const hookNames = new Set(
      options.hooksOverride ?? [...DEFAULT_HOOKS, ...(options.hooks ?? [])]
    );

    /** One `const {…} = useNarrow()` / `useElementWidth(ref, …)` site. */
    const measurements = [];
    /** Every `const` declarator, bucketed by its enclosing function, so a
     * measured value can be followed through an alias chain of any depth. */
    const declaratorsByFunction = new Map();
    /** Every JSX `ref={…}` attribute in the file. */
    const refAttributes = [];
    /** Module- and function-scope `const X = <object literal>` by name, so
     * `style={RING_FRAME}` and `style={narrow ? FULL : CARD}` are readable. */
    const objectConstants = new Map();

    function recordDeclarator(declarator) {
      const fn = enclosingFunction(declarator);
      const bucket = declaratorsByFunction.get(fn);
      if (bucket === undefined) declaratorsByFunction.set(fn, [declarator]);
      else bucket.push(declarator);
    }

    /** `{ ref, narrow: measured }` → the ref key's local name + the measured
     * local names. Returns null when nothing measured is bound. */
    function readPattern(pattern) {
      if (pattern.type === "Identifier") {
        // `const box = useNarrow()` — ref is `box.ref`, measured is every
        // other member read off `box`. Modelled by tainting `box` itself:
        // any width that mentions `box` mentions the measurement.
        return { refName: null, refObject: pattern.name, measured: [pattern.name] };
      }
      if (pattern.type !== "ObjectPattern") return null;
      let refName = null;
      const measured = [];
      for (const property of pattern.properties) {
        if (property.type !== "Property" || property.computed) continue;
        if (property.key.type !== "Identifier") continue;
        const local =
          property.value.type === "Identifier"
            ? property.value.name
            : property.value.type === "AssignmentPattern" &&
                property.value.left.type === "Identifier"
              ? property.value.left.name
              : null;
        if (local === null) continue;
        if (REF_NAME_RE.test(property.key.name)) refName = local;
        else measured.push(local);
      }
      if (measured.length === 0 && refName === null) return null;
      return { refName, refObject: null, measured };
    }

    /** The first argument, when it is a ref the caller already holds
     * (`useElementWidth(boxRef, …)`). */
    function refArgumentName(call) {
      const first = unwrap(call.arguments[0]);
      if (first === undefined || first === null) return null;
      if (first.type !== "Identifier") return null;
      return REF_NAME_RE.test(first.name) ? first.name : null;
    }

    /**
     * Local names that carry the measurement, to a fixpoint over `const`
     * aliases in the same function.
     *
     * This is not a nicety. `<IncomingCallOverlay>` binds
     * `const { ref, narrow: measured } = useNarrow()` and then writes
     * `const narrow = variant === "auto" ? measured : variant === "fullscreen"`
     * — the name the style actually reads is two hops from the hook. A rule
     * that only knew the hook's own binding would have missed the very defect
     * it exists for.
     */
    function taintedNames(measurement) {
      const tainted = new Set(measurement.measured);
      const declarators = declaratorsByFunction.get(measurement.fn) ?? [];
      let changed = true;
      while (changed) {
        changed = false;
        for (const declarator of declarators) {
          if (declarator.id.type !== "Identifier") continue;
          if (tainted.has(declarator.id.name)) continue;
          if (declarator.init === null || declarator.init === undefined) continue;
          for (const name of identifiersIn(declarator.init)) {
            if (!tainted.has(name)) continue;
            tainted.add(declarator.id.name);
            changed = true;
            break;
          }
        }
      }
      // The ref itself is not a measurement — `ref={ref}` must not taint the
      // element that holds it.
      if (measurement.refName !== null) tainted.delete(measurement.refName);
      return tainted;
    }

    const dependsOn = (node, tainted) => {
      if (node === null || node === undefined) return false;
      for (const name of identifiersIn(node)) if (tainted.has(name)) return true;
      return false;
    };

    /** An identifier naming a `const` bound to an object literal resolves to
     * that literal; everything else is itself. One hop is enough for every
     * shape the fleet writes (`style={RING_FRAME}`). */
    function resolveObject(node) {
      const inner = unwrap(node);
      if (inner === null || inner === undefined) return inner;
      if (inner.type === "Identifier") {
        const target = objectConstants.get(inner.name);
        return target ?? inner;
      }
      return inner;
    }

    /**
     * Width-affecting properties of an object literal → source text, flattening
     * resolvable spreads. Returns null when the node is not readable at all.
     *
     * An UNRESOLVABLE spread (`{ ...base, inset: 0 }`, where `base` is a prop
     * or an import) is recorded as an opaque marker keyed by its source text
     * rather than giving up on the whole object. Two arms that spread the same
     * `base` then compare equal on it and differ only where they visibly
     * differ — which is the shape a "tidy base plus override" refactor takes,
     * and abandoning it there would have let the defect through a rename.
     */
    function widthPropsOf(node, sourceCode, seen = new Set()) {
      const object = resolveObject(node);
      if (!object || object.type !== "ObjectExpression") return null;
      if (seen.has(object)) return new Map();
      seen.add(object);
      const found = new Map();
      for (const property of object.properties) {
        if (property.type === "SpreadElement") {
          const nested = widthPropsOf(property.argument, sourceCode, seen);
          if (nested === null) {
            found.set(
              `${OPAQUE_SPREAD}${sourceCode.getText(property.argument)}`,
              "opaque"
            );
            continue;
          }
          for (const [key, text] of nested) found.set(key, text);
          continue;
        }
        if (property.type !== "Property" || property.computed) continue;
        const key =
          property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal"
              ? String(property.key.value)
              : null;
        if (key === null || !WIDTH_PROPS.has(key)) continue;
        found.set(key, sourceCode.getText(property.value));
      }
      return found;
    }

    /** The JSX attribute value expression, or null for a bare/string attribute. */
    function attributeExpression(attribute) {
      const value = attribute.value;
      if (value === null || value === undefined) return null;
      if (value.type !== "JSXExpressionContainer") return null;
      if (value.expression.type === "JSXEmptyExpression") return null;
      return value.expression;
    }

    /**
     * Does this `ref={…}` name the measurement's ref?
     * `ref={ref}` and `ref={box.ref}` — nothing else (see the header).
     */
    function namesRef(expression, measurement) {
      const inner = unwrap(expression);
      if (!inner) return false;
      if (inner.type === "Identifier") {
        return measurement.refName !== null && inner.name === measurement.refName;
      }
      if (inner.type === "MemberExpression" && !inner.computed) {
        if (measurement.refObject === null) return false;
        if (inner.object.type !== "Identifier") return false;
        if (inner.object.name !== measurement.refObject) return false;
        return (
          inner.property.type === "Identifier" &&
          REF_NAME_RE.test(inner.property.name)
        );
      }
      return false;
    }

    /**
     * The conditional ancestor, if any, that renders this element only when the
     * measurement takes one value — searched up to the function the hook was
     * bound in, never past it.
     */
    function measuredBranchAncestor(node, measurement, tainted) {
      let child = node;
      for (let current = node.parent; current; current = current.parent) {
        if (current === measurement.fn) return null;
        if (current.type === "ConditionalExpression") {
          if (
            (child === current.consequent || child === current.alternate) &&
            dependsOn(current.test, tainted)
          ) {
            return current;
          }
        } else if (current.type === "LogicalExpression") {
          if (child === current.right && dependsOn(current.left, tainted)) {
            return current;
          }
        } else if (current.type === "IfStatement") {
          if (
            (child === current.consequent || child === current.alternate) &&
            dependsOn(current.test, tainted)
          ) {
            return current;
          }
        }
        child = current;
      }
      return null;
    }

    return {
      VariableDeclarator(node) {
        recordDeclarator(node);
        if (
          node.id.type === "Identifier" &&
          node.init !== null &&
          node.init !== undefined
        ) {
          const init = unwrap(node.init);
          if (init && init.type === "ObjectExpression") {
            objectConstants.set(node.id.name, init);
          }
        }
        const init = unwrap(node.init);
        if (!init || init.type !== "CallExpression") return;
        if (init.callee.type !== "Identifier") return;
        if (!hookNames.has(init.callee.name)) return;
        const bound = readPattern(node.id);
        if (bound === null) return;
        // The ref-TAKING shape wins when both are present: a hook called with
        // a ref is observing THAT element, whatever else it hands back.
        const passed = refArgumentName(init);
        measurements.push({
          hook: init.callee.name,
          refName: passed ?? bound.refName,
          refObject: passed !== null ? null : bound.refObject,
          measured: bound.measured,
          fn: enclosingFunction(node),
          node,
        });
      },

      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "ref") return;
        const expression = attributeExpression(node);
        if (expression === null) return;
        refAttributes.push({ attribute: node, expression });
      },

      "Program:exit"() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        for (const measurement of measurements) {
          if (measurement.refName === null && measurement.refObject === null) {
            continue;
          }
          const tainted = taintedNames(measurement);
          if (tainted.size === 0) continue;
          const measuredLabel = measurement.measured.join("`/`");

          // Every element in this component that carries this measurement's
          // ref. Usually one; more than one means the component RETURNS the
          // measured box from several paths.
          const matches = [];
          for (const { attribute, expression } of refAttributes) {
            if (!namesRef(expression, measurement)) continue;
            // Same component only. A ref that escapes its function is exactly
            // the cross-component case this rule refuses to guess about.
            if (measurement.fn !== null && !isWithin(attribute, measurement.fn)) {
              continue;
            }
            const element = attribute.parent;
            if (!element || element.type !== "JSXOpeningElement") continue;
            matches.push({ attribute, element });
          }

          // ── the box returned from several paths ───────────────────────────
          //
          // `SkinDataTable` returns `<div ref={ref} style={{minWidth: 0, …}}>`
          // from THREE arms — empty, table, cards — and the arm is chosen by
          // the measurement. That is not a loop: React sees a `div` at the
          // same tree position every time, so the node and the ref survive,
          // and the three styles are byte-identical, so the width the observer
          // reports cannot move. Reporting it as a branch defect was this
          // rule's first false positive, found on its own first sweep.
          //
          // What still matters when the ref is attached more than once is
          // whether the arms AGREE about the geometry. So the branch check is
          // replaced, not dropped: compare the arms' width-affecting styles
          // and report only a real disagreement.
          if (matches.length > 1) {
            const maps = matches.map(({ element }) => {
              const styleAttribute = element.attributes.find(
                (a) =>
                  a.type === "JSXAttribute" &&
                  a.name.type === "JSXIdentifier" &&
                  a.name.name === "style"
              );
              const value =
                styleAttribute === undefined
                  ? null
                  : attributeExpression(styleAttribute);
              if (value === null) return new Map();
              return widthPropsOf(unwrap(value), sourceCode);
            });
            if (!maps.some((map) => map === null)) {
              const keys = new Set();
              for (const map of maps) for (const key of map.keys()) keys.add(key);
              const differing = [...keys]
                .filter((key) => !key.startsWith(OPAQUE_SPREAD))
                .filter((key) => {
                  const first = maps[0].get(key);
                  if (!maps.some((map) => map.get(key) !== first)) return false;
                  return movesWidth(
                    key,
                    maps.map((map) => map.get(key))
                  );
                })
                .sort();
              if (differing.length > 0) {
                context.report({
                  node: matches[0].attribute,
                  messageId: "measuredArms",
                  data: {
                    measured: measuredLabel,
                    props: differing.map((p) => `\`${p}\``).join(", "),
                  },
                });
              }
            }
          }

          for (const { attribute, element } of matches) {
            const branch =
              matches.length > 1
                ? null
                : measuredBranchAncestor(
                    element.parent ?? element,
                    measurement,
                    tainted
                  );
            if (branch !== null) {
              context.report({
                node: attribute,
                messageId: "measuredBranch",
                data: { measured: measuredLabel },
              });
              continue;
            }

            for (const candidate of element.attributes) {
              if (candidate.type !== "JSXAttribute") continue;
              if (candidate.name.type !== "JSXIdentifier") continue;
              const name = candidate.name.name;
              const value = attributeExpression(candidate);
              if (value === null) continue;

              if (name === "className" || name === "class") {
                if (dependsOn(value, tainted)) {
                  context.report({
                    node: candidate,
                    messageId: "measuredClass",
                    data: { measured: measuredLabel, attribute: name },
                  });
                }
                continue;
              }

              if (name !== "style") continue;
              const styleNode = unwrap(value);

              // `style={measured ? A : B}` — the whole object switches. Report
              // only the width-affecting difference, so the 0.3.7 shape (two
              // arms with the same geometry) and CallPanel's aspect-ratio-only
              // arms stay silent.
              if (
                styleNode.type === "ConditionalExpression" &&
                dependsOn(styleNode.test, tainted)
              ) {
                const consequent = widthPropsOf(styleNode.consequent, sourceCode);
                const alternate = widthPropsOf(styleNode.alternate, sourceCode);
                if (consequent === null || alternate === null) continue;
                const differing = [];
                for (const key of new Set([
                  ...consequent.keys(),
                  ...alternate.keys(),
                ])) {
                  if (consequent.get(key) === alternate.get(key)) continue;
                  // An opaque spread that differs between the arms is a
                  // difference this rule cannot name, so it does not report on
                  // it alone — naming a property it cannot see would be the
                  // guess the header promises not to make.
                  if (key.startsWith(OPAQUE_SPREAD)) continue;
                  if (!movesWidth(key, [consequent.get(key), alternate.get(key)])) {
                    continue;
                  }
                  differing.push(key);
                }
                if (differing.length > 0) {
                  context.report({
                    node: candidate,
                    messageId: "measuredStyleSwitch",
                    data: {
                      measured: measuredLabel,
                      props: differing.sort().map((p) => `\`${p}\``).join(", "),
                    },
                  });
                }
                continue;
              }

              // `style={measured && {…}}` — present in one arm, absent in the
              // other, which is the same switch with an empty alternate.
              if (
                styleNode.type === "LogicalExpression" &&
                dependsOn(styleNode.left, tainted)
              ) {
                const right = widthPropsOf(styleNode.right, sourceCode);
                if (right === null) continue;
                const named = [...right.keys()]
                  .filter((key) => !key.startsWith(OPAQUE_SPREAD))
                  .sort();
                if (named.length === 0) continue;
                context.report({
                  node: candidate,
                  messageId: "measuredStyleSwitch",
                  data: {
                    measured: measuredLabel,
                    props: named.map((p) => `\`${p}\``).join(", "),
                  },
                });
                continue;
              }

              // A plain object literal: report the individual width-affecting
              // properties whose VALUE reads the measurement.
              const object = resolveObject(styleNode);
              if (!object || object.type !== "ObjectExpression") continue;
              for (const property of object.properties) {
                if (property.type !== "Property" || property.computed) continue;
                const key =
                  property.key.type === "Identifier"
                    ? property.key.name
                    : property.key.type === "Literal"
                      ? String(property.key.value)
                      : null;
                if (key === null || !WIDTH_PROPS.has(key)) continue;
                if (!dependsOn(property.value, tainted)) continue;
                // `display: narrow ? "flex" : "block"` is two block-level
                // boxes, which is not a width change; the literals decide it,
                // exactly as they do when two arms differ.
                const literals = stringLiteralsIn(property.value);
                if (!movesWidth(key, literals.length > 0 ? literals : [undefined])) {
                  continue;
                }
                context.report({
                  node: property,
                  messageId: "measuredStyle",
                  data: { measured: measuredLabel, prop: key },
                });
              }
            }
          }
        }
      },
    };
  },
};
