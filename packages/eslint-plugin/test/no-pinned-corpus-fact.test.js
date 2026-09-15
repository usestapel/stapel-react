// The shapes here are TRANSCRIBED from the two probes that broke this week and
// from the sweep that followed. The invalid cases are what the probes said; the
// valid cases are what the repaired probe says, plus every shape the first
// sweep had to be tightened to stay quiet on — a scratch directory whose name
// is a uuid, a category axis inside a query string, a sentinel id written down
// precisely because no such row exists.
import rule from "../rules/no-pinned-corpus-fact.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const PROBE = "/fleet/deploy/probes/p54-demo-walk.mjs";
const WIDTHS = "/fleet/deploy/probes/p56-widths.mjs";
const WALKER = "/fleet/walkers/mobile/e2e/probe-misc.mjs";
const UNIT = "/repo/packages/listings-react/test/cardGallery.test.ts";
const SRC = "/repo/packages/listings-react/src/default/cardGallery.ts";

tester.run("no-pinned-corpus-fact", rule, {
  valid: [
    // ── the repaired p54 ──────────────────────────────────────────────────
    //
    // An id is not paginated. 404 is the listing being gone, 200 is it still
    // standing, and "we could not ask" is its own state. Nothing here is a
    // number somebody typed: the ids come from what this run created.
    {
      filename: PROBE,
      code:
        "const created = [...out.cleanup.createdIds];\n" +
        "for (const id of created) {\n" +
        "  const r = await fetch(`${BASE}/listings/api/v1/listings/${id}/`);\n" +
        "  if (r.status === 200) survivors.push(id);\n" +
        "  else if (r.status !== 404) unreadable.push({ id, status: r.status });\n" +
        "}\n" +
        "out.cleanup.showcaseIntact = unreadable.length > 0 ? null : survivors.length === 0;",
    },
    // A BOUND survives a reseed, and it is the shape the rule is asking for.
    {
      filename: PROBE,
      code:
        "if (cards.length > 0 && rows.length >= 3 && items.length <= 200) ok = true;",
    },
    // `=== 0` and `=== 1` are claims about BEHAVIOUR — "cleanup left nothing",
    // "one row per user" — not about how much the fixture holds.
    {
      filename: PROBE,
      code: "const clean = survivors.length === 0 && sockets.length === 1;",
    },
    // A relation between two reads, not a literal.
    {
      filename: PROBE,
      code: "out.drift = finalCount === initialCount;",
    },
    // A number that is not a count: a viewport, a timeout, a status.
    {
      filename: PROBE,
      code:
        "await page.setViewportSize({ width: 1440, height: 900 });\n" +
        "await page.goto(url, { timeout: 60000 });\n" +
        "if (r.status === 200 && r.status !== 404) ok = true;",
    },
    // An id RESOLVED from the corpus at run time — the whole point.
    {
      filename: WIDTHS,
      code:
        "const index = await (await fetch(`${BASE}/listings/api/v1/listings/?limit=1`)).json();\n" +
        "const id = index.items[0].id;\n" +
        "await page.goto(`${BASE}/l/${id}`);",
    },
    // A page size, an offset and a limit are not ids: they sit in the QUERY.
    {
      filename: PROBE,
      code:
        "await fetch(`${BASE}/listings/api/v1/listings/?limit=500&offset=1000`);",
    },
    // A category AXIS inside a query string. `32/149/163` is a taxonomy path,
    // not an entity id, and the path here is `/s`.
    {
      filename: WALKER,
      code: 'await page.goto(`${BASE}/s?category=32/149/163`);',
    },
    // A SENTINEL: written down precisely so the probe can watch the service
    // answer "no such thing". No reseed can delete a row that never existed.
    {
      filename: WALKER,
      code:
        'await page.goto(`${BASE}/l/9999999`);\n' +
        'await page.goto(`${BASE}/u/99999999-0000-0000-0000-000000000000`);',
    },
    // A path on THIS MACHINE. A scratch directory is often named with a uuid,
    // and it is an id no reseed can take away from the run that made it.
    {
      filename: PROBE,
      code:
        'const OUT = "/private/tmp/claude-501/6ce230c6-cb03-40f4-9770-e57272065c82/shots";\n' +
        'writeFileSync(`${OUT}/p54.json`, body);',
    },
    // An env default that is NOT an id — a port, a page size, a timeout — and
    // is never interpolated into a url.
    {
      filename: PROBE,
      code:
        'const PORT = process.env.PORT || "3000";\n' +
        'const LIMIT = process.env.LIMIT || "500";\n' +
        "server.listen(Number(PORT));",
    },
    // An env default that IS id-shaped but never reaches a url: the rule wants
    // both halves before it says anything.
    {
      filename: PROBE,
      code:
        'const SEED = process.env.SEED || "1345";\n' +
        "out.seed = SEED;",
    },
    // A FLUSH, not a corpus fact. The batch size is the number this very code
    // chose; nothing reseeds it, and the buffer is emptied in the branch the
    // comparison guards. All five of the rule's first-pass count hits across a
    // fleet's 799 walkers were this one shape.
    {
      filename: WALKER,
      code:
        "let chunk = [];\n" +
        "for (const y of offsets) {\n" +
        "  chunk.push({ at: y, b64: await band() });\n" +
        "  if (chunk.length === 24) { foreign.push(...(await scanFrames(chunk))); chunk = []; }\n" +
        "}",
    },
    // …and the same flush written with `splice`.
    {
      filename: WALKER,
      code:
        "if (buf.length === 50) {\n" +
        "  await send(buf);\n" +
        "  buf.splice(0);\n" +
        "}",
    },
    // OUT OF SCOPE — a unit test's corpus is its own fixture. Deterministic by
    // construction, and `toHaveLength(24)` against a file the test itself wrote
    // is exactly right.
    {
      filename: UNIT,
      code:
        "it('parses', () => {\n" +
        "  expect(parseRows(FIXTURE)).toHaveLength(390);\n" +
        "  expect(rows.length === 390).toBe(true);\n" +
        "});",
    },
    // OUT OF SCOPE — product source.
    {
      filename: SRC,
      code: 'export const SAMPLE = "/l/1345";',
    },
  ],

  invalid: [
    // ── p54, as it shipped ────────────────────────────────────────────────
    //
    // 390 was true on the day it was typed. The stand was seeded again and the
    // walk began reporting `showcaseIntact: false` on runs where cleanup had
    // worked perfectly.
    {
      filename: PROBE,
      code: "out.cleanup.showcaseIntact = finalCount === 390;",
      errors: [{ messageId: "pinnedCount" }],
    },
    // The same claim through `.length`, and through an inequality.
    {
      filename: PROBE,
      code: "if (listings.length !== 390) out.errors.push('seed moved');",
      errors: [{ messageId: "pinnedCount" }],
    },
    {
      filename: PROBE,
      code: "const ok = 24 === chunk.length;",
      errors: [{ messageId: "pinnedCount" }],
    },
    // A walker written with a test runner says it the same way.
    {
      filename: WALKER,
      code: "expect(results.length).toBe(390);",
      errors: [{ messageId: "pinnedCount" }],
    },
    {
      filename: WALKER,
      code: "expect(await page.locator('[data-testid=card]').all()).toHaveLength(390);",
      errors: [{ messageId: "pinnedCount" }],
    },
    // ── p53 / p56 / p62, as they ship ─────────────────────────────────────
    //
    // Listing 1345 was deleted by a reseed. `/l/<id>` answers 200 for any id,
    // so the probe walked on through every assertion that followed.
    {
      filename: WIDTHS,
      code:
        'const PHONE_LISTING = process.env.PHONE_LISTING || "1345";\n' +
        "await page.goto(`${BASE}/l/${PHONE_LISTING}`);",
      errors: [
        { messageId: "pinnedIdDefault", data: { name: "PHONE_LISTING", value: "1345" } },
      ],
    },
    // `??` says the same thing.
    {
      filename: WIDTHS,
      code:
        'const SELLER_ID = process.env.SELLER_ID ?? "245efbe3-2fbb-4480-9cbc-320369c2552c";\n' +
        "await page.goto(`${BASE}/u/${SELLER_ID}`);",
      errors: [{ messageId: "pinnedIdDefault" }],
    },
    // The id written straight into the url.
    {
      filename: WALKER,
      code: 'await page.goto(`${BASE}/l/287`);',
      errors: [{ messageId: "pinnedId" } /* 287 */],
    },
    {
      filename: WALKER,
      code: 'await page.goto("/l/261");',
      errors: [{ messageId: "pinnedId" } /* 261 */],
    },
    // A uuid in a path is an id too.
    {
      filename: WALKER,
      code: 'await page.goto(`${BASE}/u/7ad7069c-0ae3-4d04-bdf0-c21bc81473fc`);',
      errors: [{ messageId: "pinnedId" }],
    },
    // An absolute url.
    {
      filename: WALKER,
      code: 'const r = await fetch("https://stand.example/listings/api/v1/listings/1345/");',
      errors: [{ messageId: "pinnedId" } /* 1345 */],
    },
    // A query parameter that SAYS it is an id.
    {
      filename: WALKER,
      code: 'await page.goto(`${BASE}/chat?listing_id=1345`);',
      errors: [{ messageId: "pinnedId" } /* 1345 */],
    },
    // The threshold is an option, and lowering it arms the rule on the smaller
    // claims a fleet with a small seed cares about.
    {
      filename: PROBE,
      code: "const ok = rows.length === 4;",
      options: [{ maxStructuralCount: 3 }],
      errors: [{ messageId: "pinnedCount" }],
    },
    // `include` puts the rule on a path its defaults do not name.
    {
      filename: "/fleet/smoke/checkout.mjs",
      code: 'await page.goto(`${BASE}/l/1345`);',
      options: [{ include: ["/smoke/"] }],
      errors: [{ messageId: "pinnedId" }],
    },
  ],
});
