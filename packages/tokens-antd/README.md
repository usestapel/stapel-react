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
| `SkinTheme` | A skin self-themes from the document's LIVE `data-theme` (never `"light"`), paints its own surface (`raised` default / `base` / `bare`), and on a phone raises antd's `controlHeight` to 44px. |
| `useThemeMode()` / `subscribeThemeMode()` | The reactive mode read (`useSyncExternalStore` + MutationObserver on `data-theme`), SSR-safe. |
| `SkinDialog` / `useDialogSurface()` | On a phone a dialog is a bottom sheet; modals are tablet/desktop only. |
| `SkinConfirm` | A confirmation is a dialog (so: a sheet on a phone), never an anchored `Popconfirm`. Controlled; `danger` variant; `confirming` holds both arms. |
| `ErrorAlert` | The one error surface: `error` (described), `thrown` (raw), or `message`; `onRetry`, `onDismiss`, `action`; `variant="block"` (Alert) or `"inline"`. |
| `EmptyState` | Icon, title, hint, action. Reachable only from a load that succeeded. |
| `LoadBoundary` / `LoadList` | `matchLoad` / `matchList` as components with designed loading / failed / empty arms; the skin writes only the ready arm. |
| `GatedControl` / `GatedButton` | A control plus its `ActionAvailability` reason as visible text beside it (`aria-describedby`), never a tooltip. |

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
