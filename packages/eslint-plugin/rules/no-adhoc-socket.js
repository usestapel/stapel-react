// stapel/no-adhoc-socket — one socket client for the fleet.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
//
// `new WebSocket(url)` lives in exactly one package: `@stapel/realtime`.
// Everywhere else a stream is reached through `createSignalClient(...)` /
// `useSignalInvalidate(...)`, and everywhere else this rule fires.
//
// ── WHY A SECOND SOCKET IS NEVER JUST A SECOND SOCKET ───────────────────────
//
// A WebSocket looks like four lines and is not. The one client the fleet has
// written so far (chat-react's `src/realtime/chatSocket.ts`, 304 lines) is
// well built, and it still has to carry: exponential backoff with full jitter;
// a retry budget that ends in a terminal state instead of a hot loop; which
// close codes are terminal (4401/4403/4404) and which reconnect (4408
// heartbeat, 4410 revoked, 4413 overflow); a `hello{last_seq}` resume cursor
// re-read on every reconnect; sequence dedup across a replay; a `ping`→`pong`
// answer, without which the server closes the connection every heartbeat
// window and the client "reconnects" forever; and a 4401 routed into
// `SessionManager`'s single-flight refresh, exactly once, before giving up —
// the socket twin of the HTTP 401 rule `no-adhoc-401` already enforces.
//
// Every one of those is invisible when the code is written and expensive when
// it is missing. Two of them are missing in the fleet's only implementation
// right now (no `ping` case; a 4401 that silently degrades to polling with no
// refresh and nothing shown to the person). A second hand-rolled client would
// not inherit the fixes; it would inherit the bugs, a year later, in a package
// nobody thinks to look at.
//
// This is the TypeScript half of stapel-core's Python RT001-RT003 checks. The
// backend has said for two releases that the socket layer is one implementation;
// this is the same sentence on the frontend.
//
// ── WHAT IS ALLOWED ─────────────────────────────────────────────────────────
//
//   - the package `@stapel/realtime` itself (by package NAME, resolved from
//     the nearest package.json — not by path shape, so a moved directory or a
//     consumer's `node_modules` copy is judged the same way);
//   - test files, which must be able to construct a fake or drive a real one;
//   - anything named in `allowPackages` — which is how a pair mid-cutover
//     (chat-react, until `src/realtime/*` is deleted) buys itself a release
//     without switching the rule off fleet-wide.
//
// `EventSource` is included for the same reason and with the same argument: it
// is a stream with a reconnect policy and an auth story, and it has neither
// until someone writes them twice.
import { isTestPath, normalizedFilename, packageNameFor } from "../lib/jsx.js";

const DEFAULT_CONSTRUCTORS = ["WebSocket", "EventSource"];
const DEFAULT_ALLOW_PACKAGES = ["@stapel/realtime"];

/** `new WebSocket(…)`, `new window.WebSocket(…)`, `new globalThis.WebSocket(…)`. */
function constructorName(callee) {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed) {
    const object = callee.object;
    const objectName =
      object.type === "Identifier"
        ? object.name
        : object.type === "MemberExpression" && object.property.type === "Identifier"
          ? object.property.name
          : null;
    const isGlobal =
      objectName === "window" || objectName === "globalThis" || objectName === "self";
    if (isGlobal && callee.property.type === "Identifier") return callee.property.name;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow constructing a WebSocket/EventSource outside @stapel/realtime; streams are reached through the shared signal client.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Global constructors that open a stream. */
          constructors: { type: "array", items: { type: "string" } },
          /** Package names allowed to construct one. */
          allowPackages: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      adhocSocket:
        'Ad-hoc `new {{name}}(…)` outside @stapel/realtime{{where}}. A socket is four lines and a year of policy: backoff with jitter, a retry budget that terminates, terminal vs retryable close codes (4401/4403/4404 vs 4408/4410/4413), a `hello{last_seq}` resume cursor re-read on every reconnect, sequence dedup across replay, a `ping`→`pong` answer (without it the server closes every heartbeat window and the "reconnect" loop is permanent), and a 4401 routed ONCE through SessionManager\'s single-flight refresh before giving up — the socket twin of stapel/no-adhoc-401. Subscribe through `createSignalClient({ url, session })` / `useSignalInvalidate(stream, keysFor)` from "@stapel/realtime". A pair mid-cutover belongs in this rule\'s `allowPackages`, with the cutover ticket named — not behind an inline disable.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    // A test's job includes driving the real transport and faking it.
    if (isTestPath(path)) return {};

    const options = context.options[0] ?? {};
    const constructors = new Set(options.constructors ?? DEFAULT_CONSTRUCTORS);
    const allowed = new Set(options.allowPackages ?? DEFAULT_ALLOW_PACKAGES);

    const pkg = packageNameFor(path);
    if (pkg && allowed.has(pkg)) return {};

    return {
      NewExpression(node) {
        const name = constructorName(node.callee);
        if (!name || !constructors.has(name)) return;
        context.report({
          node,
          messageId: "adhocSocket",
          data: { name, where: pkg ? ` (in ${pkg})` : "" },
        });
      },
    };
  },
};
