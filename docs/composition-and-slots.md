# Composition, shell templates and slots (`embeds[]`)

Status: **ACTIVE — first slice** (2026-10-15). Queue: stapel-react train
(core minor, shell-react minor, notifications-react / translate-react minor),
then stapel-tools minor (`--shell`, `--slot`). Consumers: `scripts/gen-nav-manifest.mjs`
(the manifest gate), `@stapel/shell-react` (`slots` prop, `SHELL_TEMPLATES`),
`stapel-tools` `create_project.py` (`--shell`, `--slot`, the embeds mirror and
`scripts/check_nav_manifest_sync.py`), Stapel Studio's intake (B2 of the
static questionnaire, `pipeline-spec-2026-10-15.md` §3.9).

Owner directive this answers (2026-10-15, relayed): the frontend is assembled
by a script into a working construction — auth flow first when there is one,
then the main screen; navigation, an application shell, slots (top bar, bottom
bar, mobile navigation, side menus); the layout is a questionnaire answer
taken before anything is built; frontend libraries declare the variants of
where they embed; the scaffold hands all of this out as parameters.

## 1. The composition object — the one input of the scaffold

Everything the scaffold needs to assemble the SPA is a value of this object.
Today each field is a CLI parameter of `stapel-create-project`; Studio's
intake fills the same object from the blitz questionnaire and calls
`assemble_scaffold` with it. There is no second channel.

| Field | Values | Parameter (stapel-tools) | Decides |
|---|---|---|---|
| `auth.model` | `none` / `anonymous` / `public` / `internal` | `--auth-model` (0.71.0) | posture, login axes, **whether the flow starts with `/login`** |
| `auth.kinds[]` | `phone,email,password,oauth,magic,sso,passkey,qr` | `--auth-kinds` (0.71.0) | the `AUTH_<KIND>_LOGIN` axes |
| `posture` | `prototype` / `live` | `--posture` (0.71.0) | mock OTP on the inherited settings |
| `theme.preset` | `default,ocean,forest,crimson,graphite,amber,<path>` | `--theme` (0.71.0) | `stapel.theme.json` |
| `modules[]` | registry keys | `--modules` | pairs installed, nav entries, embeds offered |
| `landing` | bool | `--landing` | `/` is a landing or a redirect to `/app` |
| **`shell.template`** | `topbar-sidenav` (default) · `topbar-only` · `sidenav-only` (queued) | **`--shell`** (this slice) | which chrome and therefore which slots exist |
| **`shell.slots{}`** | `<slotId>: <embedId> \| none` | **`--slot <slotId>=<embedId\|none>`** (repeatable) | resolves an exclusive-slot conflict, or silences a slot |
| `shell.phoneChrome` | `drawer` / `dock` | queued (`--phone-chrome`) | the phone frame of `topbar-only` |
| `i18n.product[]` | locales | queued (`--locales`, T6) | registered bundles |

Flow order rule (already machine-checked by stapel-tools `tests/test_auth_model.py`
and the generated app's nav gate): when `auth.model` is `public` or
`internal`, the route tree is `/` (landing or redirect) → `/login` → `/app`
behind `ProtectedRoute`; the main screen is the first child of `/app`. With
`none` or `anonymous` there is no gate: `/app` mounts directly and no
`/login` route is emitted. Slots follow the same rule through `surface`
(§3): a `member` embed is rendered only inside the gated shell.

## 2. Shell templates and their slots

A template is a named chrome plus the closed list of slots it renders. The
slot vocabulary is global and lives in `@stapel/core` (`SHELL_SLOT_IDS`,
`src/nav.ts`), next to `NavEntry`, because pairs declare against it without
depending on any chrome. The template table lives in `@stapel/shell-react`
(`SHELL_TEMPLATES`, root export — pure data — and the published
`shell-templates.json`), because the chrome is what renders a slot.

Slot vocabulary (v1):

| Slot id | Where | Capacity |
|---|---|---|
| `topbar.start` | after the brand, leading edge of the top bar | many |
| `topbar.center` | the middle of the top bar (a search field) | **one** |
| `topbar.end` | trailing edge of the top bar (bells, switchers, account) | many |
| `sidenav.head` | top of the side menu, above the destinations | many |
| `sidenav.foot` | bottom of the side menu (the theme switch lives here) | many |
| `sheet.foot` | footer of the phone navigation sheet | many |
| `bottombar` | the phone dock island (beside the destinations) | many |
| `browsebar` | the public shell's category / browse strip | **one** |
| `footer` | the page footer | **one** |
| `page.actions` | page-header actions (reserved; no template renders it yet) | many |

Templates (v1):

| Template | Chrome | Slots rendered | Status |
|---|---|---|---|
| `topbar-sidenav` | `<AppShell/>` — top bar across, labelled `Sider` on desktop, glyph rail on tablet, drawer sheet on phone | `topbar.start`, `topbar.center`, `topbar.end`, `sidenav.head`, `sidenav.foot`, `sheet.foot` | **shipped** (this slice) |
| `topbar-only` | `<PublicShell/>` — top bar + browse bar + footer, dock or drawer on phone | `topbar.start` (= `brand`), `topbar.center` (= `searchSlot`), `topbar.end` (= `accountSlot`), `browsebar` (= `categorySlot`), `footer`, `bottombar` | shell side shipped (the `slots` prop maps onto the five existing props); monolith `--shell topbar-only` **queued** (the storefront generator already emits this chrome) |
| `sidenav-only` | a `Sider` with the brand at its head and no top bar | `sidenav.head`, `sidenav.foot`, `sheet.foot`, `page.actions` | **queued** (named so the questionnaire can offer it; refused by the scaffold with the hint until it ships) |

What `shell-react` already provided before this slice: `AppShell` had two
anonymous slots (`logo`, `headerExtra`) and `PublicShell` had five named ones
(`brand`, `searchSlot`, `categorySlot`, `accountSlot`, `footer`); both are
kept. What changes (additive, pre-1.0 minor): both chromes take
`slots?: Partial<Record<ShellSlotId, ReactNode>>`; on `PublicShell` a slot
fills the matching legacy prop when that prop is not given (the explicit prop
wins, so no existing host changes). `SHELL_TEMPLATES` and
`shell-templates.json` are new exports; a test asserts the JSON equals the
TypeScript constant so neither can drift.

## 3. `embeds[]` — what a pair declares

A pair that ships a chrome-shaped component (a bell, a switcher, a search
field, an account menu) declares where it can embed in its own
`src/nav/manifest.ts`, beside `navEntries`:

```ts
export const navEmbeds: readonly NavEmbed[] = [
  {
    id: "notifications.bell",
    slot: "topbar.end",
    component: { export: "NotificationBell", subpath: "default" },
    order: 20,
    surface: "member",
    opens: "notifications.feed",
  },
];
```

JSON schema (normative; `gen:nav` enforces it, `nav-manifest.json` carries it
under `embeds`):

```json
{
  "$id": "https://stapel.dev/schemas/nav-embed.v1.json",
  "type": "object", "additionalProperties": false,
  "required": ["id", "slot", "component", "order"],
  "properties": {
    "id":        { "type": "string", "pattern": "^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$",
                   "description": "Globally unique across installed pairs, `<module>.<thing>`." },
    "slot":      { "enum": ["topbar.start","topbar.center","topbar.end","sidenav.head","sidenav.foot",
                            "sheet.foot","bottombar","browsebar","footer","page.actions"] },
    "component": { "type": "object", "additionalProperties": false, "required": ["export","subpath"],
                   "properties": { "export": {"type":"string","minLength":1},
                                   "subpath": {"type":"string","minLength":1} } },
    "order":     { "type": "number", "description": "Ascending within the slot; ties break on id." },
    "surface":   { "enum": ["public","member","any"], "default": "any",
                   "description": "Who sees it: `member` only inside the gated shell, `public` only outside it, `any` both." },
    "breakpoints": { "type": "array", "uniqueItems": true, "minItems": 1,
                     "items": { "enum": ["phone","tablet","desktop"] },
                     "description": "Omitted = every width. The shell hides the embed below/above the listed rungs." },
    "props":     { "type": "object", "additionalProperties": { "type": ["string","number","boolean"] },
                   "description": "Static JSON props the container passes verbatim (`{ \"compact\": true }`)." },
    "opens":     { "type": "string",
                   "description": "A NavEntry id this embed opens. The container passes `onOpen` navigating to that entry's path; the component must accept `onOpen: () => void`." }
  }
}
```

Component contract: the export renders with no required props beyond
`props` and, when `opens` is declared, `onOpen`. It reads its own pair's
runtime through the providers the container already mounts (`modules.tsx`),
never a prop the shell would have to know about.

Manifest gate (`pnpm gen:nav`, strict in CI) — a declaration that fails any
of these is a red generator run with the offending pair, index and reason:

- `slot` not in `SHELL_SLOT_IDS` → `embeds[i] slot "x" is not a shell slot; one of topbar.start, …` (**inversion check 1**);
- `component.export`/`subpath` empty, `order` not finite, `surface` or a
  `breakpoints` item outside the enum, a `props` value that is not a scalar;
- `id` duplicated within the pair or across the aggregate;
- `opens` naming an entry no installed pair and no container root declares
  (same rule as `placement.parentId`).

The aggregate carries each pair's `embeds` in the root `nav-manifest.json`;
a pair with none has no `embeds` key (not an empty array), so every manifest
written before this slice is byte-identical.

## 4. The static assembly algorithm (stapel-tools)

Inputs: the composition (§1), the installed pairs' mirrored `embeds`
(`FRONTEND_REACT_LIBS[key]["embeds"]`, drift-gated against the real
`nav-manifest.json` by `scripts/check_nav_manifest_sync.py` exactly like
`nav`), the template table mirrored from `shell-templates.json`.

1. **Template.** `--shell` must be a key of the table; unknown → error listing
   the keys. A template the monolith generator cannot render yet
   (`topbar-only`, `sidenav-only`) → error naming the queue item.
2. **Offer.** Collect every embed of every installed pair. Drop those whose
   `slot` the template does not render; print each drop as a note
   (`embed notifications.bell wants topbar.end, which sidenav-only has no
   slot for`). Drop `member` embeds when `auth.model` is `none`/`anonymous`
   (no gated shell exists), with the same note.
3. **Overrides.** Apply `--slot <slotId>=<embedId|none>`: the slot id must be
   one the template renders (**inversion check 2**: a bogus slot fails with
   the template's slot list), the embed id must be offered for that slot
   (else: the ids that are); `none` empties the slot.
4. **Conflicts.** For a capacity-one slot with more than one remaining embed →
   error: `two embeds claim topbar.center: search.box, categories.quick_search —
   pick one with --slot topbar.center=<id> or silence it with --slot
   topbar.center=none`. Never a silent first-wins.
5. **Order.** Within each slot sort by `(order, id)`. Deterministic.
6. **Emit** `frontend/src/embeds.generated.tsx`: one component per filled
   slot (`TopbarEnd`, …) importing each embed's export from
   `<package>/<subpath>`, passing `props` verbatim and `onOpen={() =>
   navigate(<path of opens>)}` resolved from the route plan; a `member`
   embed inside the gated shell needs no further guard, an `any` embed is
   rendered as is. `AppChrome` passes `slots={{ "topbar.end": <TopbarEnd/> }}`
   to the chrome (only when the pinned shell is ≥ the slots floor, like every
   other shell prop).
7. **Gate.** The generated app's nav gate test is extended: every slot the
   composition filled is present in the `slots` the chrome receives, and the
   `--slot` choices are echoed in `frontend/stapel.composition.json`
   (the composition object as the scaffold understood it — the file Studio's
   run view and `UpstreamAsk` read).

## 5. Inversion checks (what must fail, and did)

| # | Action | Expected failure | Where proven |
|---|---|---|---|
| 1 | a pair declares `slot: "header.right"` | `gen:nav` red, names the slot and the vocabulary | `scripts/gen-nav-manifest.test.mjs` |
| 2 | `--slot header.right=notifications.bell` | scaffold exits 1, lists the template's slots | `tests/test_shell_slots.py` |
| 3 | `--slot topbar.end=bogus.embed` | scaffold exits 1, lists offered embed ids | same |
| 4 | two installed pairs claim `topbar.center` without `--slot` | scaffold exits 1 with the pick/none hint | same |
| 5 | `--shell sidenav-only` | scaffold exits 1 naming the queue item | same |
| 6 | mirror `embeds` differ from the pair's `nav-manifest.json` | `check_nav_manifest_sync.py` red | `tests/test_nav_manifest_sync.py` |
| 7 | `shell-templates.json` ≠ `SHELL_TEMPLATES` | shell-react vitest red | `packages/shell-react/test/templates.test.ts` |

## 6. Questionnaire (for Studio's intake B2)

- **B2a** Which shell: `topbar-sidenav` (an application: side menu, top bar) ·
  `topbar-only` (a storefront or site: top bar, browse strip, footer) ·
  `sidenav-only` (a tool: side menu only) — default by archetype
  (shop/classified → `topbar-only`; back-office/SaaS → `topbar-sidenav`).
- **B2b** For each exclusive slot the chosen modules compete for, which one
  (shown only on conflict; the list comes from step 4).
- **B2c** Which offered embeds to silence (`--slot x=none`), default none.
- **B2d** Phone frame for `topbar-only`: dock or drawer (queued parameter).

## 7. What this slice does not do (queued, with sizes)

- `sidenav-only` chrome in shell-react (M) and monolith `--shell topbar-only`
  (M: the storefront generator's `render_public_routes_tsx` becomes a
  monolith option).
- `breakpoints` are validated and carried; the chromes render them only for
  `topbar.*` and `sidenav.foot` (phone/desktop) — `bottombar` is reserved
  until `AppShell` grows a dock (S).
- `page.actions`: no chrome renders page headers; the slot is reserved so a
  pair can already declare it (S, with a `PageHeader` skin component).
- An account menu embed from auth-react (C-R2-like; `topbar.end`, `member`,
  opens `account.root`) and a `WorkspaceSwitcher` from workspaces-react
  (C-R2) — both are new skin exports with demos (S each).
- `--phone-chrome` and `--locales` (T6) as composition fields.
