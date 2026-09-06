---
"@stapel/shell-react": minor
---

shell: `headerScrollFlag` is a HYSTERESIS — two edges, not one (D459)

The flag flipped off a single 1px sentinel, which is a threshold and not a
hysteresis. A trackpad's rubber-band around the top of a page crosses 0–3px
repeatedly inside **one gesture**, so `data-scrolled` strobed and took whatever
a brand hung on it with it. The fleet's storefront was fading its hairline over
120ms so that a crossing would at least read as a crossing — a paint covering
for a fact that was wrong.

`headerScrollFlag` now takes `boolean | HeaderScrollThresholds`:

```tsx
<PublicShell headerScrollFlag />                        // { on: 8, off: 0 }
<PublicShell headerScrollFlag={{ on: 24, off: 4 }} />
<PublicShell headerScrollFlag={{ on: 0, off: 0 }} />    // the old single edge
```

The flag comes **on** once the page has scrolled at least `on` px and goes
**off** only when it is back at `off` px or fewer. Between the edges nothing
happens at all, which is what a rubber band lives in.

Still no `scroll` listener: it is one sentinel and two `IntersectionObserver`s,
the OFF one with its root's top edge moved to `height - off - 1` so that it
reports the sentinel as intersecting exactly while the page is at `off` px or
less. The sentinel's height is now the ON edge instead of one pixel — taken and
given straight back, as before, so it still costs the document no room — and it
carries `data-scroll-on` / `data-scroll-off` so a stand can read the edges off
the page.

`true` therefore changes behaviour: the flag no longer flips at 1px. New
exports: `HeaderScrollThresholds`, `DEFAULT_HEADER_SCROLL_THRESHOLDS`
(`{ on: 8, off: 0 }`) and `headerScrollThresholds()`, the normaliser — `off` is
never negative, `on` is never under `off`, and both are whole pixels.
