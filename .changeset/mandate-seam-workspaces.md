---
"@stapel/workspaces-react": minor
---

`useMandateSource()` — this module's derivation in the shape core's
`<MandateProvider>` takes. A screen reads the axis with `useMandate()` from
`@stapel/core` and no longer imports this package to do it, which is what
lets the same screen work on a public surface that has no workspace list at
all. `useMandateState()` and its behaviour are unchanged; the `@stapel/core`
floor rises to the release that carries the seam.
