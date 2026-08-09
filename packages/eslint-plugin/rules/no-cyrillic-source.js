// stapel/no-cyrillic-source — fleet-wide English-only source canon (owner
// ruling 2026-08-09; mirrors the Python-side stapel-tools check the
// coordinator is building in parallel). Source is English-only across the
// fleet: identifiers, comments, JSDoc, developer-facing log strings, commit
// messages. Russian UI copy inside translation catalogs is NOT affected —
// so this rule DELIBERATELY never looks at plain string literals (i18n
// values, fixtures whose Cyrillic is the thing under test, and sample
// content are the legitimate case). That is the whole design: because
// string literals are exempt, no path allowlist is needed, and a rule with
// no allowlist is one nobody learns to silence wholesale. (The literal-
// scanning counterpart — no-mixed-script-word — covers the one thing this
// rule leaves alone, and needs no allowlist for the same reason.)
//
// Reports on the LINE the Cyrillic text actually sits on, never collapsed
// onto a block comment's or file-leading JSDoc's opening line. That matters
// for suppressability: a report pinned to a comment's first line can still
// be reached by an `eslint-disable-next-line` placed on the line BEFORE the
// comment starts, but a report pinned to any INTERIOR line of a multi-line
// comment cannot — that line is itself inside the comment, so there is no
// legal place to put a `next-line` directive immediately above it. The fix
// there is a plain `eslint-disable`/`eslint-enable` pair (or a single
// `eslint-disable` line) placed before the whole block; both work as long as
// the reported location is accurate, which is what this rule guarantees.
const CYRILLIC = /[\u0400-\u04FF]/;
const CYRILLIC_RUN = /[\u0400-\u04FF]+/g;

function reportCyrillicRuns(context, lineText, baseLine, baseColumn) {
  CYRILLIC_RUN.lastIndex = 0;
  let m;
  while ((m = CYRILLIC_RUN.exec(lineText)) !== null) {
    const start = baseColumn + m.index;
    context.report({
      loc: {
        start: { line: baseLine, column: start },
        end: { line: baseLine, column: start + m[0].length },
      },
      messageId: "cyrillicComment",
      data: { text: m[0] },
    });
  }
}

function checkIdentifierName(context, node) {
  if (!node || node.type !== "Identifier") return;
  if (!CYRILLIC.test(node.name)) return;
  context.report({ node, messageId: "cyrillicIdentifier", data: { name: node.name } });
}

// Walk a binding pattern (destructuring included) and check every bound name
// — covers plain `const x`, `const { a, b: c, ...rest } = obj`, and the same
// shapes in function/arrow parameters and catch clauses.
function checkPattern(context, pattern) {
  if (!pattern) return;
  switch (pattern.type) {
    case "Identifier":
      checkIdentifierName(context, pattern);
      break;
    case "AssignmentPattern":
      checkPattern(context, pattern.left);
      break;
    case "RestElement":
      checkPattern(context, pattern.argument);
      break;
    case "ArrayPattern":
      for (const el of pattern.elements) checkPattern(context, el);
      break;
    case "ObjectPattern":
      for (const prop of pattern.properties) {
        if (prop.type === "RestElement") checkPattern(context, prop.argument);
        else checkPattern(context, prop.value);
      }
      break;
    default:
      break;
  }
}

function checkKey(context, node) {
  if (node && !node.computed && node.key && node.key.type === "Identifier") {
    checkIdentifierName(context, node.key);
  }
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Cyrillic in comments, JSDoc, and identifiers — fleet source is English-only (owner ruling 2026-08-09). Plain string literals are deliberately exempt (i18n catalogs, fixtures).",
    },
    schema: [],
    messages: {
      cyrillicComment:
        'Cyrillic in a comment: "{{text}}". Source comments/JSDoc are English-only fleet-wide — move Russian copy to an i18n catalog, or rewrite the comment in English.',
      cyrillicIdentifier:
        'Cyrillic in identifier "{{name}}". Identifiers are English-only fleet-wide — rename it.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const lines = comment.value.split("\n");
          lines.forEach((lineText, i) => {
            const baseLine = comment.loc.start.line + i;
            // Both "//" and "/*" are 2 chars — the delimiter length is the
            // same either way, so only the FIRST physical line needs the
            // offset; interior lines of a block comment start at column 0
            // of their own source line.
            const baseColumn = i === 0 ? comment.loc.start.column + 2 : 0;
            reportCyrillicRuns(context, lineText, baseLine, baseColumn);
          });
        }
      },
      VariableDeclarator(node) {
        checkPattern(context, node.id);
      },
      FunctionDeclaration(node) {
        checkIdentifierName(context, node.id);
        node.params.forEach((p) => checkPattern(context, p));
      },
      FunctionExpression(node) {
        checkIdentifierName(context, node.id);
        node.params.forEach((p) => checkPattern(context, p));
      },
      ArrowFunctionExpression(node) {
        node.params.forEach((p) => checkPattern(context, p));
      },
      ClassDeclaration(node) {
        checkIdentifierName(context, node.id);
      },
      ClassExpression(node) {
        checkIdentifierName(context, node.id);
      },
      MethodDefinition(node) {
        checkKey(context, node);
      },
      PropertyDefinition(node) {
        checkKey(context, node);
      },
      Property(node) {
        // Object-LITERAL keys only. ObjectPattern's properties are the same
        // AST node type but are already covered via checkPattern() above
        // (VariableDeclarator / function params) — checking them again here
        // would double-report the same name.
        if (node.parent && node.parent.type === "ObjectExpression") {
          checkKey(context, node);
        }
      },
      TSTypeAliasDeclaration(node) {
        checkIdentifierName(context, node.id);
      },
      TSInterfaceDeclaration(node) {
        checkIdentifierName(context, node.id);
      },
      TSEnumDeclaration(node) {
        checkIdentifierName(context, node.id);
      },
      TSEnumMember(node) {
        if (node.id && node.id.type === "Identifier") checkIdentifierName(context, node.id);
      },
      TSPropertySignature(node) {
        checkKey(context, node);
      },
      TSMethodSignature(node) {
        checkKey(context, node);
      },
      ImportSpecifier(node) {
        checkIdentifierName(context, node.local);
      },
      ImportDefaultSpecifier(node) {
        checkIdentifierName(context, node.local);
      },
      ImportNamespaceSpecifier(node) {
        checkIdentifierName(context, node.local);
      },
      CatchClause(node) {
        checkPattern(context, node.param);
      },
    };
  },
};
