// stapel/no-pinned-corpus-fact — a probe asserts BEHAVIOUR. A fact about the
// corpus it happened to run against is not behaviour, it is the weather on the
// day somebody typed it.
//
// ── THE TWO DEFECTS ─────────────────────────────────────────────────────────
//
// Both from the same week, both in a client fleet's `deploy/probes`.
//
// 1. THE COUNT. `p54-demo-walk.mjs` asked "did the walk give back everything it
//    took?" like this:
//
//        const finalCount = (await listings()).length;
//        out.cleanup.showcaseIntact = finalCount === 390;
//
//    390 was true on the day it was typed. The stand was seeded again and the
//    walk began reporting `showcaseIntact: false` on runs where cleanup had
//    worked perfectly — a gate failing on the health of the FIXTURE tells you
//    nothing about the behaviour. (The first repair, `finalCount ===
//    initialCount`, was worse and looks right: the endpoint is keyset-
//    paginated, both reads ask for 500, the stand holds more than 500, so BOTH
//    return exactly 500 and the difference is zero whatever the walk leaves
//    behind. A drift check above the page cap cannot fail. That is not this
//    rule's business — no literal — but it is why the fix was to ask about
//    the IDS the run created, one `GET` each, expecting 404.)
//
// 2. THE ID. `p53-contacts.mjs`, `p56-widths.mjs` and `p62-review-1024.mjs`
//    each carry:
//
//        const PHONE_LISTING = process.env.PHONE_LISTING || "1345";
//        …
//        await page.goto(`${BASE}/l/${PHONE_LISTING}`);
//
//    Listing 1345 was deleted by a reseed. The storefront is a SPA: `/l/<id>`
//    answers 200 for any id — the router serves the shell and the missing row
//    becomes an empty state inside it — so the probe never noticed it was
//    measuring a page about nothing, and walked on happily through every
//    assertion that followed.
//
// The fix for both is the same sentence: RESOLVE IT FROM THE CORPUS AT RUN
// TIME. Ask the listing index for an id and use that one; count what you
// created and ask about those ids; assert a bound ("at least one card") or a
// relation ("every id this run created is gone"), never an equality with a
// number nobody will re-derive.
//
// ── THE DETECTION BOUNDARY (precision over recall, deliberately) ────────────
//
// A rule that cries about every number in a probe gets switched off, and then
// it guards nothing. Three shapes, each narrow, each its own message.
//
// `pinnedCount` — an EQUALITY (`===`, `==`, `!==`, `!=`) between a
//     count-shaped expression and a numeric literal at or above
//     `maxStructuralCount` (default 10). Count-shaped means `.length`/`.size`,
//     or a name whose last camelCase word is one of `count`, `total`,
//     `results`, `items`, `rows`, `hits`. Also `expect(<count>).toBe(n)` /
//     `.toEqual(n)` / `.toStrictEqual(n)`, and `expect(<anything>)
//     .toHaveLength(n)`.
//
//     RELATIONAL comparisons are deliberately silent. `cards.length > 0`,
//     `rows.length >= 3` state a BOUND, and a bound survives a reseed — it is
//     the shape the rule is asking for, so reporting it would be telling an
//     author to stop doing the right thing. `=== 0` and `=== 1` are silent for
//     the same reason: "empty" and "exactly one" are claims about behaviour
//     ("cleanup left nothing", "one row per user"), not about how much the
//     fixture happens to hold. The threshold is where "a handful, structurally"
//     stops and "as many as the seed made" starts; it is an option because
//     that line is a judgement.
//
// `pinnedIdInUrl` — an id-shaped literal standing as a whole PATH SEGMENT of a
//     url: `/l/1345`, `` `${BASE}/l/1345` ``, `https://…/issues/4f2c…`. Also an
//     id-shaped value of a query parameter whose name contains `id`
//     (`?listing_id=1345`). Id-shaped is three or more digits, or a uuid.
//
//     PATH SEGMENTS, not "numbers in strings": `?limit=500`, `?page=2`,
//     `v1`, a viewport of 1440 and a timeout of 60000 are all invisible to it,
//     because none of them sits between two slashes. Two digits is not enough
//     to be an id; three is the smallest the fleet actually mints.
//
// `pinnedIdDefault` — `process.env.X || "1345"` (or `??`) where the fallback is
//     id-shaped AND the binding it names is interpolated into a url somewhere
//     in the same file. Both halves are required, which is what keeps
//     `process.env.PORT || "3000"` and `process.env.LIMIT || "500"` quiet: a
//     number that is never a path segment is not an id. Reported at the
//     DECLARATION, because that is the line somebody has to replace with a
//     lookup.
//
// WHAT IT PROVABLY CANNOT CATCH:
//
//   * an id that is not id-shaped — a slug (`/l/blue-sofa`), a two-digit id, a
//     base64 or ULID key. Widening to "any path segment that is not a known
//     route word" would fire on every literal route in every probe;
//   * a corpus fact below the threshold — `rows.length === 4` against a seed of
//     four;
//   * a pinned fact carried in a variable from another module, a JSON fixture
//     or a `.env` file — the rule reads one file's syntax;
//   * a pin expressed as a bound that is only true today (`count > 300`);
//   * an id resolved at run time and then WRONGLY reused — resolving it is all
//     this rule asks for, and it cannot tell a good lookup from a bad one;
//   * the second `p54` defect: `finalCount === initialCount` above a page cap.
//     There is no literal there. A comparison of two reads through the same
//     capped page is a *pagination* defect, and lint cannot see the cap.
//
// ── SCOPE ───────────────────────────────────────────────────────────────────
//
// Probe and end-to-end paths only — `deploy/probes/**`, `**/e2e/**`,
// `**/walkers/**`, `*.probe.*`, `*.e2e.*` (`options.include` overrides). NOT
// unit tests: a unit test's corpus is its own fixture, it is deterministic by
// construction, and `expect(parsed).toHaveLength(12)` against a file the test
// itself wrote is exactly right. The defect this rule is about only exists
// where the corpus belongs to somebody else.
import { normalizedFilename } from "../lib/jsx.js";

/** Path fragments that make a file a probe / end-to-end walker. */
const DEFAULT_INCLUDE = [
  "/deploy/probes/",
  "/e2e/",
  "/walkers/",
  "/probes/",
  ".probe.",
  ".e2e.",
];

/** Split a camelCase / snake_case name into its words. */
function wordsOf(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .filter(Boolean);
}

/** Names whose last word means "how many". */
const COUNT_WORDS = new Set([
  "count",
  "total",
  "results",
  "items",
  "rows",
  "hits",
  "length",
  "size",
]);

/** Equality is a corpus fact; a relation is a bound. Only equality is graded. */
const EQUALITY_OPERATORS = new Set(["===", "==", "!==", "!="]);

/** Matchers that pin an exact number. */
const EXACT_MATCHERS = new Set(["toBe", "toEqual", "toStrictEqual"]);

/** An id standing as a whole path segment: three or more digits, or a uuid. */
const ID_SEGMENT = String.raw`(?:\d{3,}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`;
const ID_IN_PATH_RE = new RegExp(String.raw`/(${ID_SEGMENT})(?=[/,;]|$)`);
const ID_IN_QUERY_RE = new RegExp(
  String.raw`[?&][\w.-]*id[\w.-]*=(${ID_SEGMENT})(?=[&#]|$)`,
  "i",
);
const ID_SHAPED_RE = new RegExp(String.raw`^${ID_SEGMENT}$`);

/**
 * A path that belongs to the FILESYSTEM, not to the service under test. A
 * probe writes its artifacts somewhere, and a scratch directory's name is
 * often a uuid — which is an id nobody can delete out from under the run.
 */
const FS_PATH_RE =
  /^(?:\.{1,2}\/|\/(?:Users|home|tmp|private|var|opt|etc|mnt|srv|root|usr|proc|dev|Volumes|System|Library)\/)|\/node_modules\/|\.(?:json|png|jpe?g|webp|gif|svg|pdf|mjs|cjs|[jt]sx?|txt|log|html?|css|md|ya?ml|sh|py|zip|har)$/;

/**
 * A SENTINEL id: one nobody ever minted, written down precisely so the probe
 * can watch the service answer "no such thing". `/l/9999999` and
 * `/u/99999999-0000-0000-0000-000000000000` are not corpus facts — no reseed
 * can delete a row that never existed — and a rule that told their author to
 * "resolve it from the corpus at run time" would be asking for the opposite of
 * what the assertion is for.
 */
const SENTINEL_DIGITS_RE = /^(\d)\1*$/;
const SENTINEL_UUID_RE = /^([0-9a-f])\1{7}-(?:([0-9a-f])\2{3}-){3}([0-9a-f])\3{11}$/i;

/**
 * A hole placeholder that can never be part of a path segment or a number, so
 * blanking `${…}` cannot invent an id and cannot join two segments into one.
 */
const HOLE = " ";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a probe or end-to-end walker pinning an entity id or a corpus count as a literal; resolve it from the corpus at run time.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Path fragments that make a file a probe. */
          include: { type: "array", items: { type: "string" } },
          /**
           * The largest count that can still be a claim about STRUCTURE rather
           * than about the size of somebody's seed. At or above it, an equality
           * is a corpus fact.
           */
          maxStructuralCount: { type: "integer", minimum: 2 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      pinnedCount:
        'A probe must not pin a count: `{{text}}` is true of the corpus somebody seeded, not of the behaviour under test. It fails on a reseed that worked perfectly and passes on a regression that left the same number of rows. Count what this run created and ask about those, or assert a bound (`> 0`).',
      pinnedId:
        'A probe must not pin an entity id: "{{value}}" in `{{text}}` is a row somebody else may delete. A SPA answers 200 for any `/l/<id>`, so a probe against a deleted row walks on through every assertion that follows. Resolve an id from the corpus at run time (read the index, or create the row this run needs).',
      pinnedIdDefault:
        'A probe must not default an id to a literal: `{{name}}` falls back to "{{value}}", and that row is one reseed from gone — the url built from it still answers 200. Resolve it from the corpus at run time, or fail loudly when the environment did not supply one.',
    },
  },
  create(context) {
    const filename = normalizedFilename(context);
    const options = context.options[0] ?? {};
    const include = options.include ?? DEFAULT_INCLUDE;
    if (!include.some((fragment) => filename.includes(fragment))) return {};
    const maxStructuralCount = options.maxStructuralCount ?? 10;

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** `NAME → { node, value }` for env defaults that fall back to an id. */
    const envIdDefaults = new Map();
    /** Identifier names interpolated into something url-shaped. */
    const namesInUrls = new Set();

    // ── shapes ───────────────────────────────────────────────────────────────

    /** The trailing word of an identifier / property name, lowercased. */
    function lastWord(name) {
      const words = wordsOf(name);
      return (words[words.length - 1] ?? name).toLowerCase();
    }

    /** Does this expression name "how many of something"? */
    function isCountShaped(node) {
      if (!node) return false;
      if (node.type === "Identifier") return COUNT_WORDS.has(lastWord(node.name));
      if (node.type === "MemberExpression" && !node.computed) {
        return (
          node.property.type === "Identifier" &&
          COUNT_WORDS.has(lastWord(node.property.name))
        );
      }
      if (node.type === "AwaitExpression") return isCountShaped(node.argument);
      if (node.type === "TSNonNullExpression") return isCountShaped(node.expression);
      return false;
    }

    /** A numeric literal at or above the structural ceiling, or null. */
    function pinnedNumber(node) {
      const inner = node?.type === "TSAsExpression" ? node.expression : node;
      if (!inner || inner.type !== "Literal" || typeof inner.value !== "number") {
        return null;
      }
      if (!Number.isInteger(inner.value)) return null;
      return Math.abs(inner.value) >= maxStructuralCount ? inner.value : null;
    }

    /** The source text of a node, clipped for a message. */
    function textOf(node) {
      return sourceCode.getText(node).replace(/\s+/g, " ").slice(0, 60);
    }

    /**
     * A string / template flattened for url inspection, with every `${…}`
     * replaced by a placeholder that can neither be an id nor join two
     * segments. Returns null for anything that is not a static-ish string.
     */
    function urlText(node) {
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      if (node.type !== "TemplateLiteral") return null;
      let out = "";
      node.quasis.forEach((quasi, index) => {
        out += quasi.value.cooked ?? quasi.value.raw;
        if (node.expressions[index] !== undefined) out += HOLE;
      });
      return out;
    }

    /** Is this text a url or a url path -- and not a file on this machine? */
    function looksLikeUrl(text) {
      const trimmed = text.trim();
      if (FS_PATH_RE.test(trimmed)) return false;
      return /^https?:\/\//.test(trimmed) || /(?:^| )\/[\w\-.~%{$]/.test(text);
    }

    /** An id written down precisely because it does not exist. */
    function isSentinel(id) {
      return SENTINEL_DIGITS_RE.test(id) || SENTINEL_UUID_RE.test(id);
    }

    /**
     * The first pinned id in a url text, or null. The PATH is everything before
     * the first `?` or `#`: digits inside a query string are page sizes, axis
     * ids and category filters (`/s?category=32/149/163`), and only a query
     * parameter that SAYS it is an id is graded.
     */
    function pinnedIdIn(text) {
      const path = text.split(/[?#]/)[0];
      const found = ID_IN_PATH_RE.exec(path)?.[1] ?? ID_IN_QUERY_RE.exec(text)?.[1] ?? null;
      if (found === null || isSentinel(found)) return null;
      return found;
    }

    /** `process.env.X` (or `process.env["X"]`). */
    function isProcessEnv(node) {
      return (
        node?.type === "MemberExpression" &&
        node.object?.type === "MemberExpression" &&
        node.object.object?.type === "Identifier" &&
        node.object.object.name === "process" &&
        node.object.property?.type === "Identifier" &&
        node.object.property.name === "env"
      );
    }

    // ── visitors ─────────────────────────────────────────────────────────────

    return {
      // `finalCount === 390`
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return;
        const leftNumber = pinnedNumber(node.left);
        const rightNumber = pinnedNumber(node.right);
        const counted =
          rightNumber !== null && isCountShaped(node.left)
            ? node
            : leftNumber !== null && isCountShaped(node.right)
              ? node
              : null;
        if (counted === null) return;
        context.report({
          node,
          messageId: "pinnedCount",
          data: { text: textOf(node) },
        });
      },

      // `expect(finalCount).toBe(390)` / `expect(cards).toHaveLength(390)`
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.computed) return;
        if (callee.property.type !== "Identifier") return;
        const matcher = callee.property.name;
        const isLength = matcher === "toHaveLength";
        if (!isLength && !EXACT_MATCHERS.has(matcher)) return;
        const pinned = pinnedNumber(node.arguments[0]);
        if (pinned === null) return;

        // Unwrap `expect(x)` / `expect(x).resolves` / `.not`.
        let receiver = callee.object;
        while (
          receiver?.type === "MemberExpression" &&
          !receiver.computed &&
          receiver.property.type === "Identifier"
        ) {
          receiver = receiver.object;
        }
        if (
          receiver?.type !== "CallExpression" ||
          receiver.callee?.type !== "Identifier" ||
          receiver.callee.name !== "expect"
        ) {
          return;
        }
        const subject = receiver.arguments[0];
        if (!isLength && !isCountShaped(subject)) return;
        context.report({
          node,
          messageId: "pinnedCount",
          data: { text: textOf(node) },
        });
      },

      // `"/l/1345"`, `` `${BASE}/l/1345` ``
      Literal(node) {
        if (typeof node.value !== "string") return;
        gradeUrl(node);
      },

      TemplateLiteral(node) {
        if (node.parent?.type === "TaggedTemplateExpression") return;
        gradeUrl(node);
        // Remember which bindings are interpolated into a url, for the env
        // default below: an id that never reaches a url is not this rule's
        // business.
        const text = urlText(node);
        if (text === null || !looksLikeUrl(text)) return;
        for (const hole of node.expressions) {
          if (hole.type === "Identifier") namesInUrls.add(hole.name);
        }
      },

      // `const PHONE_LISTING = process.env.PHONE_LISTING || "1345";`
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !node.init) return;
        const init = node.init;
        if (init.type !== "LogicalExpression") return;
        if (init.operator !== "||" && init.operator !== "??") return;
        if (!isProcessEnv(init.left)) return;
        const fallback = init.right;
        const value =
          fallback.type === "Literal"
            ? String(fallback.value)
            : null;
        if (value === null || !ID_SHAPED_RE.test(value)) return;
        envIdDefaults.set(node.id.name, { node, value });
      },

      "Program:exit"() {
        for (const [name, hit] of envIdDefaults) {
          if (!namesInUrls.has(name)) continue;
          context.report({
            node: hit.node,
            messageId: "pinnedIdDefault",
            data: { name, value: hit.value },
          });
        }
      },
    };

    function gradeUrl(node) {
      const text = urlText(node);
      if (text === null || !looksLikeUrl(text)) return;
      const id = pinnedIdIn(text);
      if (id === null) return;
      context.report({
        node,
        messageId: "pinnedId",
        data: { value: id, text: textOf(node) },
      });
    }
  },
};
