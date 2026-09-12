---
"@stapel/chat-react": minor
---

`<ConversationSplitPanel listWidth>`: the desktop inbox's list rail is a
proportion with a floor and a ceiling, not a constant.

The rail was 360px flat, and a fixed rail is wrong at one end of the range it
has to cover. Measured on a 1440 desktop of a client storefront: 360px of list
beside 1040px of EMPTY thread pane, and inside the rail a 49px avatar, a 130px
clock and a row menu left ~70px for the name, so a 22-character shop name
arrived as its first five letters.

The default is now `clamp(360px, 32%, 480px)` — the floor keeps the reference
rail on a narrow laptop, the ceiling stops a 2560px screen spending a third of
itself on previews, and between them the rail grows with the window. A host
whose names are longer or shorter says so with `listWidth`, a number of pixels
or any CSS length as written.
