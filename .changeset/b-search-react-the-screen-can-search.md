---
"@stapel/search-react": minor
---

The search page can start a search.

`setText` had zero callers in the entire repository: the codec carried `q`, the state
machine could set it, the request sent it, and no screen could type one. Six of the nine
state setters had no control at all. This release is the missing half of the pair.

- **`<SearchBox>`** — the query box, debounced (350ms, `replace: true`, so ten letters are
  one history entry), capped at the server's own `MAX_QUERY_CHARS`, with a typeahead over
  `GET /suggest` — an endpoint that had been typed and unreachable since 0.1. `useSearchBox`
  is the headless half; `useSuggest` the hook. Exported, so a container's header can mount
  the same box the page does (`searchBox={false}` then keeps exactly one on screen).
- **Range filters** — `r.<slug>=from..to` finally has a control. `state/ranges.ts` decides
  which rows exist (numeric features of the category schema, plus any slug the URL already
  constrains); `<RangeFilterRow>` commits on Apply and refuses a backwards range with the
  reason beside the button instead of returning an empty page.
- **Category, location, language and page size** — `renderCategoryFilter` and
  `renderGeoFilter` are named slots the categories/geo pairs fill, with `SlotPlaceholder`
  where they are not; either way a constraint that arrived in a shared link now has a control
  that widens it again (clear the category, adjust or clear the radius). `<LanguageSelect>`
  and `<PageSizeSelect>` bind `setLanguage` and `setLimit`.
- **No reason lives in a hover any more.** The pager, the distance sort and the DSA Art. 26
  `promoted` explanation were all `title=`/`<Tooltip>` — invisible on every phone and on
  every disabled button. They are visible text now (`GatedButton`/`GatedControl`, and plain
  copy under the marking). The pager is absent, not dead, when there is nothing to page.
- **The generic card draws `image_url`** through `@stapel/image` (new optional peer), in an
  aspect box, with the promoted tag on a `--stapel-*` role instead of antd's `gold` preset.
- **On a phone the filters are a bottom sheet** behind a "Filters (N)" button, through the
  shared `SkinDialog`, instead of a full-width panel stacked above the first result.
- **The pair's `theme.tsx` and `ErrorAlert.tsx` are deleted** in favour of
  `@stapel/tokens-antd/skin`'s `SkinTheme` / `ErrorAlert` / `EmptyState` / `LoadList`.
  `SearchSkinTheme` is no longer exported (pre-1.0 breaking = minor): import `SkinTheme`
  from the substrate — same props, and a runtime `data-theme` flip repaints it.

Peers: `@stapel/core >=0.18.0`, `@stapel/tokens-antd >=0.6.0`, `@stapel/image >=0.3.0`
(optional — only the `/default` skin needs it). The `/default` size budget moves 13 KB → 16 KB.
