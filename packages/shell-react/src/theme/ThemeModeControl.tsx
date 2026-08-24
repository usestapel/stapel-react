/**
 * `<ThemeModeControl/>` — the three-state theme switch, in the Django-admin
 * idiom: sun, moon, half-filled disc, side by side, one of them marked.
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
 * No `outline: none` anywhere: the browser's own focus ring is the only
 * focus affordance a library can ship that is right in every host.
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
 * There is no tooltip. The accessible name carries what the icon means, and
 * a `title` is invisible to touch, unreachable by keyboard, and a duplicate
 * of the name for everyone else.
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
}

export const themeModeLabelsEn: ThemeModeLabels = {
  group: "Appearance",
  light: "Light",
  dark: "Dark",
  system: "Match system",
};

export interface ThemeModeControlProps {
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
  /** Test/host hook — lands on the group element. */
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

// Neutral translucent grey: legible over a light OR a dark surface, so the
// fallback is not a bet on which one a token-less host is showing.
const MARKED_BG = "var(--stapel-surface-overlay, rgba(128,128,128,0.22))";
const MARKED_FG = "var(--stapel-text, currentColor)";
const UNMARKED_FG = "var(--stapel-text-muted, currentColor)";

export function ThemeModeControl({
  value,
  onChange,
  resolved,
  labels = themeModeLabelsEn,
  size = "1rem",
  className,
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
      data-testid={testId}
      onKeyDown={onKeyDown}
      // The group's key handler only MOVES the choice between its own radios;
      // the outcome a funnel would count is the `onChange` the host wires,
      // and the buttons below carry the same declaration for their clicks.
      data-analytics="none"
      data-analytics-reason="local-ui-theme-choice — the control writes nothing; pairs carry no @stapel/analytics runtime dependency, so the host instruments its own onChange"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.125rem",
        borderRadius: "var(--stapel-radius-md, 0.375rem)",
      }}
    >
      {THEME_PREFERENCES.map((preference) => {
        const marked = preference === value;
        const Glyph = GLYPHS[preference];
        // The half-disc says what it currently resolves to, so a reader who
        // cannot see which button is marked still gets the distinction the
        // marking carries visually.
        const name =
          preference === "system"
            ? `${labels.system} (${labels[resolvedMode]})`
            : labels[preference];
        return (
          <button
            key={preference}
            type="button"
            role="radio"
            aria-checked={marked}
            aria-label={name}
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
              padding: "0.3125rem",
              border: "none",
              borderRadius: "var(--stapel-radius-md, 0.375rem)",
              background: marked ? MARKED_BG : "transparent",
              color: marked ? MARKED_FG : UNMARKED_FG,
              cursor: marked ? "default" : "pointer",
              lineHeight: 0,
            }}
          >
            <Glyph size={size} />
          </button>
        );
      })}
    </div>
  );
}
