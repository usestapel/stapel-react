---
"@stapel/showcase": patch
---

Two new optional markers on `DemoVariant`, and the variant-distinctness guard.

`viewport?: "phone" | "tablet" | "desktop"` says which width a variant was designed for, so
the default-skin gate in `scripts/gen-demos.mjs` can require that every `/default` component
has been drawn at least once at 390px instead of only on a desktop. `step?: string` names
the flow step or bag state the variant is SEEDED at — the visual pass found stories whose
named state is only reachable by a click, so the shot is `idle` under three different names
(`auth.passwordless-login` `locked` == `default`, `cdn.single` `already-stored` ==
`default`, all three `reviews` write-a-review variants). Both travel into `demos.json` and,
when declared, into the generated CSF story as `Story.parameters.stapel`, so a shot runner
can select the width and assert the state. A demo that declares neither generates exactly
the artifacts it generated before.

`assertVariantsRenderDistinctly(demo, render)` / `duplicateVariantGroups(demo, render)` are
the guard itself: render every variant, group by identical markup, fail on a collision. It
compares DOM rather than source because the closures that collide differ textually
(`<D deduped={false}/>` vs `<D deduped/>`) — a static check passes them. The renderer is
injected (`renderToStaticMarkup` in a pair's vitest, a real DOM in a shot runner), so the
package stays viewer-agnostic and pulls in no react-dom.
