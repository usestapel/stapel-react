---
"@stapel/eslint-plugin": minor
---

Two new rules: a skin may not write a colour down, and a probe may not pin a fact about somebody else's corpus.

**`stapel/no-skin-color-literal`** — `warn` in `recommended` on `**/src/default/**`, `error` in `strict`.

`@stapel/video-react` 0.3.6 drew the in-call screen on a white sheet under the dark theme's light text: **1.09:1 on every line**, measured on the stand at 1440 and 390. Its 0.3.7 fix shipped a gate with it whose first half is a line-by-line grep of that package's own `src/default/**` for a colour literal. This rule is that grep for the other twenty-eight packages.

Read the rule header before trusting a green run: **the 0.3.6 defect was not a literal.** It was `token.colorBgContainer` read *above* the component's own `<SkinTheme>`, which in a host that themes through `data-theme` alone is antd's ambient default. This rule would have stayed silent on it. The theme-owner half of that seam is `no-hardcoded-theme-mode` / `no-local-skin-theme`; the render-time half is a test that renders under both modes and asserts the fills move. What this rule closes is the other door into the same room, and the one the fleet walks through more often.

Four surfaces, two of which `stapel/no-raw-colors` — already at `error` fleet-wide — structurally cannot see: a **CSS string built by concatenation** (`cardGallery.ts` / `detailGallery.ts` assemble their stylesheets without a `css` tag) and a **colour-named JSX attribute** (`QrCanvas.tsx` has carried `color="#000000" bgColor="#ffffff"` through that rule the whole time). Inside a style object the key no longer gates hex, so `filter: "drop-shadow(0 0 2px #000)"` and `backgroundImage: "linear-gradient(#fff,#000)"` are caught too; identifiers resolve through one same-file `const` hop, so moving the hex into a tidy name does not launder it. Reports land on the line the colour is on, not on the line a hundred-line template opens.

antd's thirteen preset palette keys are exempt **on a JSX colour prop only**: `<Tag color="green">` is generated from the active theme's seed and moves with the mode, and six of the first sweep's hits were exactly that. In a style object `background: "green"` is raw CSS and stays reported, as do `white` / `black` / `gray` / `silver` everywhere — the family the dark theme actually gets wrong.

A deliberate, theme-independent colour is marked rather than disabled: `// stapel-color-literal: <why>` on the enclosing statement, covering everything inside it, with a reason of at least 8 characters — a reasonless marker is itself reported, alongside the colour. There is an escape because the alternative is already visible in the fleet: `attributes-react` split a gradient into a `MULTICOLOR_STOPS` constant purely so a key named `multicolor` would stop reading as a colour property to `no-raw-colors`. A rule with no honest escape gets routed around, and the route is invisible.

**Sweep: 406 skin files, six hits in four packages**, and every one already carries prose saying why it is deliberate — a QR code's camera contrast (`auth-react`, 3 sites), a scrim over an arbitrary photograph (`listings-react`, 2), a `var()` fallback (`attributes-react`, 1). `warn` is the sweep's verdict, not caution: an `error` turns four packages red before their owners have added six marker comments. Promote by moving one line into the `strict` block. Silent by design on `attributes-react`'s eighteen-shade colour vocabulary and `search-react`'s swatches: those are data drawn as colour, and the paint reaches the DOM as a variable.

**`stapel/no-pinned-corpus-fact`** — `error` in `recommended`, on `deploy/probes/**`, `**/probes/**`, `**/e2e/**`, `**/walkers/**`, `*.probe.*`, `*.e2e.*`. Self-scoped in the rule as well as in the preset. This repository has no probe paths, so it arms nothing here and cannot turn anything red; it ships for the fleets that do.

Two probes broke in one week on the same class. One asserted `finalCount === 390` — true on the day it was typed, and after the next reseed it reported failure on runs where cleanup had worked perfectly. The other pinned `PHONE_LISTING=1345`, a listing a reseed later deleted; because a SPA answers **200 for any `/l/<id>`**, the probe never noticed it was measuring a page about nothing and walked on through every assertion that followed.

Three shapes, chosen for precision over recall, because a rule that cries about every number in a probe gets switched off: an **equality** between a count-shaped expression and a literal ≥ 10 (relational bounds, `=== 0` and `=== 1` are silent — a bound survives a reseed, and "cleanup left nothing" is a claim about behaviour); an **id-shaped literal as a whole path segment** of a url, or as an `*id*=` query value (three or more digits, or a uuid — so `?limit=500`, `?page=2`, a 1440 viewport and a 60000 timeout are all invisible); and an **env fallback to an id** whose binding is interpolated into a url in the same file, which is what keeps `process.env.PORT || "3000"` quiet.

**Sweep: 799 probe and walker files in one client fleet, 216 hits** — 181 pinned ids, 30 pinned env defaults, 5 pinned counts. Twelve listing ids and four user uuids account for nearly all of them, the same four repeating across dozens of walkers. Two false-positive families were found by that sweep and closed before it was reported: a scratch directory whose name is a uuid is a filesystem path, not a corpus id; and a sentinel written down precisely so the probe can watch the service answer "no such thing" (`/l/9999999`, a uuid of one repeated character per group) is not a row any reseed can delete.

Both rules carry a docs page with the worked example, the exact detection boundary and an explicit list of what the rule provably cannot catch.
