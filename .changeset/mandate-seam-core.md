---
"@stapel/core": minor
---

The mandate axis becomes a seam, plus the two bones every upload shares

`MandateSource` / `MandateProvider` / `useMandate` / `useMandatePrincipal`
split READING the mandate axis from DERIVING it. Until now the only
derivation lived in `@stapel/workspaces-react`, so a surface that merely
wanted to know "does this person hold a mandate?" had to import the
multi-tenant machinery — impossible for a public storefront, which has no
workspace list to ask. Core takes the provider of the axis and never learns
what a workspace is. Outside a provider, `useMandate()` answers
`unresolved / unavailable` naming the missing wiring: not a throw that blanks
the subtree, and not a principal invented out of a wiring bug. The provider
compares the answer before republishing, so a source that rebuilds its state
every render (every query-backed one does) cannot re-fire the effects that
watch the axis.

Two upload primitives join core, both endpoint-free — the shared bones under
three DIFFERENT upload contracts (cdn multipart, docs presign+finalize,
recordings session+PUT+finalize), which stay in their own pairs:

- `putToForeignOrigin(url, blob, opts)` — the bare PUT at an object store,
  with none of the transport's auth binding, folding a non-2xx into
  `StapelApiError{code: "stapel.http.<n>"}` instead of handing back a
  `Response` that every caller re-wraps differently.
- `useObjectUrlPreview(file)` — a local preview whose `revokeObjectURL` is
  structural: replace, clear and unmount all balance by construction.
