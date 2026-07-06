// stapel/no-raw-fetch — frontend-guardrails §2.2 (failure mode F2).
// Network access goes through the codegen client only. Raw fetch/axios/ky/
// XMLHttpRequest bypasses typing, the error envelope, and auth/CSRF handling.
// The recommended preset turns this OFF for the api layer of a pair (the client
// itself is the one legal home of fetch) via file overrides.
import { stapelSettings } from "../lib/data.js";

const HINT =
  "Requests go through the codegen client only: const api = createAuthApi(client); await api.me(). Operations: <pkg>/manifest.json §operations.";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw fetch/axios/ky/XMLHttpRequest outside the codegen API layer.",
    },
    schema: [
      {
        type: "object",
        properties: {
          modules: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawFetch: "Direct {{what}}(). " + HINT,
      rawXhr: "Direct `new XMLHttpRequest()`. " + HINT,
      rawImport: 'Import of HTTP client "{{source}}". ' + HINT,
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const extraModules = context.options[0]?.modules ?? [];
    const bannedModules = new Set([
      "axios",
      "ky",
      "got",
      "superagent",
      ...(settings.httpModules ?? []),
      ...extraModules,
    ]);

    function reportFetch(node, what) {
      context.report({ node, messageId: "rawFetch", data: { what } });
    }

    return {
      // fetch(...), globalThis.fetch(...), window.fetch(...), self.fetch(...)
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === "Identifier" && callee.name === "fetch") {
          reportFetch(node, "fetch");
          return;
        }
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "fetch" &&
          callee.object.type === "Identifier" &&
          ["globalThis", "window", "self"].includes(callee.object.name)
        ) {
          reportFetch(node, `${callee.object.name}.fetch`);
        }
        // axios(...) / axios.get(...) / ky(...) — call on a banned identifier
        const root =
          callee.type === "Identifier"
            ? callee
            : callee.type === "MemberExpression" &&
                callee.object.type === "Identifier"
              ? callee.object
              : null;
        if (root && bannedModules.has(root.name)) {
          reportFetch(node, root.name);
        }
      },

      NewExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "XMLHttpRequest"
        ) {
          context.report({ node, messageId: "rawXhr" });
        }
      },

      ImportDeclaration(node) {
        if (bannedModules.has(node.source.value)) {
          context.report({
            node,
            messageId: "rawImport",
            data: { source: node.source.value },
          });
        }
      },
    };
  },
};
