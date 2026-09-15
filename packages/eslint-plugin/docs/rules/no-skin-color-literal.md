# `stapel/no-skin-color-literal`

> A colour written down in a skin is a colour one of the two themes will get wrong.

- **Type:** problem
- **Recommended:** yes — `error` in `configs.recommended` and `configs.strict`, on
  `**/src/default/**` only.
- **Fixable:** no. There is no mechanical map from `#ffffff` to a token role: a
  white sheet is `surface` in one place, `surface-raised` in another and a
  scrim in a third, and a codemod that guessed would produce a skin that is
  wrong in both themes instead of one.

## The worked example: `@stapel/video-react` 0.3.6

Owner report, 2026-09-14: *"in video-call mode in the dark theme everything is
very bad."* Measured on the stand — headless, `data-theme="dark"`, 1440 and 390
— `<CallRoute>`'s full-screen frame and `<IncomingCallOverlay>`'s phone arm were
filled `#ffffff` with the dark theme's light text on them: **1.09:1 on every
line**. A person on a dark page answering a call got a white rectangle with
invisible writing on it.

The fix (0.3.7) shipped a gate with it, `video-react/test/darkSkin.test.tsx`,
whose first half is a line-by-line grep of that package's `src/default/**` for a
colour literal. That is a good gate and it protects exactly one package. **This
rule is that gate for the other twenty-eight.**

## Read this before you trust a green run

The 0.3.6 defect was **not a literal**. The source said:

```tsx
const { token } = theme.useToken();          // ← ABOVE its own <SkinTheme>
<div style={{ background: token.colorBgContainer }}>
```

`token.colorBgContainer` read *above* the component's own `<SkinTheme>` is
whatever theme the **host** happens to have around it, and in a storefront that
themes through `data-theme` alone that is antd's ambient default: light,
whatever the page is. There is no `#ffffff` anywhere in that file, and this rule
would have stayed silent on it.

The theme-owner half of the seam is `stapel/no-hardcoded-theme-mode` and
`stapel/no-local-skin-theme`. The render-time half is the *second* gate in
`darkSkin.test.tsx`: render under both modes and assert the fills **move**.
Neither is replaceable by lint, and neither is replaced by this rule.

What this rule closes is the other door into the same room, and the one the
fleet walks through more often: somebody hardcodes the colour, it looks right in
the theme they had open, and the other theme gets it wrong.

## What the rule reports

Scope is `**/src/default/**` — the skin layer, via `lib/jsx.js`'s
`isDefaultSkin`, the same answer every other skin-tier rule uses so they cannot
disagree about what "the skin" means. Test and fixture paths are excluded. A
host app's own chrome is the host's business; a `headless/` layer paints
nothing.

### `styleColorLiteral` — a colour in a style object

```tsx
// ✗
<div style={{ background: "#ffffff" }} />
<div style={{ background: "white" }} />
<div style={{ filter: "drop-shadow(0 0 2px #000000)" }} />        // key is not a colour prop
<Modal styles={{ body: { background: "#fff" } }} />               // nested block
const RING_FRAME: CSSProperties = { background: "#0b0b0b" };      // annotated constant

const SHEET = "#ffffff";
<div style={{ background: SHEET }} />                             // one const hop, resolved
```

A **style object** is the expression of `style={…}`, of any `*Style`/`styles`
attribute or property, or an object literal annotated `CSSProperties` /
`CSSObject`. Identifiers are resolved through **one hop** of a same-file
`const`, so moving the hex into a tidy name does not launder it.

Inside a style object the key does **not** gate hex and `rgb()`. That is the one
place this rule is deliberately broader than `stapel/no-raw-colors`, which
grades only colour-*named* keys fleet-wide: `filter`, `backgroundImage` and
`maskImage` all carry a colour under a key that is not a colour property. The
key still gates **named** colours, where it is the only thing separating
`background: "white"` from `variant: "white"`.

### `cssTemplateColorLiteral` — a colour in a `css` / `styled` template

```tsx
// ✗
const Sheet = styled.div`
  background: #ffffff;
`;
```

### `cssStringColorLiteral` — a colour in a string that *is* css

```ts
// ✗ — listings-react builds its gallery stylesheet by concatenation
`${counter}{position:absolute;` + `background:rgba(0,0,0,0.55);color:#fff;}`
```

Gated on **declaration syntax** (`prop: value`), so an href, an id, a tracker
number (`#623`) or a regex source is never touched. A stylesheet built by
concatenation is still a stylesheet, and it is a surface `stapel/no-raw-colors`
cannot see — its template path only fires under a `css`/`styled` tag.

The report lands on the line the colour is written on, not on the line a
hundred-line template opens.

### `jsxColorPropLiteral` — a colour handed to a colour-named attribute

```tsx
// ✗
<QRCode color="#000000" bgColor="#ffffff" />
<Tag color="white">…</Tag>
```

`color`, `colour`, `bgColor`, `fill`, `stroke`, anything ending `Color`. The
other surface `no-raw-colors` cannot see: `auth-react`'s `QrCanvas.tsx` sat with
those two hexes through a `no-raw-colors` already at `error`, because that rule
reads style objects, classNames and css tags and nothing else.

**antd's preset palette is exempt here, and only here.** `<Tag color="green">`
is not a raw CSS green: antd generates the preset from the active theme's seed,
so it moves with the mode exactly as a token does. Six of this rule's first
sweep hits were exactly that, on `<Tag>`s whose meaning is a status — and a rule
that tells a pair to "tokenise" something already theme-derived is a rule they
switch off. The exemption covers antd's thirteen preset keys (`blue`, `purple`,
`cyan`, `green`, `magenta`, `pink`, `red`, `orange`, `yellow`, `volcano`,
`geekblue`, `lime`, `gold`) **on a JSX colour prop**. In a style object
`background: "green"` is raw CSS with no antd in the path and stays reported;
and the names antd has no preset for — `white`, `black`, `gray`, `grey`,
`silver`, `beige` — stay reported everywhere. Those are the family the dark
theme actually gets wrong.

## What it provably cannot catch

- **A colour that is not a literal.** `token.colorBgContainer` read in the wrong
  place — the 0.3.6 defect itself — a colour arriving as a prop, a colour
  computed from a `hue` read out of a vocabulary. `search-react`'s swatches are
  data and stay silent by design.
- **A colour literal in another module, imported.** Resolution is one hop and
  in-file: a cross-module resolver needs type information and would still miss a
  re-export.
- **A colour constant declared below its use.** The one-hop table fills as the
  traversal walks, which is the order the fleet writes anyway.
- **A colour in a `.css` / `.scss` file.** That is the stylelint half of this
  plugin (`@stapel/eslint-plugin/stylelint`).
- **A colour inside an SVG served as an asset, or a base64 data URI.**
- **A colour that is wrong but tokenised.** A token used for the wrong role
  reads exactly like a token used for the right one.
- **A lookup table of colours that never reaches a style object as a literal.**
  `attributes-react`'s `CATEGORY_SWATCH` is eighteen hexes and is silent,
  because the paint reaches the DOM as a variable and the rule sees a map. That
  is a deliberate precision choice, not an oversight: the alternative flags
  every colour vocabulary in the fleet.

## The escape

Some colours genuinely are not theme decisions:

```tsx
// stapel-color-literal: a QR code's camera contrast is a functional
// requirement, not decor, and must not follow dark mode into low-contrast
// token colours.
const quietZone = { background: "#ffffff", padding: spacing[4] };
```

A marker covers **every colour inside the statement it is attached to** — one
tag for a twenty-line CSS template — and it must carry a reason of at least 8
characters. A bare `// stapel-color-literal:` (or `// stapel-color-literal: ok`)
silences nothing and is reported in its own right as `emptyMarker`, alongside
the colour, because the author has two things to do.

A single line may instead use the plugin's ordinary disable, whose reason
`stapel/require-disable-description` already enforces:

```tsx
// eslint-disable-next-line stapel/no-skin-color-literal -- scrim over a photo
```

**Why there is an escape at all.** The alternative is worse, and the fleet has
already shown what it looks like: `attributes-react` split a gradient into a
`MULTICOLOR_STOPS` constant purely so a key named `multicolor` would stop
reading as a colour property to `stapel/no-raw-colors`. A rule with no honest
escape gets routed around, and the route is invisible.

## Options

```js
"stapel/no-skin-color-literal": ["error", { include: ["/src/skins/"] }]
```

| option | default | meaning |
| --- | --- | --- |
| `include` | the shared `src/default/` convention | Path fragments that define the skin layer. A consumer whose skins live elsewhere states it here rather than switching the rule off. |

## The fleet sweep (2026-09-16)

Run at `error` over `packages/*/src/default/**` — 406 files — it reports **six**
sites in four packages. Every one of them already carried a paragraph of prose
explaining why it was deliberate, which is exactly the state a marker exists to
record mechanically. They are the migration worklist, not a wall: see
`CHANGELOG.md` for the per-hit verdict.

## Related rules

| rule | what it covers that this one does not |
| --- | --- |
| `stapel/no-raw-colors` | every file in the fleet, but only colour-*named* style keys, classNames and `css`-tagged templates. |
| `stapel/no-raw-dimensions` | the px twin — one dimension scale. |
| `stapel/no-hardcoded-theme-mode`, `stapel/no-local-skin-theme` | the theme-*owner* half of the 0.3.6 seam: who decides which mode a skin resolves. |
