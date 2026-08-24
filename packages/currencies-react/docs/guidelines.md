# Currencies — frontend guidelines

The product rules THIS pair is held to. The fleet-wide ones live in
stapel-react's `docs/frontend-guidelines.md`; this file records what they mean
for @stapel/currencies-react and what has been decided for its screens. It is a stub on
purpose — fill it as the pair grows, and keep decisions here rather than in a
reviewer's memory.

## What this pair ships

| Layer | Where | Rule |
|---|---|---|
| headless | `src/headless/` | zero visual opinion; every state is in the bag |
| default skin | `src/default/` | the shipped screens — antd, themed by `SkinTheme` |
| i18n | `src/i18n/{keys,ru,es}.ts` | every user-visible string is a key with en+ru+es |
| nav | `src/nav/manifest.ts` | the screens a container may mount |

## Non-negotiable

1. **One skin surface.** Components under `src/default/` render inside
   `SkinTheme` from `@stapel/tokens-antd/skin`. No local `ConfigProvider`, no
   `mode = "light"` default — a pair that picks a mode ignores the host's theme.
2. **Dialogs are the fleet's dialog.** Use `SkinDialog`; on a phone it is a
   bottom sheet, at 768px and above a centred modal. `stapel/no-bare-dialog`
   refuses a bare antd `Modal`/`Drawer` here.
3. **No raw colours, no raw spacing.** `cssVar("<role>")` and the `spacing`/
   `radii` steps from `@stapel/tokens`. Never a hex, never a magic px.
4. **Reasons beside controls.** A disabled control is derived from an
   `ActionAvailability` and renders its block WHERE the control is — never in a
   tooltip (touch has no hover) and never as a silent `disabled`.
5. **Three states, always.** Loading, empty and refusal are designed, not
   implied. `matchList`/`LoadState` from `@stapel/core` name them.
6. **Mobile first.** Every skin component has a `viewport: "phone"` demo
   variant; 390px is the design width, and element width — not the viewport —
   decides a layout.
7. **Every string is a key.** en in `i18n/keys.ts`, ru in `i18n/ru.ts`, es in
   `i18n/es.ts`. `test/i18nParity.test.ts` is the gate; a key with no ru/es text
   fails the build rather than reaching a host in English.
8. **Icon-only buttons carry `aria-label`** (an i18n key, not a literal).

## Decisions log

_(Record product decisions here: what a screen refuses to render and why, which
slot a container must fill, which state was deliberately left out.)_

- 2026-.. — scaffolded; `CurrenciesPanel` is a skeleton (themed frame +
  empty/loading states). No product decisions yet.
