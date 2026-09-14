---
"@stapel/tokens-antd": patch
---

`lockPageScroll()` is exported from `/skin`.

The ref-counted root-element scroll lock `SkinDialog` held privately — `html { overflow: hidden; scrollbar-gutter: stable }` as inline style, the host's own inline values restored exactly when the last lock lets go, returns its unlock — is now the one copy every panel that stands over the page calls, instead of the private copies `SkinDialog` and `CategoryMegaMenu` each carried. `SkinDialog` itself now keeps the gutter too, so a page with a classic scrollbar no longer widens by 15px the moment a dialog opens. `pageScrollLockCount()` beside it, for tests.

Dark theme via `@stapel/tokens`: `colorBorder` and `colorBorderSecondary` are lighter (3:1 and above on every surface) and `colorTextTertiary` clears AA on a raised container.
