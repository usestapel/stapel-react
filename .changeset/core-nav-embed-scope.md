---
"@stapel/core": minor
---

`NavEmbed` gains `scope: { navEntry }` and `routeProps: { <prop>: <route param> }`,
so a pair can offer an action to another pair's page: `page.actions` is now a
page slot that the scoped page renders, not a chrome. New `resolveEmbedProps(embed,
params)` merges static props with the page's route params (`null` when a mapped
param is missing) and `embedsForPage(embeds, navEntry)` returns a page's embeds in
render order. `gen:nav` requires a scope on `page.actions`, refuses one on chrome
slots, and checks that `scope.navEntry` is installed and that every `routeProps`
value is a `:param` of its path.
