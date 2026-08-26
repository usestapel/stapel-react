/**
 * Token palette — the auto-demo of `@stapel/tokens` (frontend-guardrails §4,
 * task 6; §68 neutral role dictionary). It ENUMERATES the generated token
 * surface (no hardcoded lists), so it always reflects the current catalog:
 * the L1 raw ramps (the one legal home of hex — reached via
 * `@stapel/tokens/raw`, showcase-whitelisted §2.2), the neutral colour roles
 * (live `var()` refs that re-theme with data-theme — no component tier;
 * §68 dropped it), and the non-colour scales. Swatch labels are token NAMES
 * (dynamic, never prose literals — no-hardcoded-text stays satisfied).
 *
 * The page is a REFERENCE, so every cell carries its value and copies it:
 *   - ramp steps print their literal hex (it is a build-time constant);
 *   - roles print the value the browser actually paints, read once after mount
 *     and re-read whenever `data-theme` flips, so the number follows the theme
 *     instead of freezing at whichever mode the bundle was built in;
 *   - the scales draw a SPECIMEN — a bar of that width, a box with that
 *     corner, a glyph at that size — next to the number, because a grey
 *     rectangle labelled `radii.lg` shows nothing.
 *
 * Layout is one shared auto-fill grid per family, sized in `min(<n>rem, 100%)`
 * so a 390px viewport still gets several columns instead of one card per row.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { defineDemo } from "@stapel/showcase";
import {
  colors,
  cssVar,
  fontFamily,
  fontSize,
  fontWeight,
  radii,
  spacing,
} from "../src/index.js";
import { ramps } from "../src/generated/raw.js";

/** Dev-facing chrome of the reference page (this package ships no catalog). */
const COPY_HINT = "Tap any swatch to copy its value.";
const COPY_ACTION = "Copy";
const COPIED = "Copied";
/** Two glyphs, not prose: the type specimen every fontSize step is set in. */
const TYPE_SPECIMEN = "Aa";
/** Printed where a role has not been measured yet (SSR, first paint, jsdom). */
const UNRESOLVED = "—";
const COPIED_MS = 1400;

/** `rgb(r, g, b)` → `#rrggbb`; alpha colours only lose their spaces. */
function compactColor(value: string): string {
  const parts = /^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/.exec(value);
  if (!parts) return value.replace(/,\s+/g, ",");
  return `#${parts
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Write to the clipboard, answering whether it happened. The API is absent in
 * jsdom, over plain http and in every non-secure context, so the call is
 * guarded rather than assumed: a reference page must not throw at a viewer.
 */
async function copyValue(value: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const clipboard: Clipboard | undefined = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** The one grid shape the whole page uses; `min()` keeps it multi-column at 390px. */
function autoGrid(min: string): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`,
    gap: spacing["2"],
  };
}

const frame: CSSProperties = {
  background: cssVar("surface"),
  color: cssVar("text"),
  padding: spacing["4"],
  display: "flex",
  flexDirection: "column",
  gap: spacing["5"],
  fontSize: fontSize.sm.fontSize,
  maxWidth: "90rem",
  marginInline: "auto",
  boxSizing: "border-box",
};

const headerRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing["2"],
  alignItems: "baseline",
  fontSize: fontSize.xs.fontSize,
  color: cssVar("text-muted"),
};

const statusLine: CSSProperties = {
  color: cssVar("success"),
  fontFamily: fontFamily.mono,
  minHeight: spacing["4"],
};

const cellButton: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing["1"],
  alignItems: "stretch",
  width: "100%",
  margin: 0,
  padding: spacing["1"],
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  background: cssVar("surface-raised"),
  border: `1px solid ${cssVar("border-subtle")}`,
  borderRadius: radii.md,
  cursor: "pointer",
  boxSizing: "border-box",
};

const cellName: CSSProperties = {
  fontFamily: fontFamily.mono,
  fontSize: fontSize.xs.fontSize,
  lineHeight: `${fontSize.xs.lineHeight}px`,
  overflowWrap: "anywhere",
};

const cellValue: CSSProperties = {
  ...cellName,
  color: cssVar("text-muted"),
};

const cellValueCopied: CSSProperties = {
  ...cellName,
  color: cssVar("success"),
  fontWeight: fontWeight.semibold,
};

/** The colour block of a swatch — a hairline keeps white readable on white. */
const swatchFill: CSSProperties = {
  display: "block",
  height: spacing["6"],
  borderRadius: radii.sm,
  border: `1px solid ${cssVar("border-subtle")}`,
};

/** Track + fill of a spacing specimen: at `spacing.0` the track is all there is. */
const spacingTrack: CSSProperties = {
  display: "block",
  width: "100%",
  height: spacing["2"],
  borderRadius: radii.sm,
  background: cssVar("surface-sunken"),
  border: `1px solid ${cssVar("border-subtle")}`,
  boxSizing: "border-box",
};

const spacingBar: CSSProperties = {
  display: "block",
  height: "100%",
  background: cssVar("brand"),
  borderRadius: radii.sm,
};

const specimenRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: spacing["7"],
};

interface CellProps {
  /**
   * Fully-qualified token name — unique across the page, so two ramps sharing
   * a step number do not confirm each other's copy. Also the accessible name.
   */
  readonly id: string;
  /** What the cell prints as its label; the section header carries the rest. */
  readonly label: string;
  /** The value this cell copies and prints. */
  readonly value: string;
  /** Id of the cell showing its confirmation, if any. */
  readonly copiedId: string | null;
  readonly onCopy: (id: string, value: string) => void;
  /** The thing being documented: a colour block, a bar, a corner, a glyph. */
  readonly children: ReactNode;
}

function Cell(props: CellProps): ReactElement {
  const copied = props.copiedId === props.id;
  return (
    <button
      type="button"
      aria-label={`${COPY_ACTION} ${props.id} ${props.value}`}
      data-analytics="none"
      data-analytics-reason="design-system reference page; not a product surface"
      onClick={() => {
        props.onCopy(props.id, props.value);
      }}
      style={cellButton}
    >
      {props.children}
      <span style={cellName}>{props.label}</span>
      <span style={copied ? cellValueCopied : cellValue}>
        {copied ? COPIED : props.value}
      </span>
    </button>
  );
}

function Section(props: {
  readonly name: string;
  readonly count: number;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: spacing["2"] }}>
      <h3
        style={{
          margin: 0,
          fontSize: fontSize.sm.fontSize,
          lineHeight: `${fontSize.sm.lineHeight}px`,
          fontWeight: fontWeight.semibold,
        }}
      >
        {props.name}
        <span style={{ color: cssVar("text-muted"), fontWeight: fontWeight.regular }}>
          {` · ${String(props.count)}`}
        </span>
      </h3>
      {props.children}
    </section>
  );
}

function Palette(): ReactElement {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Readonly<Record<string, string>>>({});
  const rolesRef = useRef<HTMLDivElement | null>(null);

  const handleCopy = useCallback((id: string, value: string): void => {
    void copyValue(value).then((ok) => {
      if (ok) setCopiedId(id);
    });
  }, []);

  useEffect(() => {
    if (copiedId === null) return;
    const timer = setTimeout(() => {
      setCopiedId(null);
    }, COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copiedId]);

  // Roles carry no literal value — they are `var()` refs. Read what the
  // browser paints, and re-read on every data-theme flip so the printed
  // number is the one currently on screen.
  const measureRoles = useCallback((): void => {
    const host = rolesRef.current;
    if (!host || typeof window === "undefined") return;
    const next: Record<string, string> = {};
    host.querySelectorAll<HTMLElement>("[data-token]").forEach((node) => {
      const name = node.dataset["token"];
      if (name === undefined) return;
      const painted = window.getComputedStyle(node).backgroundColor;
      if (painted !== "") next[name] = compactColor(painted);
    });
    setResolved(next);
  }, []);

  useEffect(() => {
    measureRoles();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(measureRoles);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
    };
  }, [measureRoles]);

  const roleNames = Object.keys(colors);

  return (
    <div style={frame} data-theme-surface>
      <div style={headerRow}>
        <span>{COPY_HINT}</span>
        <span role="status" style={statusLine}>
          {copiedId === null ? "" : `${COPIED} · ${copiedId}`}
        </span>
      </div>

      <Section name="roles" count={roleNames.length}>
        <div style={autoGrid("6rem")} ref={rolesRef}>
          {roleNames.map((name) => (
            <Cell
              key={name}
              id={name}
              label={name}
              value={resolved[name] ?? UNRESOLVED}
              copiedId={copiedId}
              onCopy={handleCopy}
            >
              <span
                data-token={name}
                style={{ ...swatchFill, background: `var(--stapel-${name})` }}
              />
            </Cell>
          ))}
        </div>
      </Section>

      {Object.entries(ramps).map(([ramp, steps]) => {
        const entries = Object.entries(steps);
        return (
          <Section key={ramp} name={ramp} count={entries.length}>
            <div style={autoGrid("4.25rem")}>
              {entries.map(([step, hex]) => (
                <Cell
                  key={step}
                  id={`${ramp}.${step}`}
                  label={step}
                  value={hex}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                >
                  <span style={{ ...swatchFill, background: hex }} />
                </Cell>
              ))}
            </div>
          </Section>
        );
      })}

      <Section name="spacing" count={Object.keys(spacing).length}>
        <div style={autoGrid("7rem")}>
          {Object.entries(spacing).map(([step, px]) => (
            <Cell
              key={step}
              id={`spacing.${step}`}
              label={`spacing.${step}`}
              value={`${String(px)}px`}
              copiedId={copiedId}
              onCopy={handleCopy}
            >
              <span style={specimenRow}>
                <span style={spacingTrack}>
                  <span style={{ ...spacingBar, width: px }} />
                </span>
              </span>
            </Cell>
          ))}
        </div>
      </Section>

      <Section name="radii" count={Object.keys(radii).length}>
        <div style={autoGrid("5rem")}>
          {Object.entries(radii).map(([name, px]) => (
            <Cell
              key={name}
              id={`radii.${name}`}
              label={`radii.${name}`}
              value={`${String(px)}px`}
              copiedId={copiedId}
              onCopy={handleCopy}
            >
              <span style={specimenRow}>
                <span
                  style={{
                    display: "block",
                    width: spacing["7"],
                    height: spacing["7"],
                    borderRadius: px,
                    background: cssVar("surface-sunken"),
                    border: `2px solid ${cssVar("brand")}`,
                    boxSizing: "border-box",
                  }}
                />
              </span>
            </Cell>
          ))}
        </div>
      </Section>

      <Section name="fontSize" count={Object.keys(fontSize).length}>
        <div style={autoGrid("6rem")}>
          {Object.entries(fontSize).map(([name, step]) => (
            <Cell
              key={name}
              id={`fontSize.${name}`}
              label={`fontSize.${name}`}
              value={`${String(step.fontSize)}/${String(step.lineHeight)}px`}
              copiedId={copiedId}
              onCopy={handleCopy}
            >
              <span style={specimenRow}>
                <span
                  style={{
                    fontSize: step.fontSize,
                    lineHeight: `${String(step.lineHeight)}px`,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {TYPE_SPECIMEN}
                </span>
              </span>
            </Cell>
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
    "Every design token by name and by value — L1 raw ramps (literal hex), the §68 neutral colour roles (resolved at runtime, so the printed value follows data-theme), and spacing/radii/fontSize drawn as specimens. Click any cell to copy its value. Enumerated from the generated surface, so it never drifts.",
  component: Palette,
  tokens: [
    "surface",
    "surface-raised",
    "surface-sunken",
    "text",
    "text-muted",
    "border-subtle",
    "brand",
    "success",
  ],
  variants: {
    default: { render: () => <Palette /> },
  },
});
