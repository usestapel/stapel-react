// Pure library behind gen-events.mjs (frontend-guardrails §3.1). Two sources
// feed a package's event registry, and both are STATIC — no app code runs:
//
//   1. defineEvent() call sites            → the `defined` catalog (app/lib
//      events with literal name/description/per-prop meta). Extracted via the
//      TypeScript AST; the `stapel/event-literal-meta` lint (G4) keeps the
//      arguments literal so this extraction stays possible.
//   2. flows.json (already drift-gated)    → the `flows` catalog: the
//      auto-instrumented funnels a pair's machines emit as `flow.<id>.<step>`
//      with a `phase` prop (analytics-standard §1.2). Library events are NOT
//      redeclared with defineEvent — their source is flows.json, so they are
//      projected from there (§3.1).
//
// Everything is deterministic and byte-stable for the drift gate.
import ts from "typescript";

/** FlowStepPhase in @stapel/core — the closed set a funnel step reports. */
export const FLOW_PHASES = ["started", "completed", "failed"];

// ── defineEvent extraction (TypeScript AST) ─────────────────────────────────

function literalText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

/** Read an object literal's string-valued property, else null. */
function stringProp(objLiteral, key) {
  for (const p of objLiteral.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === key
    ) {
      return literalText(p.initializer);
    }
  }
  return null;
}

/** Find an object-literal property's initializer node (any kind), else null. */
function propInitializer(objLiteral, key) {
  for (const p of objLiteral.properties) {
    if (
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === key
    ) {
      return p.initializer;
    }
  }
  return null;
}

/** Parse a `prop.<builder>(...)` call into a PropSpec projection, else null. */
function parsePropSpec(callExpr) {
  if (!ts.isCallExpression(callExpr)) return null;
  const callee = callExpr.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  if (!ts.isIdentifier(callee.expression) || callee.expression.text !== "prop") {
    return null;
  }
  const builder = callee.name.text;
  const args = callExpr.arguments;
  if (builder === "oneOf") {
    const optionsNode = args[0];
    const description = literalText(args[1]);
    if (!optionsNode || !ts.isArrayLiteralExpression(optionsNode)) return null;
    const options = optionsNode.elements.map(literalText).filter((v) => v !== null);
    return { type: "string", description: description ?? "", options };
  }
  if (builder === "string" || builder === "number" || builder === "boolean") {
    return { type: builder, description: literalText(args[0]) ?? "" };
  }
  return null;
}

/** Parse the `props: { ... }` object literal into a name→PropSpec map. */
function parseProps(propsNode) {
  const out = {};
  if (!propsNode || !ts.isObjectLiteralExpression(propsNode)) return out;
  for (const p of propsNode.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const key =
      ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
    if (key === null) continue;
    const spec = parsePropSpec(p.initializer);
    if (spec) out[key] = spec;
  }
  return out;
}

/**
 * Extract every `defineEvent({ ... })` declaration from one source file.
 * Returns [{ name, description, props, flow?, source:{file,line} }], sorted by
 * name. `fileName` is recorded verbatim (pass a repo-relative path for stable
 * output).
 */
export function extractDefinedEvents(sourceText, fileName) {
  const sf = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const events = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineEvent" &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      const arg = node.arguments[0];
      const name = stringProp(arg, "name");
      const description = stringProp(arg, "description");
      if (name !== null && description !== null) {
        const flow = stringProp(arg, "flow");
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        events.push({
          name,
          description,
          props: parseProps(propInitializer(arg, "props")),
          ...(flow !== null ? { flow } : {}),
          source: { file: fileName, line: line + 1 },
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return events.sort((a, b) => a.name.localeCompare(b.name));
}

// ── flow funnel projection (flows.json) ─────────────────────────────────────

/**
 * Project flows.json into the auto-instrumented funnel catalog: one entry per
 * flow, documenting the `flow.<id>.<step>` family, its `phase` prop, and the
 * flow's documented steps. The precise machine step NAMES (idle/requesting/…)
 * are a machine-internal detail; the canonical, drift-gated projection is at
 * flow granularity (report-time enrichment is a G5 concern).
 */
export function flowFunnels(flows) {
  return flows
    .map((f) => ({
      flow: f.id,
      event: `flow.${f.id}.<step>`,
      titleKey: f.titleKey,
      descriptionKey: f.descriptionKey,
      props: {
        phase: {
          type: "string",
          description: "Transition phase of the funnel step",
          options: FLOW_PHASES,
        },
      },
      steps: (f.steps ?? []).map((s) => ({
        order: s.order,
        kind: s.kind,
        noteKey: s.noteKey,
      })),
      source: "flows.json",
    }))
    .sort((a, b) => a.flow.localeCompare(b.flow));
}

// ── assembly + projections ──────────────────────────────────────────────────

export function buildEventsJson({ pkg, defined, funnels }) {
  return {
    $generated:
      "by scripts/gen-events.mjs — do not edit; drift-gated (pnpm gen:events:check)",
    package: pkg.name,
    version: pkg.version,
    defined,
    flows: funnels,
  };
}

/** Compact `events` section for a pair's manifest.json. */
export function manifestEvents(eventsJson) {
  return {
    defined: eventsJson.defined.map((e) => ({
      name: e.name,
      description: e.description,
      props: Object.fromEntries(
        Object.entries(e.props).map(([k, s]) => [
          k,
          s.options ? `${s.type}(${s.options.join("|")})` : s.type,
        ])
      ),
      ...(e.flow ? { flow: e.flow } : {}),
    })),
    flows: eventsJson.flows.map((f) => ({
      flow: f.flow,
      event: f.event,
      steps: f.steps.length,
    })),
  };
}

/** llms.txt lines for the events surface (canonical defineEvent + tracked). */
export function renderLlmsEvents(eventsJson) {
  const L = [];
  L.push("## Analytics events (typed; defineEvent → events.json, drift-gated)");
  if (eventsJson.defined.length > 0) {
    for (const e of eventsJson.defined) {
      const props = Object.keys(e.props).join(", ");
      L.push(`- ${e.name}: ${e.description}${props ? ` {${props}}` : ""}`);
    }
  } else {
    L.push(
      "- (no app defineEvent() in this pair — its analytic events are the"
    );
    L.push("  auto-instrumented flow funnels below)");
  }
  L.push("");
  L.push("## Flow funnels (auto-instrumented: flow.<id>.<step> {phase})");
  for (const f of eventsJson.flows) {
    L.push(`- ${f.event} — ${f.steps.length} documented step(s)`);
  }
  L.push("");
  L.push("```tsx");
  L.push("// Typed event + tracked() click (the one right way; §3.1).");
  L.push("const planSelected = defineEvent({");
  L.push('  name: "pricing.plan.selected",');
  L.push('  description: "User picked a plan",');
  L.push('  props: { plan: prop.oneOf(["free", "pro", "team"], "Plan code") },');
  L.push("});");
  L.push("const { tracked } = useTracked();");
  L.push("<Button onClick={tracked(planSelected, { plan }, startCheckout)} />");
  L.push("// A click that STEPS a flow machine is already instrumented — mark it");
  L.push('// data-analytics="flow" instead; tracked() on top double-counts (§3.2).');
  L.push("```");
  return L;
}
