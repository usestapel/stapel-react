/**
 * `<BrickConsole/>` — the whole handheld: a 4-bit LCD, the side column, the
 * keyboard, and the keypad a phone gets instead of the keyboard.
 *
 * ── The LCD ────────────────────────────────────────────────────────────────
 * The panel is a DOM grid, not a canvas. A canvas would need the palette read
 * back out of `getComputedStyle` to follow the theme, would paint nothing in a
 * test environment, and would be invisible to a screen reader. A grid of
 * `<span>`s follows `data-theme` for free, is assertable, and — with the panel
 * itself named and the frame described in words — announces as one image
 * rather than as four hundred empty elements.
 *
 * The four shades are token roles, off to lit: an unlit cell keeps the faint
 * ghost a real LCD segment has (`border-subtle`), and the three lit levels walk
 * up the text ramp. Set `ghostPixels={false}` for a panel whose off cells are
 * truly blank.
 *
 * ── Layout ─────────────────────────────────────────────────────────────────
 * The field is centred; score, best, the level stepper, next, Start/Pause and
 * Reset sit in one tight column to its right; the game chips go under; and
 * under those, the keypad on a coarse pointer or the key legend on a fine one.
 * A paused field carries a clickable veil saying so, so a mouse always has a
 * way back.
 *
 * The LEVEL is picked with a plus and a minus: a person who already knows the
 * game should not have to play four slow levels to reach the one they wanted.
 * Changing it always DEALS A FRESH BOARD at the new level — that is the one
 * thing the stepper does, in every phase — and the board then behaves the way
 * the console was mounted: an `autoStart` console plays it, a manual one waits
 * on Start. Because an autostarting console is already running in its very
 * first frame, its stepper stays live; locking it "while a run is under way"
 * would be locking it forever, and the level would be unreachable. A console
 * that starts on a gesture keeps the lock: the run is one the person asked
 * for, and a mis-aimed plus must not throw it away.
 *
 * ── Keys ───────────────────────────────────────────────────────────────────
 * Arrows or WASD, Space for OK, Enter for Start, R for Reset. By default the
 * frame is focusable and reads keys only while focus is inside it
 * (`captureKeys="focus"`); `"global"` reads the window instead. In both modes
 * a key whose target is editable, or a Space/Enter on a focused button, stays
 * with that target; a handler that already called `preventDefault()` keeps
 * the key; and `enabled={false}` detaches everything. A key held down is
 * reported to the game as a hold (a soft drop, a snake at speed).
 *
 * ── Reduced motion ─────────────────────────────────────────────────────────
 * `prefers-reduced-motion` removes the cell transition, so a moving piece
 * snaps rather than fades. The GAME still runs: the request is about
 * decoration, and a person who asked for less movement did not ask to be
 * denied the thing they are looking at.
 *
 * ── Announced with its controls ────────────────────────────────────────────
 * The frame is a named group, and `aria-describedby` points at whichever
 * control surface is on screen: the key legend on a fine pointer, the keypad
 * on a coarse one. Landing on the frame therefore says what the thing is AND
 * how it is played, instead of "group, brick game console" and silence.
 */
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement, Ref } from "react";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { BRICK_GAME_IDS, findGame } from "../headless/games/index.js";
import { BRICK_I18N_KEYS } from "../i18n/keys.js";
import { Keypad } from "./Keypad.js";
import { useBrickGame } from "./useBrickGame.js";
import type { BrickPhase } from "./useBrickGame.js";
import { useBrickT, useCoarsePointer, useReducedMotion } from "./hooks.js";
import type { BrickTranslate } from "./hooks.js";
import type { HighScoreStore } from "../headless/highscores.js";
import type {
  BrickGameId,
  BrickInput,
  CellLevel,
  GameDefinition,
} from "../headless/types.js";

/** How big one LCD pixel is, per size. */
const CELL_PX: Record<BrickConsoleSize, number> = { sm: 7, md: 11, lg: 15 };
/** The gap between pixels — a real LCD has one, and it is what makes it read
 * as pixels rather than as a bitmap. */
const CELL_GAP_PX = 1;
/** The preview box in the side column is always 4x4. */
const PREVIEW_SIDE = 4;

export type BrickConsoleSize = "sm" | "md" | "lg";
/** An explicit pixel size, or `"auto"`: `sm` on a coarse pointer, `md` otherwise. */
export type BrickConsoleSizeChoice = BrickConsoleSize | "auto";

/**
 * Where the console reads the keyboard from, and how hard it insists.
 *
 *  - `"focus"` — only while focus is inside the frame. The narrowest scope, and
 *    the default: a console next to a form never takes the form's keys.
 *  - `"global"` — the window, POLITELY: a key someone else already claimed
 *    (`defaultPrevented`) is not the game's. Window listeners fire in
 *    registration order, so a host shortcut surface that mounted first wins.
 *  - `"claim"` — the window, and a run in progress takes its keys FIRST: the
 *    listener is on the capture phase, so mount order stops deciding who gets
 *    the arrows, and a key the game consumes is stopped rather than merely
 *    marked. The moment the run is not running, it is `"global"` again — a
 *    paused or finished board has no claim on the page's keyboard.
 */
export type BrickKeyCapture = "focus" | "global" | "claim";

/** Off, ghost, shadow, lit — the four levels of the panel. */
const LEVEL_COLOR: readonly string[] = [
  cssVar("border-subtle"),
  cssVar("text-subtle"),
  cssVar("text-muted"),
  cssVar("text"),
];

const frameStyle: CSSProperties = {
  display: "inline-grid",
  justifyItems: "center",
  gap: spacing[3],
  padding: spacing[4],
  borderRadius: radii.lg,
  background: cssVar("surface-raised"),
  border: `1px solid ${cssVar("border")}`,
  color: cssVar("text"),
};

const bodyStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: spacing[3],
};

const screenWrapStyle: CSSProperties = { position: "relative" };

const columnStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: spacing[2],
  minWidth: 0,
  fontSize: fontSize.sm.fontSize,
};

const captionStyle: CSSProperties = {
  color: cssVar("text-muted"),
  fontSize: fontSize.xs.fontSize,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const valueStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
};

const stepperStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
};

const stepStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.sm,
  background: cssVar("surface"),
  color: cssVar("text"),
  padding: spacing[1],
  cursor: "pointer",
};

const stepDisabledStyle: CSSProperties = {
  ...stepStyle,
  color: cssVar("text-subtle"),
  cursor: "default",
};

const buttonStyle: CSSProperties = {
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.md,
  background: cssVar("surface"),
  color: cssVar("text"),
  paddingBlock: spacing[1],
  paddingInline: spacing[3],
  fontSize: fontSize.sm.fontSize,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: cssVar("brand-subtle"),
  color: cssVar("brand"),
  borderColor: cssVar("brand"),
};

const veilStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeContent: "center",
  gap: spacing[1],
  border: 0,
  borderRadius: radii.sm,
  background: `color-mix(in srgb, ${cssVar("surface")} 80%, transparent)`,
  color: cssVar("text"),
  textAlign: "center",
  cursor: "pointer",
};

const veilHintStyle: CSSProperties = {
  color: cssVar("text-muted"),
  fontSize: fontSize.xs.fontSize,
};

const menuStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: spacing[2],
};

const chipStyle: CSSProperties = {
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.full,
  background: cssVar("surface"),
  color: cssVar("text-muted"),
  paddingBlock: spacing[1],
  paddingInline: spacing[3],
  cursor: "pointer",
};

const chipActiveStyle: CSSProperties = {
  ...chipStyle,
  background: cssVar("brand-subtle"),
  color: cssVar("brand"),
  borderColor: cssVar("brand"),
};

const legendStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "center",
  columnGap: spacing[3],
  rowGap: spacing[1],
  margin: 0,
  color: cssVar("text-muted"),
  fontSize: fontSize.xs.fontSize,
};

const kbdStyle: CSSProperties = {
  display: "inline-block",
  border: `1px solid ${cssVar("border-subtle")}`,
  borderRadius: radii.sm,
  paddingInline: spacing[1],
  fontFamily: "inherit",
  color: cssVar("text"),
  whiteSpace: "nowrap",
};

/** One field of the side column. */
function Field(props: {
  readonly caption: string;
  readonly value: string;
  readonly testId?: string;
}): ReactElement {
  return (
    <div>
      <div style={captionStyle}>{props.caption}</div>
      <div style={valueStyle} data-testid={props.testId}>
        {props.value}
      </div>
    </div>
  );
}

/** The minus and the plus of the level stepper. Drawn, so no prose is hardcoded. */
function Sign(props: { readonly plus: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="2" fill="currentColor" />
      {props.plus && <rect x="7" y="3" width="2" height="10" fill="currentColor" />}
    </svg>
  );
}

/** A grid of LCD pixels — the screen, and the next-piece preview. */
function Panel(props: {
  readonly cells: readonly CellLevel[];
  readonly cols: number;
  readonly cell: number;
  readonly ghostPixels: boolean;
  readonly reducedMotion: boolean;
  readonly label?: string;
  readonly testId?: string;
}): ReactElement {
  const { cells, cols, cell, ghostPixels, reducedMotion } = props;
  const gridStyle = useMemo<CSSProperties>(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(${String(cols)}, ${String(cell)}px)`,
      gridAutoRows: `${String(cell)}px`,
      gap: `${String(CELL_GAP_PX)}px`,
      padding: spacing[2],
      background: cssVar("surface-sunken"),
      borderRadius: radii.sm,
      border: `1px solid ${cssVar("border-subtle")}`,
    }),
    [cols, cell]
  );
  const levelStyles = useMemo<readonly CSSProperties[]>(
    () =>
      LEVEL_COLOR.map((color, level) => ({
        background: level === 0 && !ghostPixels ? "transparent" : color,
        borderRadius: radii.sm,
        transition: reducedMotion ? "none" : "background-color 90ms linear",
      })),
    [ghostPixels, reducedMotion]
  );
  return (
    <div
      style={gridStyle}
      data-testid={props.testId}
      role={props.label === undefined ? "presentation" : "img"}
      aria-label={props.label}
    >
      {cells.map((level, index) => (
        // The index IS the identity here: cell 137 is cell 137 for the life of
        // the panel, and no reordering is possible (react/no-array-index-key is
        // about lists that move — this is a fixed raster).
        // eslint-disable-next-line react/no-array-index-key -- fixed raster; the index is the pixel's address
        <span key={index} style={levelStyles[level]} />
      ))}
    </div>
  );
}

/** The key each button answers to, as the legend prints it. */
const KEY_NAME: Record<BrickInput, string> = {
  left: BRICK_I18N_KEYS.keyNameLeft,
  right: BRICK_I18N_KEYS.keyNameRight,
  up: BRICK_I18N_KEYS.keyNameUp,
  down: BRICK_I18N_KEYS.keyNameDown,
  ok: BRICK_I18N_KEYS.keyNameOk,
  start: BRICK_I18N_KEYS.keyNameStart,
  reset: BRICK_I18N_KEYS.keyNameReset,
};

/**
 * The legend a fine pointer gets instead of the keypad — generated from the
 * game's `controls`.
 *
 * It carries the frame's description, and therefore NO `aria-label` of its
 * own: a described element's label REPLACES its content in the description, so
 * a `<dl>` named "Keys" would describe the console as "Keys" and the key list
 * would never be read. The list is the description.
 */
function Legend(props: {
  readonly id: string;
  readonly definition: GameDefinition;
  readonly t: BrickTranslate;
}): ReactElement {
  const { definition, t } = props;
  const rows = [
    ...definition.controls.map((control) => ({
      keys: control.inputs.map((input) => t(KEY_NAME[input])).join(" · "),
      label: t(control.labelKey),
    })),
    { keys: t(KEY_NAME.start), label: t(BRICK_I18N_KEYS.padStart) },
    { keys: t(KEY_NAME.reset), label: t(BRICK_I18N_KEYS.padReset) },
  ];
  return (
    <dl style={legendStyle} id={props.id} data-testid="brick-legend">
      {rows.map((row) => (
        <Fragment key={row.keys}>
          <dt>
            <kbd style={kbdStyle}>{row.keys}</kbd>
          </dt>
          <dd style={{ margin: 0 }}>{row.label}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export interface BrickConsoleProps {
  /**
   * The game to open on when the console picks its own (`defaultGame`), or
   * the game to show when the host does (`game` + `onGameChange`). A `game`
   * given without `onGameChange` seeds the console's own choice, and the
   * chips still switch.
   */
  readonly game?: BrickGameId;
  readonly defaultGame?: BrickGameId;
  /**
   * The games this console offers. More than one draws a row of chips; one
   * (or none) draws no chips at all — a picker with a single choice is
   * furniture.
   */
  readonly games?: readonly BrickGameId[];
  /** Called when the person picks a different game. With `game`, makes the selection controlled. */
  readonly onGameChange?: (game: BrickGameId) => void;
  /** The LCD pixel size. Default `"auto"` — `sm` on a coarse pointer, `md` otherwise. */
  readonly size?: BrickConsoleSizeChoice;
  /**
   * Pin the deal, for a demo or a test. Without it every run is a new game —
   * new pieces, a new first corner, a new sequence.
   */
  readonly seed?: number;
  /** The level the first run opens on; the person moves it with the stepper. */
  readonly startLevel?: number;
  /** Start playing on mount. Default false — a waiting screen should not
   * ambush someone with a falling piece. */
  readonly autoStart?: boolean;
  /** Keep the faint unlit-segment ghost of a real LCD. Default true. */
  readonly ghostPixels?: boolean;
  /** Fired once per run, with the final score and the game it was scored in. */
  readonly onGameOver?: (score: number, game: BrickGameId) => void;
  /** Injected in tests; by default the local `brick-highscores` repository. */
  readonly highScores?: HighScoreStore;
  /**
   * Read the keyboard at all. Default true; `false` detaches every key
   * handler, so a host can hand the keys to something else while the game
   * stays on screen.
   */
  readonly enabled?: boolean;
  /**
   * Where the keys come from, and how hard the console insists on them — see
   * {@link BrickKeyCapture}. Default `"focus"`.
   */
  readonly captureKeys?: BrickKeyCapture;
  /**
   * Take the keyboard on mount. A host that opens the console from a toggle
   * button has, without this, only two choices: a second gesture into the
   * frame, or going page-wide with `captureKeys`. Focusing the frame is the
   * third — the narrow scope, handed over in the same click.
   */
  readonly autoFocus?: boolean;
  /**
   * The frame element, for a host that wants to focus (or blur) it later. The
   * same node `data-testid="brick-console"` names.
   */
  readonly ref?: Ref<HTMLDivElement>;
  /**
   * Every phase the console moves through — `ready`, `running`, `paused`,
   * `over` — reported once per change and once on mount. `data-phase` says the
   * same thing on the DOM; this is so a host never has to read it from there.
   */
  readonly onPhaseChange?: (phase: BrickPhase) => void;
  /**
   * Hold the loop: the tick stops, the board stays. Clearing it resumes only a
   * run this prop paused; a board the person paused stays paused.
   */
  readonly paused?: boolean;
  /** Start again on focus / visible a run the blur or hidden tab stopped. Default true. */
  readonly resumeOnReturn?: boolean;
  readonly "data-testid"?: string;
}

/** Keys the console owns while it is mounted: arrows or WASD, Space for OK. */
const KEY_ACTIONS: Record<string, BrickInput> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  " ": "ok",
};

/** A target whose keystrokes are its own — never the game's. */
const EDITABLE = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
/** A target that acts on Space and Enter itself. */
const ACTIVATABLE = "button,a[href],[role=button]";

/** The shape shared by a DOM `KeyboardEvent` and React's synthetic one. */
interface KeyEventLike {
  readonly key: string;
  readonly repeat: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: EventTarget | null;
  preventDefault(): void;
  stopPropagation(): void;
}

function targetKeepsKey(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(EDITABLE) !== null) return true;
  return (key === " " || key === "Enter") && target.closest(ACTIVATABLE) !== null;
}

/**
 * Would Enter, pressed right now, reach the console?
 *
 * This is a question about WHERE FOCUS IS, not about the capture mode. The
 * package's own guarantee is that a focused button or link keeps Space and
 * Enter — so a console revealed by a host toggle, with focus still on that
 * toggle, does not get Enter in ANY mode, `"claim"` included: the toggle
 * collapses the panel instead. The veil must not promise a key that behaves
 * like that.
 */
function enterReaches(
  frame: HTMLElement | null,
  capture: BrickKeyCapture,
  enabled: boolean
): boolean {
  if (!enabled || typeof document === "undefined") return false;
  const active = document.activeElement;
  // Focus inside the frame: the key is the console's in every mode — either
  // read by the frame itself, or acted on by the console's own focused control
  // (the veil is a button; so is Start).
  if (frame !== null && active !== null && frame.contains(active)) return true;
  // Outside the frame, `"focus"` has no listener to read it with…
  if (capture === "focus") return false;
  // …and the window modes still leave Enter to a target that acts on it.
  return !targetKeepsKey(active, "Enter");
}

/** The word for a phase, or null while the game is simply being played. */
function statusKey(phase: BrickPhase): string | null {
  if (phase === "over") return BRICK_I18N_KEYS.statusOver;
  if (phase === "paused") return BRICK_I18N_KEYS.statusPaused;
  if (phase === "ready") return BRICK_I18N_KEYS.statusReady;
  return null;
}

/** What the Start button offers in each phase. */
const START_LABEL: Record<BrickPhase, string> = {
  ready: BRICK_I18N_KEYS.buttonStart,
  running: BRICK_I18N_KEYS.buttonPause,
  paused: BRICK_I18N_KEYS.buttonResume,
  over: BRICK_I18N_KEYS.buttonAgain,
};

/** What a screen reader is told the panel is showing. */
function screenLabel(t: BrickTranslate, phase: BrickPhase, score: number): string {
  const name = t(BRICK_I18N_KEYS.screenLabel);
  const word = statusKey(phase);
  return word === null ? `${name}: ${String(score)}` : `${name}: ${t(word)}`;
}

export function BrickConsole(props: BrickConsoleProps): ReactElement {
  const games = props.games ?? [];
  const seedGame = props.game ?? props.defaultGame ?? games[0] ?? "tetris";
  const [ownGame, setOwnGame] = useState<BrickGameId>(seedGame);
  // A `game` the host moves is followed even when the chips are the
  // console's; with `onGameChange` beside it the host owns the choice.
  useEffect(() => {
    if (props.game !== undefined) setOwnGame(props.game);
  }, [props.game]);
  const controlled = props.game !== undefined && props.onGameChange !== undefined;
  const game = controlled ? (props.game ?? ownGame) : ownGame;

  const ghostPixels = props.ghostPixels ?? true;
  const enabled = props.enabled ?? true;
  const captureKeys = props.captureKeys ?? "focus";
  const autoStart = props.autoStart ?? false;
  const coarse = useCoarsePointer();
  const sizeChoice = props.size ?? "auto";
  const size: BrickConsoleSize =
    sizeChoice === "auto" ? (coarse ? "sm" : "md") : sizeChoice;
  const reducedMotion = useReducedMotion();
  const t = useBrickT();

  const bag = useBrickGame({
    game,
    ...(props.startLevel === undefined ? {} : { startLevel: props.startLevel }),
    ...(props.seed === undefined ? {} : { seed: props.seed }),
    ...(props.highScores === undefined ? {} : { highScores: props.highScores }),
    ...(props.onGameOver === undefined ? {} : { onGameOver: props.onGameOver }),
    autoStart,
    ...(props.paused === undefined ? {} : { paused: props.paused }),
    ...(props.resumeOnReturn === undefined ? {} : { resumeOnReturn: props.resumeOnReturn }),
    ...(props.onPhaseChange === undefined ? {} : { onPhaseChange: props.onPhaseChange }),
  });
  const { press, hold, toggleStart, reset } = bag;

  // One reader for every mode. A key aimed at a target that acts on it is never
  // the game's; a key someone else already claimed is not the game's either,
  // unless this console is CLAIMING (in which case nobody has had a turn yet —
  // it is reading on the capture phase, before the rest of the page).
  const readKey = useCallback(
    (event: KeyEventLike, claiming: boolean): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (targetKeepsKey(event.target, event.key)) return;
      // Taking a key means saying so both ways: `preventDefault` for the page's
      // default action, and — while claiming — stopping it reaching the host
      // listeners that would otherwise act on the same arrow.
      const take = (): void => {
        event.preventDefault();
        if (claiming) event.stopPropagation();
      };
      const action = KEY_ACTIONS[event.key];
      if (action) {
        take();
        // The OS's own echo is DROPPED: the hold started a repeat of ours, at a
        // rate a game can be played at, and letting both through would move a
        // piece twice for one key.
        if (!event.repeat) {
          press(action);
          hold(action, true);
        }
        return;
      }
      if (event.key === "Enter") {
        take();
        if (!event.repeat) toggleStart();
        return;
      }
      if (event.key === "r" || event.key === "R") {
        take();
        if (!event.repeat) reset();
      }
    },
    [press, hold, toggleStart, reset]
  );
  const onKeyDown = useCallback(
    (event: KeyEventLike): void => {
      readKey(event, false);
    },
    [readKey]
  );
  const onKeyUp = useCallback(
    (event: KeyEventLike): void => {
      const action = KEY_ACTIONS[event.key];
      if (action) hold(action, false);
    },
    [hold]
  );

  const focusKeys = enabled && captureKeys === "focus";
  const globalKeys = enabled && captureKeys === "global";
  const claimKeys = enabled && captureKeys === "claim";
  // Read inside the listeners, so a phase change never re-registers them.
  const phaseRef = useRef<BrickPhase>(bag.phase);
  phaseRef.current = bag.phase;

  useEffect(() => {
    if ((!globalKeys && !claimKeys) || typeof window === "undefined") return;
    // Claiming: the capture phase, and only while a run is actually on. This is
    // the whole difference — a host shortcut surface that mounted first no
    // longer decides who gets the arrows, because registration order does not
    // reach across phases.
    const claimDown = (event: KeyboardEvent): void => {
      if (phaseRef.current === "running") readKey(event, true);
    };
    // Everything else stays polite, on the bubble phase, yielding to whoever
    // claimed the key first.
    const politeDown = (event: KeyboardEvent): void => {
      if (!claimKeys || phaseRef.current !== "running") readKey(event, false);
    };
    // Key-UP is read on the capture phase in both modes: a hold that is never
    // released because a host swallowed the keyup is a piece that never stops
    // falling.
    if (claimKeys) window.addEventListener("keydown", claimDown, true);
    window.addEventListener("keydown", politeDown);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      if (claimKeys) window.removeEventListener("keydown", claimDown, true);
      window.removeEventListener("keydown", politeDown);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [globalKeys, claimKeys, readKey, onKeyUp]);

  // The frame, for `autoFocus` and for a host that focuses it later.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const outerRef = props.ref;
  const setFrame = useCallback(
    (node: HTMLDivElement | null): void => {
      frameRef.current = node;
      if (typeof outerRef === "function") outerRef(node);
      else if (outerRef) outerRef.current = node;
    },
    [outerRef]
  );
  const autoFocus = props.autoFocus ?? false;
  // Taking focus is half of the disclosure pattern; GIVING IT BACK is the
  // other half, and a host cannot supply it — by the time the console
  // unmounts, the element it took focus from is only known here. Without this
  // a keyboard-only person closing the console is dropped to the top of the
  // document.
  useEffect(() => {
    const frame = frameRef.current;
    if (!autoFocus || frame === null) return;
    const previous = document.activeElement;
    frame.focus();
    // Restore only what this package actually moved: the focus call has to have
    // landed, and there has to be somewhere real to put it back.
    if (document.activeElement !== frame) return;
    if (!(previous instanceof HTMLElement) || previous === frame) return;
    if (previous === document.body) return;
    return () => {
      // The person has moved on to something of their own since — that focus is
      // theirs, not ours to take back.
      const active = document.activeElement;
      const stillOurs = active === null || active === document.body || frame.contains(active);
      if (!stillOurs || !previous.isConnected) return;
      previous.focus();
    };
  }, [autoFocus]);

  const choose = (id: BrickGameId): void => {
    props.onGameChange?.(id);
    if (!controlled) setOwnGame(id);
  };

  const cell = CELL_PX[size];
  const preview = bag.status.next;
  const phase = bag.phase;
  const phaseKey = statusKey(phase);
  const statusWord = phaseKey === null ? "" : t(phaseKey);
  const recordWord = phase === "over" && bag.isRecord ? t(BRICK_I18N_KEYS.statusRecord) : null;
  // The level belongs to the run that has not started yet, so a run the person
  // asked for locks the stepper rather than losing its board to a mis-aimed
  // plus. An AUTOSTARTING console has no such run: it is running in its first
  // frame, before anybody chose anything, and locking there would mean the
  // level could never be picked at all — so its stepper stays live and a
  // change deals a fresh board at the new level, which then plays on.
  const levelLocked = !autoStart && (phase === "running" || phase === "paused");
  // The number on screen is the level being PLAYED, and the stepper steps from
  // it: in a live autostart run the start level may already be behind it, and a
  // plus that appeared to do nothing would be the same defect one layer down.
  const shownLevel = bag.status.level;
  // The veil may only advertise Enter where Enter actually reaches the console
  // — a question about focus, not about the capture mode (see `enterReaches`).
  // The click is always true, so that is the other thing it can promise.
  const [enterHint, setEnterHint] = useState(false);
  useEffect(() => {
    if (phase !== "paused") return;
    const read = (): void => {
      setEnterHint(enterReaches(frameRef.current, captureKeys, enabled));
    };
    read();
    // Focus can move while the veil is up — into the frame, or away from it —
    // and the promise has to move with it.
    document.addEventListener("focusin", read);
    document.addEventListener("focusout", read);
    return () => {
      document.removeEventListener("focusin", read);
      document.removeEventListener("focusout", read);
    };
  }, [phase, captureKeys, enabled]);
  const hintKey = enterHint ? BRICK_I18N_KEYS.screenHint : BRICK_I18N_KEYS.screenHintClick;
  // One id for whichever control surface is on screen, so the frame is
  // announced WITH its controls rather than as a group with nothing in it.
  const helpId = useId();

  return (
    <div
      style={frameStyle}
      role="group"
      aria-label={t(BRICK_I18N_KEYS.consoleLabel)}
      aria-describedby={helpId}
      data-testid={props["data-testid"] ?? "brick-console"}
      data-phase={phase}
      data-game={bag.definition.id}
      ref={setFrame}
      tabIndex={focusKeys || autoFocus ? 0 : undefined}
      onKeyDown={focusKeys ? onKeyDown : undefined}
      onKeyUp={focusKeys ? onKeyUp : undefined}
      data-analytics="none"
      data-analytics-reason="game input, not a product interaction"
    >
      <div style={bodyStyle}>
        <div style={screenWrapStyle}>
          <Panel
            cells={bag.cells}
            cols={bag.definition.cols}
            cell={cell}
            ghostPixels={ghostPixels}
            reducedMotion={reducedMotion}
            label={screenLabel(t, phase, bag.status.score)}
            testId="brick-screen"
          />
          {phase === "paused" && (
            <button
              type="button"
              style={veilStyle}
              data-testid="brick-veil"
              onClick={toggleStart}
              data-analytics="none"
              data-analytics-reason="game input, not a product interaction"
            >
              <span style={valueStyle}>{statusWord}</span>
              <span style={veilHintStyle}>{t(hintKey)}</span>
            </button>
          )}
        </div>
        <aside style={columnStyle} data-testid="brick-panel">
          <Field
            caption={t(BRICK_I18N_KEYS.panelScore)}
            value={String(bag.status.score)}
            testId="brick-score"
          />
          <Field
            caption={t(BRICK_I18N_KEYS.panelHiScore)}
            value={String(Math.max(bag.best, bag.status.score))}
            testId="brick-best"
          />
          <div>
            <div style={captionStyle}>{t(BRICK_I18N_KEYS.panelLevel)}</div>
            <div style={stepperStyle}>
              <button
                type="button"
                style={levelLocked ? stepDisabledStyle : stepStyle}
                disabled={levelLocked}
                data-disabled-reason="a run the person started is under way — the status beside these buttons says so, and changing the level would deal its board away"
                aria-label={t(BRICK_I18N_KEYS.buttonLevelDown)}
                data-testid="brick-level-down"
                onClick={() => {
                  bag.setStartLevel(shownLevel - 1);
                }}
                data-analytics="none"
                data-analytics-reason="game input, not a product interaction"
              >
                <Sign plus={false} />
              </button>
              <span style={valueStyle} data-testid="brick-level">
                {String(shownLevel)}
              </span>
              <button
                type="button"
                style={levelLocked ? stepDisabledStyle : stepStyle}
                disabled={levelLocked}
                data-disabled-reason="a run the person started is under way — the status beside these buttons says so, and changing the level would deal its board away"
                aria-label={t(BRICK_I18N_KEYS.buttonLevelUp)}
                data-testid="brick-level-up"
                onClick={() => {
                  bag.setStartLevel(shownLevel + 1);
                }}
                data-analytics="none"
                data-analytics-reason="game input, not a product interaction"
              >
                <Sign plus />
              </button>
            </div>
          </div>
          {preview && (
            <div>
              <div style={captionStyle}>{t(BRICK_I18N_KEYS.panelNext)}</div>
              <Panel
                cells={preview}
                cols={PREVIEW_SIDE}
                cell={cell}
                ghostPixels={ghostPixels}
                reducedMotion={reducedMotion}
                testId="brick-preview"
              />
            </div>
          )}
          <div style={captionStyle} data-testid="brick-status">
            {recordWord ?? statusWord}
          </div>
          <button
            type="button"
            style={phase === "running" ? buttonStyle : primaryButtonStyle}
            data-testid="brick-button-start"
            onClick={toggleStart}
            data-analytics="none"
            data-analytics-reason="game input, not a product interaction"
          >
            {t(START_LABEL[phase])}
          </button>
          <button
            type="button"
            style={buttonStyle}
            data-testid="brick-button-reset"
            onClick={reset}
            data-analytics="none"
            data-analytics-reason="game input, not a product interaction"
          >
            {t(BRICK_I18N_KEYS.buttonReset)}
          </button>
        </aside>
      </div>

      {games.length > 1 && (
        <div style={menuStyle} role="group" aria-label={t(BRICK_I18N_KEYS.menuLabel)}>
          {games.map((id) => {
            const definition = findGame(id);
            if (!definition) return null;
            return (
              <button
                key={id}
                type="button"
                data-testid={`brick-menu-${id}`}
                aria-pressed={id === game}
                style={id === game ? chipActiveStyle : chipStyle}
                onClick={() => {
                  choose(id);
                }}
                data-analytics="none"
                data-analytics-reason="game input, not a product interaction"
              >
                {t(definition.labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {coarse ? (
        <Keypad
          id={helpId}
          onPress={press}
          onHold={hold}
          onStart={toggleStart}
          onReset={reset}
          t={t}
        />
      ) : (
        <Legend id={helpId} definition={bag.definition} t={t} />
      )}
    </div>
  );
}

/** Every game id, for a host building its own menu. */
export const BRICK_CONSOLE_GAMES: readonly BrickGameId[] = BRICK_GAME_IDS;
