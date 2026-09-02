---
"@stapel/tokens-antd": minor
"@stapel/attributes-react": minor
"@stapel/listings-react": minor
"@stapel/drive-react": minor
---

The skin component registry — the substrate's second restyle layer (owner
mandate 2026-08-31; design doc `docs/skin-component-registry.md`).

`@stapel/tokens-antd/skin` gains `SkinProvider`: a host registers a
replacement `Button`, `Input` and/or `Dialog` surface ONCE, at the app
root, and every substrate render below it — `GatedButton`, `ErrorAlert`'s
retry, `SkinConfirm`'s arms, `RowActions`, `PermissionSheet`, the picker
footer and search box, `SkinNumberField`, `CountedInput`, `SkinDialog` and
everything composed on it — draws the host's anatomy instead of antd's.
Tokens keep answering "what colour"; the registry answers "what IS a
button". New exports: `SkinProvider`, `SkinButton`, `SkinInput`,
`useSkinComponents`, and the slot contracts `SkinButtonProps`,
`SkinInputProps`, `SkinDialogSlotProps` (typed props plus documented
anatomy duties, checked in dev builds with a loud `console.error` per
violation). With no provider the markup is byte-identical to 0.14 — pinned
by pre-change snapshots.

attributes-react, listings-react and drive-react migrate their default
skins' direct antd `Button`/plain-`Input` imports to the registry-resolved
`SkinButton`/`SkinInput` (alias-only import diffs, zero JSX changes) and
raise their `@stapel/tokens-antd` peer floor to `>=0.15.0`, so a host-level
registration reskins these pairs completely with no pair wiring.
