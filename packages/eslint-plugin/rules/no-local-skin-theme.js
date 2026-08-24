// stapel/no-local-skin-theme — nine copies of the same provider is not nine
// decisions, it is one decision that nobody can change.
//
// ── THE CENSUS (coordinator finding CF-1) ───────────────────────────────────
//
// Nine pairs ship `src/default/theme.tsx` exporting `<X>SkinTheme`: billing,
// categories, docs, forms, gdpr, listings, reviews, search, video. `diff` over
// the nine shows only the names and the comment prose differ — every one of
// them builds its own `ConfigProvider` from `toAntdThemeConfig(mode)` and
// wraps a `<div>` with a couple of token styles.
//
// The cost is not duplication for its own sake. It is that CF-1's fix — make
// the mode REACTIVE, so a runtime theme toggle repaints mounted skins — has to
// be applied nine times to land, and will be applied to eight of them by
// someone who does not know the ninth exists. That is precisely how the fleet
// got here: `resolveThemeMode()` was the right idea, copied, and then frozen.
// One `<SkinTheme>` in `@stapel/tokens-antd/skin` is the whole fix, and this
// rule is what stops the tenth copy from being written the day after.
//
//   -  export function ListingsSkinTheme(props) { … <ConfigProvider theme={…}> }
//   +  import { SkinTheme } from "@stapel/tokens-antd/skin";
//   +  // (delete src/default/theme.tsx; the pair's surfaces wrap in <SkinTheme>)
//
// ── WHAT IS FLAGGED, EXACTLY ────────────────────────────────────────────────
//
// A file named `theme.tsx` / `theme.ts` under `src/default/` that CONSTRUCTS a
// `ConfigProvider` — either by importing it from antd or by rendering
// `<ConfigProvider>`. Reported once per file, on the first piece of evidence:
// the finding is "this file exists", not "this line is wrong", and nine
// reports on one 60-line file teaches nothing the first one did not.
//
// It is deliberately NOT "any file that renders ConfigProvider": a pair's own
// panel legitimately nests a ConfigProvider for a scoped override, and the
// shared layer's `SkinTheme` will itself be a ConfigProvider. The named-file
// shape is what the copy-paste actually looks like, and naming the shape keeps
// the rule from firing on the thing it is asking people to use.
import { isDefaultSkin, jsxElementName, normalizedFilename } from "../lib/jsx.js";

const DEFAULT_FILENAMES = ["theme.tsx", "theme.ts", "Theme.tsx", "Theme.ts"];
const DEFAULT_PROVIDERS = ["ConfigProvider"];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a per-pair src/default/theme.tsx that builds its own antd ConfigProvider; use the shared SkinTheme from @stapel/tokens-antd/skin.",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Basenames treated as a local theme module. */
          filenames: { type: "array", items: { type: "string" } },
          /** Provider component names that constitute "builds its own theme". */
          providers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      localTheme:
        'Local skin theme: `{{file}}` builds its own `{{provider}}`. Nine pairs ship a byte-identical copy of this file, which means the reactive-theme fix (CF-1: a runtime toggle must repaint mounted skins) has to land nine times and will land in eight. Delete this module and wrap the pair\'s surfaces in <SkinTheme> from "@stapel/tokens-antd/skin" — it owns the ConfigProvider, reads the mode from the document via useThemeMode(), and is the one place the light/dark literals legitimately live. A scoped ConfigProvider override inside a panel is not this rule\'s business; a per-pair theme MODULE is.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    if (!isDefaultSkin(path)) return {};

    const options = context.options[0] ?? {};
    const filenames = new Set(options.filenames ?? DEFAULT_FILENAMES);
    const providers = new Set(options.providers ?? DEFAULT_PROVIDERS);

    const base = path.slice(path.lastIndexOf("/") + 1);
    if (!filenames.has(base)) return {};

    let reported = false;
    function reportOnce(node, provider) {
      if (reported) return;
      reported = true;
      context.report({
        node,
        messageId: "localTheme",
        data: { file: base, provider },
      });
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "antd") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          if (providers.has(name)) reportOnce(specifier, name);
        }
      },
      JSXOpeningElement(node) {
        const name = jsxElementName(node);
        if (name && providers.has(name)) reportOnce(node.name, name);
      },
    };
  },
};
