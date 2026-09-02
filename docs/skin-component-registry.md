# The skin component registry (`SkinProvider`)

Owner mandate (2026-08-31): «должен быть какой-то механизм дизайн-системы
(кнопки, дропдауны, ещё что-то), чтобы вместо полного оверрайда работал
рескин в одном месте и все стандартные скины на него сменились».

## The two restyle layers

The fleet restyles at two altitudes, and they are different mechanisms on
purpose:

1. **Tokens** (§68, unchanged by this work). A host's token JSON →
   `gen:tokens` → `--stapel-*` custom properties → `toAntdThemeConfig` →
   every pair's default skin re-colours and re-sizes from one file. Tokens
   answer "what colour is a primary button".
2. **The component registry** (this doc). Tokens cannot change ANATOMY: a
   host that wants its own button shape, its own bottom sheet, its own text
   field — not antd's, differently coloured — previously had to override
   default skins pair by pair, which is the "full override" the mandate
   forbids. The registry answers "what IS a button" — once, at the host root:

   ```tsx
   import { SkinProvider } from "@stapel/tokens-antd/skin";

   <SkinProvider components={{ Button: MyButton, Dialog: MySheet }}>
     <App /> {/* every pair's default skin now draws MyButton / MySheet */}
   </SkinProvider>
   ```

## Why a provider-level registry, not per-pair props

A `components` prop on every pair screen was the alternative, and it fails
the mandate arithmetic: ~30 pairs × every screen = the override written
everywhere, which is the per-pair override with extra steps, and a pair
added later ships unstyled until every host learns its new prop. The
registry inverts it: the substrate (`@stapel/tokens-antd/skin`) is the one
layer EVERY antd default skin already renders through — the same reason
`SkinTheme` and `SkinDialog` live there — so a context read at the
substrate's own render sites reaches all pairs at once, including pairs
that do not exist yet. React context is also already the codebase's idiom
for exactly this shape (`StapelProvider`, `I18nProvider`, `SiteProvider`,
`ElevationProvider`), and it gives subtree scoping for free: a nested
`SkinProvider` merges over the outer one, so one screen can carry a
different button under the same registered sheet.

## The canon set — audited, not guessed

Audit of 2026-09-02 (imports of `@stapel/tokens-antd/skin` across
`packages/*/src`, deduplicated per pair):

| substrate export | imports | pairs |
|---|---|---|
| SkinTheme | 161 | 27 |
| ErrorAlert | 115 | 23 |
| EmptyState | 86 | 22 |
| GatedButton | 64 | 20 |
| SkinDialog | 46 | 17 |
| LoadBoundary / LoadList | 46 / 43 | 17 / 16 |
| SkinConfirm | 32 | 16 |
| GatedControl | 15 | 10 |
| SkinPickerSheet / SkinNumberField / CountedInput | 5 / 2 / 1 | 2 / 1 / 1 |

Direct antd imports inside pair packages: `Button` 116 sites / 26 pairs,
`Input` 61 / 21, `Select` 36 / 20.

Everything in the top half of that table bottoms out in exactly three
primitives, so the registry ships exactly three slots:

- **`Button`** — drawn by `GatedButton`/`GatedControl`, `ErrorAlert`'s
  retry/dismiss, `EmptyState` actions passed as buttons, `SkinConfirm`'s
  arms, `RowActions`, `PermissionSheet`, the picker footer.
- **`Dialog`** — the surface `SkinDialog` renders; `SkinConfirm` and
  `SkinPickerSheet` compose `SkinDialog`, so they inherit it.
- **`Input`** — drawn by `SkinNumberField`, `CountedInput` (single-line
  arm), the picker's search box.

### Future slots, deliberately not shipped

- **`Select`** — 36 direct antd uses, but NO substrate select control to
  thread it through (the substrate's answers to "pick one" are
  `ChoiceChips` and `SkinPickerSheet`, which already inherit
  Button/Input/Dialog). A Select slot before a substrate Select is API with
  no behaviour.
- **`TextArea`** — `CountedInput`'s multiline arm stays antd.
- **`Tag`/`StatusTag`, `Table` (`DataTable`), `Typography`** — same rule:
  a slot is added when its substrate render exists and a host asks.

## The contract per slot

Each slot's props type IS the contract — `SkinButtonProps`,
`SkinInputProps`, `SkinDialogSlotProps` in
`packages/tokens-antd/src/skin/components.tsx` — with the anatomy duties
documented on the type. The load-bearing ones:

- **Button**: render a real focusable `<button>`; forward every `data-*`
  and `aria-*` (pair tests find controls by `data-testid`; `GatedControl`
  links its visible reason by `aria-describedby`); honour `disabled`,
  `loading`, `danger`, `type="primary"`; pass `ref` through (`SkinConfirm`
  places initial focus).
- **Input**: a real `<input>` controlled by `value`/`onChange`, never
  clamping or transforming the value; forward `data-*`/`aria-*`/`id`/
  `inputMode`/`placeholder`; render `suffix` (a number's unit rides there).
- **Dialog**: render `children` whenever `open` (the substrate's stamped
  body — `data-stapel-dialog-surface` — is inside them, which is why every
  pair test keeps passing under any host anatomy) in a `role="dialog"`
  element with an accessible name; every dismissal calls `onClose` and is
  labelled `dismissLabel`; `dismissible: false` means NO dismissal
  affordance; contain and restore focus; render `footer`. The substrate
  keeps resolving `surface` ("sheet" on a phone) and theming both halves —
  the replacement gets the verdict, not the viewport rule.

**Violations are loud.** In development builds an overridden slot render is
wrapped in a `display: contents` probe that inspects what actually mounted:
a replacement with no focusable button, no real input, a dropped
`data-testid`, or a dialog that never rendered its children gets a
`console.error` naming the component and the duty — once per
(slot, component, duty), never a silently broken fleet. Production builds
skip the probe and the wrapper entirely.

**Byte-stability.** With no provider (or an empty one) every substrate
render is the antd primitive with the same props as before the registry
existed. `packages/tokens-antd/test/substrateBaseline.test.tsx` pins the
exact markup with snapshots recorded BEFORE the registry landed; a diff
there is a regression, not a snapshot to update.

## How a pair consumes it

A pair consumes the registry by consuming the substrate — `GatedButton`,
`SkinConfirm`, `SkinDialog`, `ErrorAlert` etc. already flow through it with
zero pair changes. A pair's own DIRECT antd primitives migrate mechanically:

```diff
-import { Button, Flex } from "antd";
+import { Flex } from "antd";
+import { SkinButton as Button } from "@stapel/tokens-antd/skin";
```

attributes-react, listings-react and drive-react migrated this way in the
registry's landing wave (17 files, alias-only diffs, zero JSX changes);
the remaining pairs' ~100 direct `Button`/plain-`Input` sites are a
follow-up sweep of the same one-line shape. Files using `Input.TextArea` /
`Input.Password` keep antd's `Input` until the TextArea slot exists.
A `stapel/no-bare-primitive-in-skin` lint rule (mirroring
`stapel/no-bare-dialog`) is the candidate mechanism to hold the sweep once
it lands — not added yet, because half the fleet would be red the day the
rule ships.

## Proof

- `packages/tokens-antd/test/componentsRegistry.test.tsx` — the registry's
  own suite: empty-provider parity, one registration reaching every
  substrate render, composite inheritance (`SkinConfirm`/`SkinPickerSheet`
  through `SkinDialog`), subtree nesting, loud contract violations.
- `packages/{attributes,listings,drive}-react/test/skinRegistry.test.tsx` —
  a host-level registration reskins each pair's own controls with no pair
  wiring, and the no-provider arm stays antd.
- The workspace showcase (`packages/showcase-viewer`) doubles as the demo
  host: run `pnpm --dir packages/showcase-viewer dev` and add `?reskin=1`
  to any story URL (or `localStorage.setItem("stapel-reskin", "1")` to make
  it sticky; `?reskin=0` forces the baseline). `.ladle/reskin.tsx` wraps
  every story of every pair in ONE `SkinProvider` with a deliberately loud
  replacement button/sheet/input — the "override in one place, every
  standard skin follows" demonstration. Verified 2026-09-02 against
  listings' detail pane, drive's archive sheet and attributes' editors,
  with the baseline arm unchanged.
