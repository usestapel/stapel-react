---
"@stapel/alerts-react": patch
---

pin stapel-alerts 0.2.1: IssuePage from the schema, limit parameter

The contract caught up with the wire, so the pair stops correcting it.

**`IssuePage` is generated.** `docs/schema.json` now declares `GET /issues`
as the `{count, offset, limit, results}` envelope the view always returned;
the hand-declared type goes and `api/types.ts` re-exports the schema's.
`test/pair.test.ts` still proves the envelope on the wire — a generated type
is a statement about the contract, and the rows a screen draws come from the
body.

**`useIssues(filters)` takes `limit`.** `?limit=` is a parameter (1..200,
server default 50 when omitted). The server clamps rather than refuses and
echoes the size it applied, and the hook pages by that echo, never by the
number it asked for — a request for 500 rows cut to 200 does not skip 300.
`limit` rides in the filter key like the offset does, because a different
page size is a different server answer. It is a view setting, not a filter:
the feed's empty state does not count it, and "Clear" keeps it.

**`mute` sends the deadline alone.** `muted_until` on its own is a mute —
the store infers `status: "muted"` from it — so the patch no longer carries
a status. The key itself is still always sent (`null` for "forever"): a patch
without it is a note, not a mute.

**A non-muted row never carries a deadline.** Every transition out of `muted`
now clears `muted_until`, so the detail's "draw the deadline only while
muted" is no longer a workaround for a stale field but the plain rule that a
deadline belongs to the muted status. The test that fed a fixed row a stale
deadline exercised a wire state the backend can no longer produce and is
gone.
