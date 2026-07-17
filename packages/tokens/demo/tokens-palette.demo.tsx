/**
 * Token palette — the auto-demo of `@stapel/tokens` (frontend-guardrails §4,
 * task 6; §68 neutral role dictionary). It ENUMERATES the generated token
 * surface (no hardcoded lists), so it always reflects the current catalog:
 * the L1 raw ramps (the one legal home of hex — reached via
 * `@stapel/tokens/raw`, showcase-whitelisted §2.2), the neutral colour roles
 * (live `var()` refs that re-theme with data-theme — no component tier;
 * §68 dropped it), and the non-colour scales. Swatch labels are token NAMES
 * (dynamic, never prose literals — no-hardcoded-text stays satisfied).
 */
import type { CSSProperties, ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { colors, cssVar, radii, spacing, fontSize } from "../src/index.js";
import { ramps } from "../src/generated/raw.js";

const frame: CSSProperties = {
  background: cssVar("surface"),
  color: cssVar("text"),
  padding: spacing["5"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["6"],
  fontSize: fontSize.sm.fontSize,
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
  gap: spacing["3"],
};

function Swatch(props: { name: string; background: string }): ReactElement {
  return (
    <div
      style={{
        border: `1px solid ${cssVar("border-subtle")}`,
        borderRadius: radii.md,
        overflow: "hidden",
      }}
    >
      <div style={{ background: props.background, height: "3rem" }} />
      <code
        style={{
          display: "block",
          padding: spacing["2"],
          color: cssVar("text-muted"),
          wordBreak: "break-all",
        }}
      >
        {props.name}
      </code>
    </div>
  );
}

function Section(props: { name: string; children: ReactElement }): ReactElement {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
      <strong style={{ fontSize: fontSize.md.fontSize }}>{props.name}</strong>
      {props.children}
    </section>
  );
}

function Palette(): ReactElement {
  // L1 ramps: every step, actual hex (raw is the only hex source).
  const rampRows = Object.entries(ramps).map(([ramp, steps]) => (
    <Section key={ramp} name={`ramp · ${ramp}`}>
      <div style={grid}>
        {Object.entries(steps).map(([step, hex]) => (
          <Swatch key={step} name={`${ramp}.${step}`} background={hex} />
        ))}
      </div>
    </Section>
  ));

  return (
    <div style={frame} data-theme-surface>
      <Section name={`roles · ${Object.keys(colors).length} tokens`}>
        <div style={grid}>
          {Object.keys(colors).map((name) => (
            <Swatch key={name} name={name} background={`var(--stapel-${name})`} />
          ))}
        </div>
      </Section>
      {rampRows}
      <Section name="scales">
        <div style={grid}>
          {Object.keys(spacing).map((s) => (
            <Swatch key={`sp-${s}`} name={`spacing.${s}`} background={cssVar("surface-sunken")} />
          ))}
          {Object.keys(radii).map((r) => (
            <Swatch key={`ra-${r}`} name={`radii.${r}`} background={cssVar("surface-sunken")} />
          ))}
          {Object.keys(fontSize).map((f) => (
            <Swatch key={`fs-${f}`} name={`fontSize.${f}`} background={cssVar("surface-sunken")} />
          ))}
        </div>
      </Section>
    </div>
  );
}

export default defineDemo({
  id: "tokens.palette",
  title: "Token palette",
  description:
    "Every design token by name — L1 raw ramps (hex), the §68 neutral colour roles (live var refs, re-theme on data-theme), and the spacing/radii/fontSize scales. Enumerated from the generated surface, so it never drifts.",
  component: Palette,
  tokens: ["surface", "text", "border-subtle"],
  variants: {
    default: { render: () => <Palette /> },
  },
});
