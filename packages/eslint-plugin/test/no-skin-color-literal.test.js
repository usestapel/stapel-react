// The shapes here are TRANSCRIBED, not invented. The invalid cases are the
// colour literals this rule's first fleet sweep found in `packages/*/src/
// default/**` (and the shape `@stapel/video-react` 0.3.7's own gate greps
// for); the valid cases are the things that sweep had to stay silent on —
// antd's preset `<Tag color="green">`, the eighteen shades of
// `attributes-react`'s colour vocabulary, a tracker number in a comment, a
// hex-parsing regex. A rule for a production defect has to fire on the code
// that caused it and stay quiet on the code that looks like it.
import rule from "../rules/no-skin-color-literal.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const SKIN = "/repo/packages/video-react/src/default/CallPanel.tsx";
const QR = "/repo/packages/auth-react/src/default/security/QrCanvas.tsx";
const GALLERY = "/repo/packages/listings-react/src/default/detailGallery.ts";
const EDITORS = "/repo/packages/attributes-react/src/default/editors.tsx";
const HOST = "/repo/apps/storefront/src/pages/Home.tsx";
const HEADLESS = "/repo/packages/video-react/src/headless/useCall.ts";
const SKIN_TEST = "/repo/packages/video-react/src/default/__tests__/CallPanel.test.tsx";

tester.run("no-skin-color-literal", rule, {
  valid: [
    // ── video-react 0.3.7, the fix ────────────────────────────────────────
    //
    // Every fill is a token read UNDER the skin's own <SkinTheme>. This is the
    // shape the rule exists to bless, and it is what the whole in-call surface
    // looks like now.
    {
      filename: SKIN,
      code:
        "function CallPanelBody() {\n" +
        "  const { token } = theme.useToken();\n" +
        "  return (\n" +
        "    <div\n" +
        '      style={{ background: token.colorBgLayout, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorder}` }}\n' +
        "    />\n" +
        "  );\n" +
        "}",
    },
    // The allowlist: three values that name a RELATIONSHIP to the theme rather
    // than a colour, so neither mode can get them wrong.
    {
      filename: SKIN,
      code:
        'const FRAME = { background: "transparent", color: "currentColor", borderColor: "inherit" };\n' +
        "function Frame() { return <div style={FRAME} />; }",
    },
    // antd's PRESET palette on a status tag. `green` here is not raw CSS: antd
    // generates the preset from the active theme's seed, so it moves with the
    // mode. Six of the first sweep's hits were exactly this.
    {
      filename: SKIN,
      code: 'function Alive() { return <Tag color="green">alive</Tag>; }',
    },
    {
      filename: SKIN,
      code: 'function Here() { return <Tag color="blue">this device</Tag>; }',
    },
    // `attributes-react`'s colour vocabulary. Eighteen closed codes the ENGINE
    // defines (`types/hex_color/constants.py`) — the data being drawn, not
    // chrome around it. Not a style object, so not a colour decision: the
    // paint reaches the DOM as a variable, and the rule sees a lookup table.
    {
      filename: EDITORS,
      code:
        "const CATEGORY_SWATCH = {\n" +
        '  black: "#000000",\n' +
        '  white: "#ffffff",\n' +
        '  red: "#e53935",\n' +
        '  clear: "transparent",\n' +
        "};\n" +
        "function Swatch(props) {\n" +
        '  const paint = CATEGORY_SWATCH[props.code] ?? "transparent";\n' +
        "  return <span style={{ background: paint }} />;\n" +
        "}",
    },
    // A tracker number and a colour NAMED in prose. `#623` is three hex digits
    // and `white` is a word; neither is paint. Comments are not code.
    {
      filename: SKIN,
      code:
        "// A row reading `#623 · Draft` was handed a link to a listing that was\n" +
        "// a white sheet under the dark theme.\n" +
        "const ROW = { padding: 8 };",
    },
    // A hex PARSER, not a hex value (`search-react/src/default/swatches.ts`).
    {
      filename: SKIN,
      code: "const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;\nexport function isHex(v) { return HEX.test(v); }",
    },
    // An href and an anchor fragment — strings with a `#` and no CSS in sight.
    {
      filename: SKIN,
      code: 'const DOCS = "https://stapel.dev/guide#colors";\nconst ANCHOR = "#abc";',
    },
    // A marked statement. The marker carries a reason, so it covers every
    // colour inside the statement it is attached to.
    {
      filename: QR,
      code:
        "// stapel-color-literal: a QR code's camera contrast is a functional\n" +
        "// requirement, not decor, and must not follow dark mode.\n" +
        'const quietZone = { background: "#ffffff", padding: 16 };\n' +
        "function QrCanvas() { return <div style={quietZone} />; }",
    },
    // One marker over a whole stylesheet template.
    {
      filename: GALLERY,
      code:
        "export function galleryCss() {\n" +
        "  // stapel-color-literal: the counter pill sits on an arbitrary\n" +
        "  // PHOTOGRAPH, which is neither light nor dark.\n" +
        "  return `\n" +
        ".counter { position: absolute; background: rgba(0, 0, 0, 0.55); color: #fff; }\n" +
        "`;\n" +
        "}",
    },
    // A JSDoc marker on a function covers the colours in its body.
    {
      filename: QR,
      code:
        "/** stapel-color-literal: pure black on pure white is what a camera reads. */\n" +
        "function Qr() { return <QRCode color=\"#000000\" bgColor=\"#ffffff\" />; }",
    },
    // OUT OF SCOPE — a host app's own chrome is the host's business.
    {
      filename: HOST,
      code: 'function Hero() { return <div style={{ background: "#ffffff" }} />; }',
    },
    // OUT OF SCOPE — a headless layer paints nothing, so a hex there is data.
    {
      filename: HEADLESS,
      code: 'export const BRAND = { background: "#4657d9" };',
    },
    // OUT OF SCOPE — a fixture's job is to BE the forbidden shape.
    {
      filename: SKIN_TEST,
      code: 'it("paints", () => { render(<div style={{ background: "#fff" }} />); });',
    },
    // A named colour that is NOT the whole value, and a key that is not a
    // colour property: `variant: "white"` is a variant name.
    {
      filename: SKIN,
      code: 'function Card() { return <div style={{ variant: "white", label: "red" }} />; }',
    },
    // A string with a colon that is not CSS.
    {
      filename: SKIN,
      code: 'const LABEL = "warning: the session is white-listed";',
    },
    // An explicit `include` that does not name this path switches the rule off
    // for it — the documented way a consumer whose skins live elsewhere scopes
    // the rule, rather than disabling it.
    {
      filename: SKIN,
      code: 'function C() { return <div style={{ background: "#fff" }} />; }',
      options: [{ include: ["/src/skins/"] }],
    },
  ],

  invalid: [
    // ── the shape video-react 0.3.7's own gate greps for ──────────────────
    {
      filename: SKIN,
      code: 'function CallRoute() { return <div style={{ background: "#ffffff" }} />; }',
      errors: [{ messageId: "styleColorLiteral", data: { value: "#ffffff", property: "background" } }],
    },
    // Laundered through a tidy constant. One hop, same answer.
    {
      filename: SKIN,
      code:
        'const SHEET = "#ffffff";\n' +
        "function CallRoute() { return <div style={{ background: SHEET }} />; }",
      errors: [{ messageId: "styleColorLiteral" }],
    },
    // Laundered through a style-object constant, used at the JSX site.
    {
      filename: SKIN,
      code:
        'const FRAME = { position: "fixed", inset: 0, background: "#fff" };\n' +
        "function Ring() { return <div style={FRAME} />; }",
      errors: [{ messageId: "styleColorLiteral" }],
    },
    // A named colour as the WHOLE value of a colour property.
    {
      filename: SKIN,
      code: 'function Sheet() { return <div style={{ background: "white" }} />; }',
      errors: [{ messageId: "styleColorLiteral", data: { value: "white", property: "background" } }],
    },
    // A `CSSProperties`-annotated module constant, never used from JSX in this
    // file — graded where it is written, because that is where it is wrong.
    {
      filename: SKIN,
      code: 'const RING_FRAME: CSSProperties = { position: "fixed", inset: 0, background: "#0b0b0b" };',
      errors: [{ messageId: "styleColorLiteral" }],
    },
    // THE DELTA OVER `stapel/no-raw-colors`, part one: a colour under a key
    // that is not a colour property. `no-raw-colors` grades only colour-named
    // keys and cannot see this.
    {
      filename: SKIN,
      code: 'function Shadowed() { return <div style={{ filter: "drop-shadow(0 0 2px #000000)" }} />; }',
      errors: [{ messageId: "styleColorLiteral", data: { value: "#000000", property: "filter" } }],
    },
    {
      filename: SKIN,
      code: 'function Fade() { return <div style={{ backgroundImage: "linear-gradient(#ffffff, #000000)" }} />; }',
      errors: [{ messageId: "styleColorLiteral", data: { value: "#ffffff", property: "backgroundImage" } }],
    },
    // THE DELTA, part two: a colour-named JSX ATTRIBUTE. `QrCanvas.tsx` sat
    // with these two through a `no-raw-colors` already at `error`.
    {
      filename: QR,
      code: 'function Qr() { return <QRCode color="#000000" bgColor="#ffffff" />; }',
      errors: [
        { messageId: "jsxColorPropLiteral", data: { value: "#000000", property: "color" } },
        { messageId: "jsxColorPropLiteral", data: { value: "#ffffff", property: "bgColor" } },
      ],
    },
    // A named colour antd has NO preset for is raw CSS wherever it is written.
    {
      filename: SKIN,
      code: 'function Sheet() { return <Tag color="white">x</Tag>; }',
      errors: [{ messageId: "jsxColorPropLiteral", data: { value: "white", property: "color" } }],
    },
    // THE DELTA, part three: a stylesheet built by concatenation rather than
    // through a `css` tag — `cardGallery.ts`'s shape.
    {
      filename: GALLERY,
      code:
        "export function css(counter) {\n" +
        "  return `${counter}{position:absolute;` + `background:rgba(0,0,0,0.55);color:#fff;}`;\n" +
        "}",
      errors: [{ messageId: "cssStringColorLiteral", data: { value: "rgba(0,0,0,0.55)", property: "a colour prop" } }],
    },
    // The same thing as one multi-line template — and the report lands on the
    // line the colour is on, not on the line the template opens.
    {
      filename: GALLERY,
      code:
        "export function css() {\n" +
        "  return `\n" +
        ".frame { position: relative; }\n" +
        ".counter { color: #fff; }\n" +
        "`;\n" +
        "}",
      errors: [{ messageId: "cssStringColorLiteral", line: 4 }],
    },
    // A named colour as a whole CSS declaration value.
    {
      filename: GALLERY,
      code: "export const CSS = `.counter { color: white; }`;",
      errors: [{ messageId: "cssStringColorLiteral", data: { value: "white", property: "a colour prop" } }],
    },
    // A `css`/`styled` tagged template.
    {
      filename: SKIN,
      code: "const Sheet = styled.div`\n  background: #ffffff;\n`;",
      errors: [{ messageId: "cssTemplateColorLiteral", data: { value: "#ffffff", property: "a colour prop" } }],
    },
    // A nested style block under antd's `styles={{ … }}`.
    {
      filename: SKIN,
      code: 'function Sheet() { return <Modal styles={{ body: { background: "#fff" } }} />; }',
      errors: [{ messageId: "styleColorLiteral" }],
    },
    // A template hole resolved through a same-file constant —
    // `attributes-react`'s `border: \`1px solid ${GROUP_BORDER}\`` exactly.
    {
      filename: EDITORS,
      code:
        'const GROUP_BORDER = "var(--stapel-border, rgba(128,128,128,0.35))";\n' +
        "function Group() { return <div style={{ border: `1px solid ${GROUP_BORDER}` }} />; }",
      errors: [{ messageId: "styleColorLiteral", data: { value: "rgba(128,128,128,0.35)", property: "border" } }],
    },
    // A REASONLESS marker silences nothing, and says so — two reports, because
    // the author has two things to do.
    {
      filename: QR,
      code:
        "// stapel-color-literal:\n" +
        'const quietZone = { background: "#ffffff" };\n' +
        "function Qr() { return <div style={quietZone} />; }",
      errors: [{ messageId: "emptyMarker" }, { messageId: "styleColorLiteral" }],
    },
    // …and a marker whose "reason" is a shrug.
    {
      filename: QR,
      code:
        "// stapel-color-literal: ok\n" +
        'const quietZone = { background: "#ffffff" };\n' +
        "function Qr() { return <div style={quietZone} />; }",
      errors: [{ messageId: "emptyMarker" }, { messageId: "styleColorLiteral" }],
    },
    // An `include` that DOES name the path arms the rule outside `src/default`.
    {
      filename: "/repo/packages/video-react/src/skins/Call.tsx",
      code: 'function C() { return <div style={{ background: "#fff" }} />; }',
      options: [{ include: ["/src/skins/"] }],
      errors: [{ messageId: "styleColorLiteral" }],
    },
  ],
});
