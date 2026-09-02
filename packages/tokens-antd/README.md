# @stapel/tokens-antd

The Ant Design leg of the **token bridge** (§68; frontend-guidelines §2.4;
owner decision §38 T3). It projects `@stapel/tokens`' neutral colour roles
onto an Ant Design `ConfigProvider` theme — so integrating a
`@stapel/*-react` pair's default skin already carries the user's theme,
light and dark.

The §68 neutral role dictionary IS the bridge vocabulary — a role name
(`brand`, `surface-raised`, `text-muted`, …) is both the CSS var suffix
(`--stapel-brand`) and the exact key this package reads off `@stapel/tokens`'
`colors` object. There is no separate role→role indirection table (the old
`bridgeColorRoles` map is gone) — this package only renames roles to antd's
flat token field names and picks the `light`/`dark` half; it holds no colour
decisions of its own, so it and `@stapel/tokens-mui` cannot drift.

## Usage

```tsx
import { toAntdTheme } from "@stapel/tokens-antd";
import { ConfigProvider } from "antd";

<ConfigProvider theme={{ token: toAntdTheme(mode) }}>
  <App />
</ConfigProvider>;
```

`toAntdTheme(mode)` returns just the flat `theme.token`. For a config that also
flips antd's **derived** neutrals (borders, hovers, fills) to the dark palette —
not only the seed tokens — spread the full config instead:

```tsx
import { toAntdThemeConfig } from "@stapel/tokens-antd";

<ConfigProvider theme={toAntdThemeConfig(mode)}>
  <App />
</ConfigProvider>;
```

## The mapping (§68; frontend-guidelines §2.4)

| `@stapel/tokens` role | antd `theme.token` |
| --- | --- |
| `brand` | `colorPrimary` |
| `success` / `warning` / `error` / `info` | `colorSuccess` / `colorWarning` / `colorError` / `colorInfo` |
| `text` | `colorText` |
| `text-muted` | `colorTextSecondary` |
| `text-subtle` | `colorTextTertiary` |
| `surface` | `colorBgLayout` |
| `surface-raised` | `colorBgContainer` |
| `surface-overlay` | `colorBgElevated` |
| `border` | `colorBorder` |
| `border-subtle` | `colorBorderSecondary` |
| `link` / `link-hover` | `colorLink` / `colorLinkHover` |
| radius `md` | `borderRadius` |
| font-size `md` | `fontSize` |

Every field above is resolved by reading the host's **live**
`--stapel-<role>` CSS custom property off `document.documentElement` at call
time (falling back to the compiled-in default only with no DOM — SSR/tests) —
so a host's customized brand colour flows through even to antd's seed-token
colour derivation (hover/active shades), not just its own light/dark mode.

`antd` is a peer dependency — the consuming app brings its own copy.

## `/skin` — the shared skin substrate

`@stapel/tokens-antd/skin` is the antd SURFACE the bridge owns: the rules
every `@stapel/<module>-react` default skin inherits instead of re-deciding
per component. The root export stays pure functions; a host that only wants
the theme mapping never loads a component.

| Export | The rule it states once |
| --- | --- |
| `SkinProvider` / `SkinButton` / `SkinInput` / `useSkinComponents()` | The component REGISTRY — the substrate's second restyle layer (tokens re-colour; the registry swaps ANATOMY). A host registers a replacement `Button`, `Input` and/or `Dialog` surface once, at the app root, and every substrate render below it (`GatedButton`, `ErrorAlert`'s retry, `SkinConfirm`'s arms, `RowActions`, `PermissionSheet`, the picker's footer and search, `SkinNumberField`, `CountedInput`, `SkinDialog` and everything composed on it) draws the host's primitive. Contracts (`SkinButtonProps`, `SkinInputProps`, `SkinDialogSlotProps`) document the anatomy duties and are checked in dev with a loud `console.error`; no provider = byte-identical antd defaults. Design doc: `docs/skin-component-registry.md` (repo root). |
| `SkinTheme` | A skin self-themes from the document's LIVE `data-theme` (never `"light"`), paints its own surface (`raised` default / `base` / `bare`), and on a phone raises antd's `controlHeight` to 44px. |
| `useThemeMode()` / `subscribeThemeMode()` | The reactive mode read (`useSyncExternalStore` + MutationObserver on `data-theme`), SSR-safe. |
| `SkinDialog` / `useDialogSurface()` | On a phone a dialog is a bottom sheet; modals are tablet/desktop only. It themes its own portal, so a dialog is on the right side wherever it was declared. |
| `SkinConfirm` | A confirmation is a dialog (so: a sheet on a phone), never an anchored `Popconfirm`. Controlled; `danger` variant; `confirming` holds both arms. |
| `SkinCarousel` | A swipeable strip is NATIVE CSS scroll-snap, never a JS gesture layer. `peek` (default 8%) keeps the edge of the next slide on screen — the affordance that there is more; `aspectRatio` fixes the well so a gallery does not change height as images land; `dots` is an indicator, not a control (position is announced through the strip's list semantics, which needs no i18n key). `label` is required. The scrollbar is hidden and the strip is a focusable, arrow-scrollable region. |
| `ErrorAlert` | The one error surface: `error` (described), `thrown` (raw), or `message`; `onRetry`, `onDismiss`, `action`; `variant="block"` (Alert) or `"inline"`. In a box narrower than `ACTION_STACK_BELOW` the actions stack under the message instead of taking a column beside it. |
| `EmptyState` | Icon, title, hint, action. Reachable only from a load that succeeded. |
| `LoadBoundary` / `LoadList` | `matchLoad` / `matchList` as components with designed loading / failed / empty arms; the skin writes only the ready arm. |
| `GatedControl` / `GatedButton` | A control plus its `ActionAvailability` reason as visible text beside it (`aria-describedby`), never a tooltip. Inside a `PaneGate`, identical reasons are pooled into one sentence. |
| `PaneGate` | A pane-level refusal rendered ONCE for the pane (no retry, an optional way forward, an optional read-only preview) instead of per-row gated controls. |
| `Pane` / `Page` | The measure (`narrow` / `reading` / `wide` / `full`, derived from the token breakpoints) and the padding scale, instead of a hand-set `maxWidth` per file. `Page` is a self-themed `base` surface with the one title/actions header a screen has. |
| `StatusTag` | One treatment per status family — `success` / `warning` / `error` / `info` / `neutral` — from the theme's status roles. |
| `RowActions` | A row's actions: buttons that wrap between themselves and never inside a word; on a phone the primary stays inline and the rest open in a sheet. Gated actions carry their reason. |
| `ListRow` / `CardHeader` | A row and a header whose text column is `min-width: 0` and wraps (no ellipsis unless `truncate`), with a badge slot that reserves its space and an actions slot that wraps under the title. |
| `DataTable` | A table where the box is wide, a stack of cards where it is not — decided by the element's width, never the viewport's. Columns declare their card role (`title` / `badge` / `field` / `hidden`). |
| `ChoiceChips` | A handful of options is picked INLINE, as 44px chips that wrap and never truncate a label mid-word — never a dropdown. `mode="single"` (a second tap clears only with `allowClear`) or `"multi"`; `columns="row"` / `"grid"`. A chip that cannot be chosen states its `disabledReason` as visible text under the row, once per distinct sentence, pointed at by `aria-describedby`. |
| `SkinPickerSheet` | A LONG list is picked in a bottom sheet with a search box, never a dropdown. Composes `SkinDialog` (sheet on a phone, modal above the breakpoint). Single-select answers and closes on the tap; multi-select holds a draft and commits it on a footer button carrying the count (`Done · 3`, and no count at zero). Search is controlled (`searchValue`/`onSearchChange` — the caller answers) or filtered locally. Four states a `Select` never had: `loading` (which does NOT block the commit), empty (`emptyLabel`), capped at `maxRows` (200) with a `refineLabel` tail row, and `listStale` — rows that no longer answer the search box are dimmed and inert. |
| `SkinNumberField` | A number raises the numeric keypad (`integer` → `inputMode`), wears its `unit` as a suffix that is never part of the value, and shows min/max as a `hintPlaceholder`. NOT antd's `InputNumber`: nothing is clamped, out of range is the caller's `status`/`errorText` beside the field, and the raw text is kept so a half-typed `1.` survives. |
| `CountedInput` | A length limit is a live counter in Unicode CODE POINTS — the unit the backend validates in — never a DOM `maxlength` (UTF-16 units, which stops somebody two emoji short with no message). Over the limit the counter turns to `colorError` and the keystroke still lands. `normalize` runs on paste (at the cursor) and on blur, never per keystroke; `mono` draws a code in the token monospace face. |
| `useElementWidth(ref, { thresholds })` | The fleet's one element-width measurement (`ResizeObserver`), read by `DataTable` and `Pane`. A zero width is ignored (a hidden box measures nothing); an unmeasured box answers `undefined` for the width **and** every threshold, so the caller states its own seed — `below.cards ?? phone`. |

Phone (viewport below the tablet breakpoint): `SkinTheme` applies `PHONE_TOUCH_FLOOR`
— `controlHeight` **and** `controlHeightSM` at 44px, `Rate` stars on a 44px
pitch, 24px checkbox/radio boxes — and hoists one stylesheet
(`phoneTouchFloorCss`) that gives rate stars, checkbox/radio rows, clickable
tags and list/menu rows a 44px hit area. A nested bare `SkinTheme` inherits
the **pin** of the one above it (`mode="dark"` on a demo wrapper themes every
self-wrapping surface inside it dark). The sheet (`SkinDialog` on a phone)
fits its content up to `90dvh`; past that the body scrolls and the `footer`
stays pinned — put the primary action in `footer`.

```tsx
import { SkinTheme, LoadList, EmptyState, GatedButton, SkinConfirm } from "@stapel/tokens-antd/skin";

export function DraftsPane(): ReactElement {
  const t = useT();
  const drafts = useDrafts();
  const [confirming, setConfirming] = useState<number | null>(null);
  return (
    <SkinTheme>
      <LoadList state={drafts.state} onRetry={drafts.refetch}
        empty={<EmptyState title={t(KEYS.noDrafts)} action={<Button>{t(KEYS.create)}</Button>} />}>
        {(items) => items.map((d) => (
          <GatedButton key={d.id} gate={d.actions.discard} danger onClick={() => setConfirming(d.id)}>
            {t(KEYS.discard)}
          </GatedButton>
        ))}
      </LoadList>
      <SkinConfirm open={confirming !== null} danger title={t(KEYS.discardQuestion)}
        confirmLabel={t(KEYS.discard)} onConfirm={discard} onCancel={() => setConfirming(null)} />
    </SkinTheme>
  );
}
```

The substrate's own copy (retry, dismiss, confirm, cancel, the empty-state
default) comes from `@stapel/core`'s UI floor (`STAPEL_UI_KEYS`, en/ru/es)
through the nearest `<I18nProvider>` — overridable by registering the same
key later — and from the English floor where no provider is mounted.
`@stapel/core` is therefore a peer of this subpath.

Regression is held by `@stapel/eslint-plugin`'s `stapel/no-bare-dialog`
(bare `Modal`/`Drawer`/`Popconfirm` under `src/default/**`).
