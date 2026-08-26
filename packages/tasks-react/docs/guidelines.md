# Tasks — frontend guidelines

The product rules THIS pair is held to. The fleet-wide ones live in
stapel-react's `docs/frontend-guidelines.md`; this file records what they mean
for @stapel/tasks-react and what has been decided for its screens. It is a stub on
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

- 2026-08-26 — the board reads `GET boards/{id}/cards`, never the `-created_at`
  feed. One request, one sort authority, and the server's `truncated` flag is
  rendered as a banner instead of being silently absorbed.
- 2026-08-26 — a move has FOUR endings and the skin keeps them four. `deferred`
  keeps the card where it was dropped and badges it: snapping it back would say
  "refused", which is not what the server said.
- 2026-08-26 — the phone board is one column plus a switcher strip whose chips
  are drop targets, not the desktop board narrowed. Five columns at 390px is
  five unusable columns.
- 2026-08-26 — `ColumnManager` offers reorder and add only, and SAYS that
  rename and delete are not in this API. The endpoints do not exist
  (`urls_v1.py`); two dead controls would be worse than one sentence.
- 2026-08-26 — assignees are read-only unless the host fills `userPicker`.
  stapel-tasks resolves no user ids and has no member search, so a "type a UUID"
  box would be a control nobody could use.
- 2026-08-26 — `features` is the `renderFeatures` SLOT, not a re-implementation
  of stapel-attributes' editors. Unfilled with `feature_defs` present it renders
  a named `SlotPlaceholder`; with none it renders nothing at all.
- 2026-08-26 — `wip_limit` is displayed and never enforced: the server stores it
  without acting on it, and a client that blocked a drop the server would accept
  would be inventing a rule.
- 2026-08-26 — the truncation banner and the move-outcome status use a local
  `Notice`, not antd `Alert`: news is neither a failure nor an emptiness, and
  `Alert`'s heading prop is mid-rename between antd majors.
