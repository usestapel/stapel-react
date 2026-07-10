// stapel/no-adhoc-401 — frontend-core-architecture-v2 §43.2.
// 401 handling (single-flight refresh → retry once → SessionManager.sessionLost())
// lives in ONE place: `@stapel/core`'s `createStapelClient` (`onAuthRefresh`
// seam) + `SessionManager`. A module/service writing its own "if status is
// 401, refresh/redirect/retry" branch bypasses the single-flight coalescing
// and the logout-hook registry silently — the failure mode is invisible until
// two concurrent requests both refresh and race each other. The recommended
// preset turns this rule OFF for `@stapel/core`'s own client/session
// internals (the ONE legal home), mirroring the no-raw-fetch api-layer
// carve-out.

// Named constant (not an inline literal in the comparison below) so the rule
// passes ITSELF — its own `value === HTTP_UNAUTHORIZED` check must not read
// as ad hoc 401 handling when the monorepo lints this file.
const HTTP_UNAUTHORIZED = 401;

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ad hoc 401 handling / auth interceptors outside @stapel/core's client and SessionManager.",
    },
    schema: [],
    messages: {
      literal401:
        "Ad hoc 401 handling. 401s are handled ONCE, in @stapel/core's createStapelClient (onAuthRefresh seam) + SessionManager.refresh() — single-flight refresh, retry once, SessionManager.sessionLost() on failure (frontend-core-architecture-v2 §43.2). Wire onAuthRefresh to your SessionManager instead of branching on the status code here.",
      interceptor:
        "Ad hoc auth interceptor ({{what}}). Requests already go through createStapelClient, whose onAuthRefresh/onVerificationChallenge seams are the one legal place to intercept auth failures — see §43.2.",
    },
  },
  create(context) {
    function isNumeric401(node) {
      return node.type === "Literal" && node.value === HTTP_UNAUTHORIZED;
    }

    return {
      BinaryExpression(node) {
        if (!["==", "===", "!=", "!=="].includes(node.operator)) return;
        if (isNumeric401(node.left) || isNumeric401(node.right)) {
          context.report({ node, messageId: "literal401" });
        }
      },

      SwitchCase(node) {
        if (node.test && isNumeric401(node.test)) {
          context.report({ node, messageId: "literal401" });
        }
      },

      // `client.interceptors.response.use(...)` / `axios.interceptors...` —
      // axios-shaped ad hoc auth interceptors, regardless of the object.
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.type === "Identifier" &&
          node.property.name === "interceptors"
        ) {
          context.report({
            node,
            messageId: "interceptor",
            data: { what: "*.interceptors" },
          });
        }
      },
    };
  },
};
