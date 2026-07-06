// stapel/no-raw-colors — frontend-guardrails §2.2.
// Raw colours (hex/rgb/hsl/named) in styled surfaces, and Tailwind arbitrary
// values that embed a colour, are the cheapest token for an LLM to hardcode
// (§F7). Hex is born in exactly one place — the ramps — and everything above
// references tokens. Message teaches the one right way + points at the catalog.
import { loadTokenCatalog, stapelSettings } from "../lib/data.js";
import {
  hasColorSyntax,
  isColorProperty,
  isNamedColorValue,
  findArbitraryColor,
  matchRampRef,
} from "../lib/colors.js";

const LLMS = "@stapel/tokens/llms.txt §colors";

const CSS_TAGS = new Set([
  "css",
  "styled",
  "createGlobalStyle",
  "keyframes",
  "injectGlobal",
]);

function isCssTag(tag) {
  if (!tag) return false;
  if (tag.type === "Identifier") return CSS_TAGS.has(tag.name);
  // styled.div`...`, styled(Comp)`...`
  if (tag.type === "MemberExpression" && tag.object?.name === "styled")
    return true;
  if (tag.type === "CallExpression" && tag.callee?.name === "styled")
    return true;
  return false;
}

/** name of a className-ish JSX attribute */
function isClassNameAttr(name) {
  return name === "className" || name === "class";
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw colour literals and Tailwind arbitrary colour values; use design tokens.",
    },
    schema: [],
    messages: {
      rawColor:
        'Raw colour "{{value}}". Use a token: in TS — cssVar("color-{{suggest}}"), in CSS — var(--stapel-color-{{suggest}}), in Tailwind — a token utility (e.g. bg-background-primary). Hex is born only in ramps. Catalog: ' +
        LLMS,
      arbitraryColor:
        'Tailwind arbitrary colour "[{{value}}]". Use a token utility (e.g. bg-background-primary / text-text-primary) instead of a raw value in [...]. Catalog: ' +
        LLMS,
      arbitraryInterpolation:
        'Tailwind arbitrary value built by interpolation ("{{value}}"). The JIT scanner sees the literal source text, not the resolved value, so no utility is emitted — works in dev, breaks in prod. Use a static token utility. Catalog: ' +
        LLMS,
      rawRamp:
        'Raw ramp reference "{{value}}". Ramps ({{ramp}}.*) are L1 and not for component code — reference a token instead. Catalog: ' +
        LLMS,
    },
  },
  create(context) {
    const settings = stapelSettings(context);
    const catalog = loadTokenCatalog(settings);
    const ramps = catalog.ramps;

    function reportColorValue(node, raw) {
      context.report({
        node,
        messageId: "rawColor",
        data: { value: String(raw).slice(0, 40), suggest: "accent" },
      });
    }

    // Style objects: JSX style={{...}} and any object literal property whose
    // key is a colour property with a raw colour value.
    function checkStyleProperty(prop) {
      if (prop.type !== "Property" || prop.computed) return;
      const key =
        prop.key.type === "Identifier"
          ? prop.key.name
          : prop.key.type === "Literal"
            ? prop.key.value
            : null;
      if (!isColorProperty(key)) return;
      const v = prop.value;
      if (v.type === "Literal" && typeof v.value === "string") {
        if (hasColorSyntax(v.value) || isNamedColorValue(v.value)) {
          reportColorValue(v, v.value);
        }
      } else if (v.type === "TemplateLiteral") {
        for (const q of v.quasis) {
          if (hasColorSyntax(q.value.cooked ?? q.value.raw)) {
            reportColorValue(v, context.sourceCode.getText(v));
            break;
          }
        }
      }
    }

    // className analysis: string literal or template literal.
    function checkClassName(node) {
      if (node.type === "Literal" && typeof node.value === "string") {
        const bad = findArbitraryColor(node.value, ramps);
        if (bad !== null) {
          context.report({
            node,
            messageId: "arbitraryColor",
            data: { value: bad.slice(0, 40) },
          });
        }
      } else if (node.type === "TemplateLiteral") {
        // Interpolation inside a [...] arbitrary value is JIT-invisible.
        if (interpolationInsideArbitrary(node)) {
          context.report({
            node,
            messageId: "arbitraryInterpolation",
            data: { value: context.sourceCode.getText(node).slice(0, 40) },
          });
          return;
        }
        // Static quasis can still contain bg-[#...] literally.
        for (const q of node.quasis) {
          const bad = findArbitraryColor(q.value.cooked ?? q.value.raw, ramps);
          if (bad !== null) {
            context.report({
              node,
              messageId: "arbitraryColor",
              data: { value: bad.slice(0, 40) },
            });
            break;
          }
        }
      }
    }

    // True when any `${...}` expression sits inside an unclosed `[` of a
    // Tailwind arbitrary value (e.g. `bg-[${x}]`).
    function interpolationInsideArbitrary(tpl) {
      for (let i = 0; i < tpl.expressions.length; i++) {
        const before = tpl.quasis[i].value.cooked ?? tpl.quasis[i].value.raw;
        const lastOpen = before.lastIndexOf("[");
        const lastClose = before.lastIndexOf("]");
        if (lastOpen > lastClose) return true;
      }
      return false;
    }

    return {
      // Inline style objects, both JSX and plain.
      ObjectExpression(node) {
        for (const prop of node.properties) checkStyleProperty(prop);
      },

      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (!isClassNameAttr(name)) return;
        const val = node.value;
        if (!val) return;
        if (val.type === "Literal") checkClassName(val);
        else if (
          val.type === "JSXExpressionContainer" &&
          (val.expression.type === "Literal" ||
            val.expression.type === "TemplateLiteral")
        ) {
          checkClassName(val.expression);
        }
      },

      TaggedTemplateExpression(node) {
        if (!isCssTag(node.tag)) return;
        for (const q of node.quasi.quasis) {
          const text = q.value.cooked ?? q.value.raw;
          if (hasColorSyntax(text)) {
            reportColorValue(node.quasi, text.trim().slice(0, 40));
            break;
          }
        }
      },

      // Bare raw-ramp string references, e.g. "gray.500".
      Literal(node) {
        if (typeof node.value !== "string") return;
        const ramp = matchRampRef(node.value, ramps);
        if (ramp) {
          context.report({
            node,
            messageId: "rawRamp",
            data: { value: node.value, ramp },
          });
        }
      },
    };
  },
};
