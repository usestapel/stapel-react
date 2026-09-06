---
"@stapel/shell-react": minor
---

shell: `<PublicShell>`'s header geometry is PUBLISHED, and pinning it is a prop

Three additions, one defect: everything a storefront pins under a fixed header
had to restate a number this component owned privately, and the desktop half of
"is the header pinned" had no answer at all.

- **`HEADER_HEIGHT_DESKTOP` / `HEADER_HEIGHT_PHONE`** are exported from
  `@stapel/shell-react/default`, and the same two numbers are published as the
  custom property **`--stapel-header-height`** (`HEADER_HEIGHT_VAR`) on the
  shell's own root — a hoisted sheet (`publicShellCss()`, hung on
  `PUBLIC_SHELL_CLASS`) that switches at `breakpoints.desktop` with a MEDIA
  QUERY rather than at a render, so a window dragged across 1200px moves the
  header and whatever pinned under it together. On the shell's root and not on
  `:root`: two shells on one page must not fight over one name. Below the
  desktop edge the property is declared for `phoneChrome="dock"` only — in
  `"drawer"` the phone header wraps to a second line for the search field and
  has no fixed height, and being told nothing there is better than being told
  56px, so keep a fallback in the `var()`.
- **`headerSticky?: boolean | "desktop" | "phone"`**. Omitted, the shell does
  exactly what it did before: sticky in the dock chrome and nowhere else, which
  left a storefront pinned on a phone and `static` on a desktop with no prop for
  the second half. `"desktop"` pins at and above the desktop breakpoint,
  `"phone"` below it, `true` both, `false` neither. Sticky brings its own
  `background` (the theme's container token) and layer (`zIndexPopupBase`, the
  one the dock floats on and antd's popups sit above) with it.
- **`headerScrollFlag?: boolean`** puts `data-scrolled="true" | "false"` on the
  header once the page has moved — a HOOK and no paint, because a hairline
  versus a shadow versus a blur is a brand decision. It is driven by one
  `IntersectionObserver` on a 1px sentinel the shell renders above its own
  header (`SCROLL_SENTINEL_HEIGHT`), never a `scroll` listener running on every
  frame of a feed of photographs; the sentinel takes a pixel and gives it
  straight back, so it is a position in the page and not a change to it. Off,
  the attribute is absent rather than `"false"` — a host that did not ask for
  the observer must not be able to write a rule that silently never fires.

What this replaces, in one deployment: a restated `56`/`64` in the host's own
sheet, a unit test that read the installed `dist` as TEXT to hold them there
(the geometry was private, so the source was the only place it could be
checked), a `@media (min-width: 1200px)` block making the desktop header sticky,
and a container-owned `IntersectionObserver` for the shadow.

Nothing changes for a host that passes none of the three: the default arms are
the previous behaviour, and the root gains a class, a `data-phone-chrome`
attribute (the prop as DECLARED — the sheet's media query decides where it
applies) and one hoisted `<style>`.
