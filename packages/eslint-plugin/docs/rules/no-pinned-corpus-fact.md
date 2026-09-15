# `stapel/no-pinned-corpus-fact`

> A probe asserts behaviour. A fact about the corpus it happened to run against
> is not behaviour — it is the weather on the day somebody typed it.

- **Type:** problem
- **Recommended:** yes — `error` in `configs.recommended` and `configs.strict`,
  on probe and end-to-end paths only.
- **Fixable:** no. The fix is a lookup — read the index, or create the row this
  run needs — and only the author knows which.

## The two worked examples

Both landed in the same week, both in a client fleet's `deploy/probes`.

### 1. The count

```js
// as it shipped
const finalCount = (await listings()).length;
out.cleanup.showcaseIntact = finalCount === 390;
```

390 was true on the day it was typed. The stand was seeded again, and the walk
began reporting `showcaseIntact: false` on runs where cleanup had worked
perfectly. **A gate that fails on the health of the fixture tells you nothing
about the behaviour.**

The first repair was worse, and looks right:

```js
out.cleanup.showcaseIntact = finalCount === initialCount;
```

The endpoint is keyset-paginated. Both reads ask for 500; the stand now holds
more than 500; so **both** return exactly 500 with `has_next: true`, and the
difference is zero whatever the walk leaves behind. A drift check above the page
cap cannot fail. (This rule does not report that one — there is no literal in
it. It is here because it is the trap you fall into while fixing the first.)

The repair that works asks about the **ids this run created**, one `GET` each,
expecting 404 — and reports "we could not ask" as its own state rather than
folding it into either verdict.

### 2. The id

```js
// as it ships, in three probes
const PHONE_LISTING = process.env.PHONE_LISTING || "1345";
…
await page.goto(`${BASE}/l/${PHONE_LISTING}`);
```

Listing 1345 was deleted by a reseed. The storefront is a SPA: `/l/<id>` answers
**200 for any id** — the router serves the shell, and the missing row becomes an
empty state inside it — so the probe never noticed it was measuring a page about
nothing, and walked on happily through every assertion that followed.

The fix for both is one sentence: **resolve it from the corpus at run time.**

## What the rule reports

Three shapes, each deliberately narrow. Precision is the whole design
constraint: a rule that cries about every number in a probe gets switched off,
and then it guards nothing.

### `pinnedCount`

An **equality** (`===`, `==`, `!==`, `!=`) between a count-shaped expression and
a numeric literal at or above `maxStructuralCount` (default 10).

```js
// ✗
finalCount === 390
listings.length !== 390
24 === chunk.length
expect(results.length).toBe(390)
expect(await cards.all()).toHaveLength(390)
```

Count-shaped means `.length` / `.size`, or a name whose last camelCase word is
`count`, `total`, `results`, `items`, `rows` or `hits`.

```js
// ✓ — a BOUND survives a reseed. This is the shape the rule is asking for.
cards.length > 0
rows.length >= 3
items.length <= 200

// ✓ — claims about BEHAVIOUR, not about how much the fixture holds
survivors.length === 0        // "cleanup left nothing"
sockets.length === 1          // "one socket per tab"

// ✓ — a relation between two reads, not a literal
finalCount === initialCount
```

Relational operators are silent on purpose: reporting them would tell an author
to stop doing the right thing. `=== 0` and `=== 1` are silent for the same
reason. The threshold is where "a handful, structurally" stops and "as many as
the seed made" starts — a judgement, so it is an option.

### `pinnedId`

An id-shaped literal standing as a whole **path segment** of a url, or as the
value of a query parameter whose name contains `id`.

```js
// ✗
await page.goto(`${BASE}/l/287`);
await page.goto("/l/261");
await page.goto(`${BASE}/u/7ad7069c-0ae3-4d04-bdf0-c21bc81473fc`);
await fetch("https://stand.example/listings/api/v1/listings/1345/");
await page.goto(`${BASE}/chat?listing_id=1345`);
```

Id-shaped is **three or more digits, or a uuid**. Path segments, not "numbers in
strings" — which is what keeps these quiet:

```js
// ✓ — a page size, an offset and a limit live in the QUERY
`${BASE}/listings/api/v1/listings/?limit=500&offset=1000`
// ✓ — a taxonomy axis in a query string; the path here is `/s`
`${BASE}/s?category=32/149/163`
// ✓ — a viewport, a timeout, a status code
await page.setViewportSize({ width: 1440, height: 900 })
```

Two further carve-outs, each found by tightening the rule against its own first
sweep:

- **A path on this machine.** `/private/tmp/…/6ce230c6-cb03-…/shots` is where
  the probe writes its artifacts, and a scratch directory named with a uuid is
  an id no reseed can take away from the run that made it.
- **A sentinel.** `/l/9999999` and `/u/99999999-0000-0000-0000-000000000000` are
  written down precisely so the probe can watch the service answer "no such
  thing". No reseed can delete a row that never existed, and telling their
  author to "resolve it from the corpus" asks for the opposite of what the
  assertion is for. Sentinels are ids whose digits are all the same, and uuids
  whose every group is one repeated character.

### `pinnedIdDefault`

```js
// ✗
const PHONE_LISTING = process.env.PHONE_LISTING || "1345";
await page.goto(`${BASE}/l/${PHONE_LISTING}`);
```

An env fallback to an id-shaped literal **whose binding is interpolated into a
url somewhere in the same file**. Both halves are required, and that is what
keeps these quiet:

```js
// ✓ — a number that is never a path segment is not an id
const PORT = process.env.PORT || "3000";
const LIMIT = process.env.LIMIT || "500";
// ✓ — id-shaped, but it never reaches a url
const SEED = process.env.SEED || "1345";
```

Reported at the **declaration**, because that is the line somebody has to
replace with a lookup.

## What it provably cannot catch

- **An id that is not id-shaped** — a slug (`/l/blue-sofa`), a two-digit id, a
  base64 or ULID key. Widening to "any path segment that is not a known route
  word" would fire on every literal route in every probe.
- **A corpus fact below the threshold** — `rows.length === 4` against a seed of
  four.
- **A pinned fact carried in from another module, a JSON fixture or a `.env`
  file.** The rule reads one file's syntax.
- **A pin expressed as a bound that is only true today** — `count > 300`.
- **An id resolved at run time and then wrongly reused.** Resolving it is all
  this rule asks for; it cannot tell a good lookup from a bad one.
- **The second defect above** — `finalCount === initialCount` above a page cap.
  There is no literal there, and lint cannot see the cap.

## Scope

Probe and end-to-end paths only: `deploy/probes/**`, `**/e2e/**`,
`**/walkers/**`, `**/probes/**`, `*.probe.*`, `*.e2e.*`. The rule carries that
scope **itself**, not only in the preset, so a consumer who never spreads
`configs.recommended` still gets the right answer.

**Not unit tests.** A unit test's corpus is its own fixture: deterministic by
construction, and `expect(parseRows(FIXTURE)).toHaveLength(390)` against a file
the test itself wrote is exactly right. The defect this rule is about exists
only where the corpus belongs to somebody else.

## Options

```js
"stapel/no-pinned-corpus-fact": [
  "error",
  { include: ["/smoke/"], maxStructuralCount: 5 },
]
```

| option | default | meaning |
| --- | --- | --- |
| `include` | `deploy/probes/`, `e2e/`, `walkers/`, `probes/`, `.probe.`, `.e2e.` | Path fragments that make a file a probe. |
| `maxStructuralCount` | `10` | The largest count that can still be a claim about structure rather than about the size of somebody's seed. At or above it, an equality is a corpus fact. |

## The sweep (2026-09-16)

Run at `error` over one client fleet's `deploy/probes/**` and `walkers/**` — 799
files — it reports **216** sites: 181 `pinnedId`, 30 `pinnedIdDefault`, 5
`pinnedCount`. Twelve distinct listing ids and four user uuids account for
nearly all of the id hits; the same four ids appear in dozens of walkers. See
`CHANGELOG.md` for the verdicts.

One wiring note for whoever adopts it: that fleet is a plain `.mjs` repository
with no `package.json` and no ESLint config, so the rule cannot run there until
one exists. It runs today from any checkout that has this plugin installed, and
the sweep above was produced that way.
