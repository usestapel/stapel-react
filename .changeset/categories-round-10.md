---
"@stapel/categories-react": minor
---

`tn_children_pks` is no longer the answer to "does this row have children" —
stapel-categories 0.20.5 sends `children_pks`/`children_count`, the reader's
own LIVE set, because the treenode column counts soft-deleted and retired
rows too. A live "services" root showed the defect exactly:
`tn_children_pks: "68,67,221"` while only `221` was fetchable, so a rule
built on the column saw two ghosts and missed a one-child wrapper.

Every rule in this pair that read `tn_children_pks` for that question now
reads `children_pks`/`children_count` first: `hasChildren`, `browseStage`,
`childControl`, `isTransparentWrapper`/`isWrapperAncestor`, the cascade's
leaf detection (`categoryChildIds`), and `CategoryPage`'s tile/wrapper
decisions, which all run through the same fallback chain.
`tn_children_pks` is still read, but only as a FALLBACK for a server
predating 0.20.5 — a dev build warns by name when a reader falls back to it.

New export: `categoryLiveChildCount`, the same preference chain as
`hasChildren` but returning the count itself rather than a boolean, for a
caller that needs to know "exactly one" (`isWrapperAncestor`). `Category`
and `CategoryTreeNode` gain the two fields as optional extensions, so a
build against an older pin keeps compiling.
