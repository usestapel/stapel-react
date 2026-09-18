---
"@stapel/profiles-react": patch
---

`<PersonRow>`'s name is allowed to give way, so its ellipsis can fire.

A client storefront's listing page drew a shop's long display name straight
through the seller panel's right edge, clipped by the panel border — no
ellipsis, no wrap. The name already asked antd for an ellipsis, and antd's
ellipsis span is `max-width: 100%` of its parent; the parent is a flex item —
the anchor the row wraps the name in — whose default `min-width: auto` refuses
to shrink below its content. "100%" was therefore 100% of a box that never
gave way.

The name text and the link around it now both carry `min-inline-size: 0` and
`max-inline-size: 100%`, so neither end of the line is the rigid one. Nothing
is lost to the cut: a CSS ellipsis truncates the paint, never the text, and
the whole name stays in the DOM and in the accessibility tree.
