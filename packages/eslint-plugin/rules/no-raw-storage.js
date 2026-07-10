// stapel/no-raw-storage — frontend-core-architecture-v2 §43.4.
// `createRepository` (@stapel/core) is the ONE sanctioned client-side
// persistence primitive: `scope: "user"` repositories auto-wipe on logout
// (no opt-out) and are encrypted by default — a guarantee that only holds if
// nothing else in the app reaches `localStorage`/`sessionStorage`/`indexedDB`
// directly, since that data would never be torn down or encrypted. Direct
// access is banned everywhere except `@stapel/core`'s own storage/repository
// internals (the recommended preset turns this rule OFF there via a file
// override, mirroring the no-raw-fetch api-layer carve-out).
import { stapelSettings } from "../lib/data.js";

const STORAGE_GLOBALS = new Set(["localStorage", "sessionStorage"]);
const IDB_GLOBALS = new Set(["indexedDB"]);
const GLOBAL_HOSTS = new Set(["window", "self", "globalThis"]);
const BANNED_IMPORTS = new Set(["idb-keyval"]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct localStorage/sessionStorage/indexedDB access outside @stapel/core's repository layer.",
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
      rawStorage:
        'Direct {{what}} access. Persist through createRepository(namespace, { scope, storage, encrypted }) (@stapel/core) instead — it is the one sanctioned client-side store: scope "user" auto-wipes on logout (no opt-out) and is encrypted by default, scope "app" survives logout. Raw storage is neither wiped nor encrypted (frontend-core-architecture-v2 §43.4).',
      rawImport:
        'Import of storage-backend package "{{source}}". Use createRepository() (@stapel/core) instead of building on this directly — see §43.4.',
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const extraModules = context.options[0]?.modules ?? [];
    const bannedModules = new Set([
      ...BANNED_IMPORTS,
      ...(settings.storageModules ?? []),
      ...extraModules,
    ]);

    function report(node, what) {
      context.report({ node, messageId: "rawStorage", data: { what } });
    }

    function identifierName(node) {
      return node.type === "Identifier" ? node.name : null;
    }

    function isStorageName(name) {
      return STORAGE_GLOBALS.has(name) || IDB_GLOBALS.has(name);
    }

    return {
      // Bare `localStorage` / `sessionStorage` / `indexedDB` uses — resolved
      // through scope analysis so a local binding that merely SHARES the name
      // (`function f(indexedDB) {…}`) is never flagged: only references that
      // resolve to a global (env/globals config) or to nothing at all (the
      // usual appearance of browser globals) are the real storage globals.
      "Program:exit"(node) {
        const globalScope = context.sourceCode.getScope(node);
        // Unresolved references — no declaration anywhere in the file.
        for (const ref of globalScope.through) {
          const name = ref.identifier.name;
          if (isStorageName(name)) report(ref.identifier, name);
        }
        // References that RESOLVE to a declared ambient global (a variable
        // with no defs, injected via languageOptions.globals).
        for (const name of [...STORAGE_GLOBALS, ...IDB_GLOBALS]) {
          const variable = globalScope.set.get(name);
          if (!variable || variable.defs.length > 0) continue;
          for (const ref of variable.references) {
            report(ref.identifier, name);
          }
        }
      },

      // `window.localStorage`, `self.indexedDB`, `globalThis.sessionStorage`.
      MemberExpression(node) {
        if (node.computed) return;
        const objectName = identifierName(node.object);
        const propertyName = identifierName(node.property);
        if (
          objectName &&
          GLOBAL_HOSTS.has(objectName) &&
          propertyName &&
          (STORAGE_GLOBALS.has(propertyName) || IDB_GLOBALS.has(propertyName))
        ) {
          report(node, `${objectName}.${propertyName}`);
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

      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments[0]?.type === "Literal" &&
          bannedModules.has(node.arguments[0].value)
        ) {
          context.report({
            node,
            messageId: "rawImport",
            data: { source: node.arguments[0].value },
          });
        }
      },
    };
  },
};
