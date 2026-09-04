/**
 * `<ThemeModeControl/>` — the three-state theme switch, in two shapes.
 *
 * ── Two variants, and why `compact` is the default ───────────────────────
 *
 * `variant="settings"` is the segmented control: three named choices —
 * sun/Light, moon/Dark, half-disc/Match system — inside one track, with the
 * chosen segment filled. It is the right control on a settings screen, where
 * every state is worth naming and the room is there to name it.
 *
 * It was also, for two waves, the DEFAULT — which put a ~310px three-label
 * segmented control in the first row of every desktop page, because the
 * shells mount the switch in their header chrome. A control that says
 * "light / dark / system" in words is a SETTING wearing navigation's clothes:
 * hosts answered by switching the chrome's switch off entirely and rebuilding
 * a home for it (the fleet's storefront moved it to its footer), which is the
 * shape of a default that is wrong rather than merely unfashionable.
 *
 * So the default is now `variant="compact"`: ONE icon button, 36px, showing
 * the state the page is in and cycling light → dark → system on click. It is
 * the header idiom every product ships, it fits a 56px bar and a 200px
 * `Sider` foot alike, and it costs nothing a reader needs — the accessible
 * name says both where the choice is and where the next press takes it
 * ("Appearance: Dark. Switch to Match system"), which the three-label track
 * only ever said in pictures.
 *
 * A host that wants the old control back passes `variant="settings"`.
 *
 * ── The settings variant, unchanged ──────────────────────────────────────
 *
 * It shipped as three bare 24px glyphs with no words and no visible selected
 * state, which is a control whose CURRENT VALUE cannot be read: the one thing
 * a settings control exists to tell you. Each segment now carries its label
 * beside its glyph and is at least 44px tall (WCAG 2.5.8), and the chosen one
 * is a filled, outlined, semibold segment rather than a slightly different
 * grey.
 *
 * ── Why it is plain DOM and not a skin ───────────────────────────────────
 *
 * The fleet's two consumers render nothing alike: one is Tailwind + radix
 * with no antd at all, the other wraps stapel skins in an antd
 * `ConfigProvider`. A `/default` antd skin would be unusable in the first;
 * a headless hook would leave both to redraw the same three buttons. So the
 * control is buttons and inline `currentColor` SVG — the same house
 * convention `default/icons.tsx` follows — sized in `em` and coloured
 * through `--stapel-*` custom properties WITH FALLBACKS, so a host that
 * never loaded `@stapel/tokens`' `tokens.css` still gets a control that
 * inherits its surroundings instead of one painted a colour nobody chose.
 *
 * No `outline: none` anywhere. The RING is the shell's token
 * (`--stapel-focus-ring`, `:focus-visible` only — never on a mouse click),
 * the same convention the shell's other header controls draw
 * (`tokens-antd`'s `skinCarouselCss`, antd's own `genFocusStyle`); a plain
 * `<button>` left to the engine's own default drew Chromium's blue ring
 * while its header neighbours drew the token one, which is the seam Pass 11
 * closes, not a reason to opt this control out of the ring altogether.
 *
 * ── The radiogroup is a real radiogroup ──────────────────────────────────
 *
 * `role="radiogroup"` with three `role="radio"` children is a promise about
 * KEYBOARD behaviour, not just about the names a screen reader reads out: a
 * radio group is ONE tab stop, and the arrow keys move the choice inside it
 * (WAI-ARIA APG, radio group pattern). Three separately tabbable buttons
 * that ignore the arrow keys announce themselves as a radio group and then
 * behave like nothing of the sort — which is worse for the person relying on
 * the announcement than plain buttons would have been. So: roving tabindex
 * (only the marked button is in the tab order), Left/Up and Right/Down move
 * and CHOOSE (the APG's "selection follows focus", which is right here
 * because choosing is instant and reversible), Home/End jump to the ends.
 *
 * There is no tooltip by default, in either variant. The accessible name
 * carries what the icon means, and a `title` is invisible to touch,
 * unreachable by keyboard, and a duplicate of the name for everyone else.
 * `tooltip` turns one on for a desktop-only host that wants it anyway.
 *
 * ── Three states, and the one that is not a colour ───────────────────────
 *
 * `system` is a RULE, not a colour: it resolves to light or dark and keeps
 * resolving. A control that showed only the resolved colour would render
 * "following the system, currently dark" and "pinned to dark" identically,
 * and the person could no longer tell whether their choice was going to
 * move at nightfall. The distinction lives in WHICH BUTTON IS MARKED —
 * `aria-checked` and the marked styling sit on the half-disc while `system`
 * is chosen, whatever it resolves to — and, for a reader who cannot see
 * which one is marked, in the half-disc's accessible NAME, which appends the
 * mode it currently resolves to ("Match system (Dark)"). No fourth string is
 * needed for that: it is composed from the three labels the control already
 * has.
 */
import { useCallback, useRef } from "react";
import type { KeyboardEvent, ReactElement } from "react";

import {
  THEME_PREFERENCES,
  type ThemeMode,
  type ThemePreference,
} from "./preference.js";
import { useDocumentThemeMode } from "./useTheme.js";

/** The copy the control renders. English floor; a host with an i18n engine
 * passes its own (see `SHELL_I18N_KEYS.theme*`). */
export interface ThemeModeLabels {
  /** Accessible name of the group as a whole. */
  readonly group: string;
  readonly light: string;
  readonly dark: string;
  readonly system: string;
  /**
   * The compact button's accessible name, as a TEMPLATE over `{current}` and
   * `{next}` — the control interpolates the state names into it, so a
   * translator keeps their own word order instead of receiving two nouns
   * glued to an English frame. Optional: a host that passed the four state
   * labels before this variant existed keeps type-checking, and falls back to
   * the English floor's sentence.
   */
  readonly cycle?: string;
}

export const themeModeLabelsEn: ThemeModeLabels = {
  group: "Appearance",
  light: "Light",
  dark: "Dark",
  system: "Match system",
  cycle: "Appearance: {current}. Switch to {next}",
};

/** Which shape the control takes. See this module's header. */
export type ThemeModeControlVariant = "compact" | "settings";

export interface ThemeModeControlProps {
  /**
   * `"compact"` (the default) — one icon button for a header, cycling
   * light → dark → system. `"settings"` — the three-label segmented control,
   * for a settings screen with room to name every state.
   */
  readonly variant?: ThemeModeControlVariant;
  /** The preference currently chosen — the three-state value, never the
   * resolved colour. */
  readonly value: ThemePreference;
  /** Called with the state the person picked. The control writes nothing
   * itself: applying and persisting are the host's, via
   * `useThemePreference` and whatever it stores the field in. */
  readonly onChange: (next: ThemePreference) => void;
  /**
   * What `system` resolves to right now, for the half-disc's accessible
   * name. Defaults to the mode the DOCUMENT is stamped with, observed live —
   * so an OS change while mounted updates the name with no host wiring.
   */
  readonly resolved?: ThemeMode;
  readonly labels?: ThemeModeLabels;
  /** Icon size, any CSS length. Default `1rem`. */
  readonly size?: string;
  readonly className?: string;
  /**
   * Mirror the accessible name into a `title`. Off by default in both
   * variants — a tooltip is invisible to touch and unreachable by keyboard,
   * so it can only ever be an extra for a pointer, never the explanation.
   */
  readonly tooltip?: boolean;
  /** Test/host hook — lands on the group element (`settings`) or on the
   * button itself (`compact`). */
  readonly "data-testid"?: string;
}

function Sun({ size }: { size: string }): ReactElement {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </Glyph>
  );
}

function Moon({ size }: { size: string }): ReactElement {
  return (
    <Glyph size={size}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Glyph>
  );
}

/** A disc filled on one side — the "neither, both, whichever" glyph. Its
 * shape never changes with what `system` resolves to: the mark, not the
 * icon, is what says which state is chosen. */
function HalfDisc({ size }: { size: string }): ReactElement {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

function Glyph({
  size,
  children,
}: {
  size: string;
  children: ReactElement | readonly ReactElement[];
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const GLYPHS: Record<ThemePreference, (p: { size: string }) => ReactElement> = {
  light: Sun,
  dark: Moon,
  system: HalfDisc,
};

// Neutral translucent greys: legible over a light OR a dark surface, so the
// fallback is not a bet on which one a token-less host is showing.
const TRACK_BG = "var(--stapel-surface-sunken, rgba(128,128,128,0.12))";
const TRACK_BORDER = "var(--stapel-border, rgba(128,128,128,0.35))";
const MARKED_BG = "var(--stapel-surface, rgba(255,255,255,0.9))";
const MARKED_BORDER = "var(--stapel-brand, rgba(128,128,128,0.6))";
const MARKED_FG = "var(--stapel-text, currentColor)";
const UNMARKED_FG = "var(--stapel-text-muted, currentColor)";

/**
 * The minimum touch target (WCAG 2.5.8 / platform HIGs: 44 CSS px), in `em` so
 * the control scales with the type around it — the same unit the glyphs use.
 * The shipped control was three 24px squares, which is a 44px rule written
 * down and then not applied to the one control that is nothing but targets.
 */
const SEGMENT_MIN_HEIGHT = "2.75rem";

/**
 * The class both variants' buttons carry so ONE hoisted stylesheet (React 19's
 * `<style href precedence>` dedup, the same mechanism `NavDock` uses) can draw
 * the ring — an inline `style` object cannot express a pseudo-class.
 */
export const THEME_CONTROL_FOCUS_CLASS: string = "stapel-theme-control-focus";

/** The hoisted sheet's dedup key. */
const THEME_CONTROL_STYLE_HREF = "stapel-shell-theme-focus";

/**
 * The keyboard-focus ring: the shell's token, 2px, `:focus-visible` only —
 * never drawn for a mouse click, and never `outline:none` at rest, so a
 * host with no `@stapel/tokens` still gets a visible neutral ring rather
 * than none at all.
 */
export function themeControlFocusCss(): string {
  return `.${THEME_CONTROL_FOCUS_CLASS}:focus-visible{outline:2px solid var(--stapel-focus-ring, rgba(128,128,128,0.6));outline-offset:2px}`;
}

/** `className` + the ring class, host class last so it can still override. */
function withFocusClass(className: string | undefined): string {
  return className ? `${THEME_CONTROL_FOCUS_CLASS} ${className}` : THEME_CONTROL_FOCUS_CLASS;
}

const GROUP_STYLE = {
  display: "inline-flex",
  alignItems: "stretch",
  // Three named segments are ~310px wide, and the chrome now mounts the
  // control in places narrower than that (a 200px `Sider`, a nav sheet). A
  // single non-wrapping row there clips the third segment — the one whose
  // whole purpose is to say the choice is a RULE and not a colour — so the
  // track wraps instead of hiding a state.
  flexWrap: "wrap",
  gap: "0.125rem",
  maxWidth: "100%",
  padding: "0.125rem",
  background: TRACK_BG,
  border: `1px solid ${TRACK_BORDER}`,
  borderRadius: "var(--stapel-radius-lg, 0.625rem)",
} as const;

/**
 * The COMPACT button's own geometry. 36px is the top of the 32–36px band a
 * header icon button lives in — comfortably above the 24px squares this
 * control shipped as, still short enough for a 56px bar. It is deliberately
 * NOT the settings variant's 44px: that rule governs a row of three adjacent
 * targets where a mis-hit picks the wrong state; this is one isolated button
 * whose mis-hit is a miss.
 */
const COMPACT_SIZE = "2.25rem";

/** `{param}` interpolation, the same shape core's i18n engine uses — here so
 * the control can compose its own name without an engine (it renders in
 * hosts that have none). */
function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{([\w.]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] ?? match : match,
  );
}

/** What a state is CALLED. `system` appends what it currently resolves to,
 * because "following the system, currently dark" and "pinned to dark" are
 * different answers and a reader who cannot see the glyph gets the
 * distinction nowhere else. */
function stateName(
  preference: ThemePreference,
  labels: ThemeModeLabels,
  resolvedMode: ThemeMode,
): string {
  return preference === "system"
    ? `${labels.system} (${labels[resolvedMode]})`
    : labels[preference];
}

/** The state one press away, in the order the segmented track lists them. */
function nextPreference(from: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(from);
  return (
    THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? THEME_PREFERENCES[0] ?? "light"
  );
}

export function ThemeModeControl(props: ThemeModeControlProps): ReactElement {
  return (
    <>
      <style href={THEME_CONTROL_STYLE_HREF} precedence="default">
        {themeControlFocusCss()}
      </style>
      {props.variant === "settings" ? (
        <SettingsControl {...props} />
      ) : (
        <CompactControl {...props} />
      )}
    </>
  );
}

/**
 * One icon button: the state the page is in, cycling to the next on click.
 *
 * It is a plain `<button>`, not a radio and not a `switch`: `role="switch"`
 * is a promise of TWO states and this cycles three, so the honest control is
 * a button whose name says what pressing it does. Enter and Space therefore
 * work with no key handling of our own, and the glyph is the current state
 * rather than the next one — a button that pictures its destination reads as
 * a control already set to it.
 */
function CompactControl({
  value,
  onChange,
  resolved,
  labels = themeModeLabelsEn,
  size = "1rem",
  className,
  tooltip = false,
  "data-testid": testId,
}: ThemeModeControlProps): ReactElement {
  const observed = useDocumentThemeMode();
  const resolvedMode = resolved ?? observed;
  const next = nextPreference(value);
  const Glyph = GLYPHS[value];
  const name = interpolate(labels.cycle ?? themeModeLabelsEn.cycle ?? "", {
    current: stateName(value, labels, resolvedMode),
    // The NEXT state is named bare, without its resolution: it is a
    // destination, not an appearance, and "Switch to Match system (Dark)"
    // names a colour the press does not necessarily land on.
    next: labels[next],
  });

  return (
    <button
      type="button"
      className={withFocusClass(className)}
      aria-label={name}
      {...(tooltip ? { title: name } : {})}
      data-state={value}
      data-variant="compact"
      data-resolved={value === "system" ? resolvedMode : undefined}
      data-testid={testId}
      data-analytics="none"
      data-analytics-reason="local-ui-theme-choice — the control writes nothing; pairs carry no @stapel/analytics runtime dependency, so the host instruments its own onChange"
      onClick={() => onChange(next)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        inlineSize: COMPACT_SIZE,
        blockSize: COMPACT_SIZE,
        padding: 0,
        border: `1px solid ${TRACK_BORDER}`,
        borderRadius: "var(--stapel-radius-md, 0.5rem)",
        background: TRACK_BG,
        color: MARKED_FG,
        cursor: "pointer",
        font: "inherit",
        lineHeight: 1,
      }}
    >
      <Glyph size={size} />
    </button>
  );
}

function SettingsControl({
  value,
  onChange,
  resolved,
  labels = themeModeLabelsEn,
  size = "1rem",
  className,
  tooltip = false,
  "data-testid": testId,
}: ThemeModeControlProps): ReactElement {
  const observed = useDocumentThemeMode();
  const resolvedMode = resolved ?? observed;
  const groupRef = useRef<HTMLDivElement | null>(null);

  /** Move the choice — and the focus with it — inside the group. */
  const step = useCallback(
    (from: ThemePreference, delta: number): void => {
      const index = THEME_PREFERENCES.indexOf(from);
      const next =
        THEME_PREFERENCES[
          (index + delta + THEME_PREFERENCES.length) % THEME_PREFERENCES.length
        ];
      if (next === undefined || next === from) return;
      onChange(next);
      groupRef.current
        ?.querySelector<HTMLButtonElement>(`[data-state="${next}"]`)
        ?.focus();
    },
    [onChange],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      const keys: Record<string, number> = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1,
      };
      const delta = keys[event.key];
      if (delta !== undefined) {
        event.preventDefault();
        step(value, delta);
        return;
      }
      if (event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const target =
        event.key === "Home"
          ? THEME_PREFERENCES[0]
          : THEME_PREFERENCES[THEME_PREFERENCES.length - 1];
      if (target !== undefined && target !== value) {
        onChange(target);
        groupRef.current
          ?.querySelector<HTMLButtonElement>(`[data-state="${target}"]`)
          ?.focus();
      }
    },
    [onChange, step, value],
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={labels.group}
      className={className}
      data-variant="settings"
      data-testid={testId}
      onKeyDown={onKeyDown}
      // The group's key handler only MOVES the choice between its own radios;
      // the outcome a funnel would count is the `onChange` the host wires,
      // and the buttons below carry the same declaration for their clicks.
      data-analytics="none"
      data-analytics-reason="local-ui-theme-choice — the control writes nothing; pairs carry no @stapel/analytics runtime dependency, so the host instruments its own onChange"
      style={GROUP_STYLE}
    >
      {THEME_PREFERENCES.map((preference) => {
        const marked = preference === value;
        const Glyph = GLYPHS[preference];
        // The half-disc says what it currently resolves to, so a reader who
        // cannot see which button is marked still gets the distinction the
        // marking carries visually.
        const name = stateName(preference, labels, resolvedMode);
        return (
          <button
            key={preference}
            type="button"
            role="radio"
            className={THEME_CONTROL_FOCUS_CLASS}
            aria-checked={marked}
            aria-label={name}
            {...(tooltip ? { title: name } : {})}
            // Roving tabindex: the group is ONE tab stop, and the arrow keys
            // move inside it (see this module's header).
            tabIndex={marked ? 0 : -1}
            data-state={preference}
            data-resolved={preference === "system" ? resolvedMode : undefined}
            data-analytics="none"
            data-analytics-reason="local-ui-theme-choice — the control writes nothing; pairs carry no @stapel/analytics runtime dependency, so the host instruments its own onChange"
            onClick={() => {
              if (!marked) onChange(preference);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4375rem",
              minHeight: SEGMENT_MIN_HEIGHT,
              minWidth: 0,
              padding: "0 0.75rem",
              border: `1px solid ${marked ? MARKED_BORDER : "transparent"}`,
              borderRadius: "var(--stapel-radius-md, 0.5rem)",
              background: marked ? MARKED_BG : "transparent",
              color: marked ? MARKED_FG : UNMARKED_FG,
              cursor: marked ? "default" : "pointer",
              font: "inherit",
              fontWeight: marked ? 600 : 400,
              lineHeight: 1.2,
            }}
          >
            <Glyph size={size} />
            {/* The label is not decoration on top of the icon: three bare
                glyphs with no selected state and no words is a control whose
                current value cannot be read at all. `aria-label` still carries
                the composed name (`Match system (Dark)`) for a reader who
                cannot see which segment is marked. */}
            <span style={{ whiteSpace: "nowrap" }}>{labels[preference]}</span>
          </button>
        );
      })}
    </div>
  );
}
