/**
 * `<BrickConsole/>` — the whole handheld: a 4-bit LCD, the side panel, the
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
 * ── Reduced motion ─────────────────────────────────────────────────────────
 * `prefers-reduced-motion` removes the cell transition, so a moving piece
 * snaps rather than fades. The GAME still runs: the request is about
 * decoration, and a person who asked for less movement did not ask to be
 * denied the thing they are looking at.
 *
 * ── Keys ───────────────────────────────────────────────────────────────────
 * By default the frame is focusable and reads keys only while focus is inside
 * it (`captureKeys="focus"`). `"global"` reads the window instead, for a
 * console that must play without ever being focused. In both modes a key
 * whose target is editable, or a Space/Enter on a focused button, stays with
 * that target; a handler that already called `preventDefault()` keeps the
 * key; and `enabled={false}` detaches everything.
 */
import { useCallback, useEffect, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";
import { BRICK_GAME_IDS, findGame } from "../headless/games/index.js";
import { BRICK_I18N_KEYS } from "../i18n/keys.js";
import { Keypad } from "./Keypad.js";
import { useBrickGame } from "./useBrickGame.js";
import type { BrickPhase } from "./useBrickGame.js";
import { useBrickT, useCoarsePointer, useReducedMotion } from "./hooks.js";
import type { BrickTranslate } from "./hooks.js";
import type { HighScoreStore } from "../headless/highscores.js";
import type { BrickGameId, BrickInput, CellLevel } from "../headless/types.js";

/** How big one LCD pixel is, per size. */
const CELL_PX: Record<BrickConsoleSize, number> = { sm: 7, md: 11, lg: 15 };
/** The gap between pixels — a real LCD has one, and it is what makes it read
 * as pixels rather than as a bitmap. */
const CELL_GAP_PX = 1;
/** The preview box in the side panel is always 4x4. */
const PREVIEW_SIDE = 4;

export type BrickConsoleSize = "sm" | "md" | "lg";
/** An explicit pixel size, or `"auto"`: `sm` on a coarse pointer, `md` otherwise. */
export type BrickConsoleSizeChoice = BrickConsoleSize | "auto";

/** Where the console reads the keyboard from. */
export type BrickKeyCapture = "focus" | "global";

/** Off, ghost, shadow, lit — the four levels of the panel. */
const LEVEL_COLOR: readonly string[] = [
  cssVar("border-subtle"),
  cssVar("text-subtle"),
  cssVar("text-muted"),
  cssVar("text"),
];

const frameStyle: CSSProperties = {
  display: "inline-block",
  padding: spacing[4],
  borderRadius: radii.lg,
  background: cssVar("surface-raised"),
  border: `1px solid ${cssVar("border")}`,
  color: cssVar("text"),
};

const bodyStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: spacing[4],
};

const panelStyle: CSSProperties = {
  display: "grid",
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

const menuStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing[2],
  paddingBlockStart: spacing[4],
};

const menuButtonStyle: CSSProperties = {
  border: `1px solid ${cssVar("border")}`,
  borderRadius: radii.full,
  background: cssVar("surface"),
  color: cssVar("text-muted"),
  paddingBlock: spacing[1],
  paddingInline: spacing[3],
  cursor: "pointer",
};

const menuButtonActiveStyle: CSSProperties = {
  ...menuButtonStyle,
  background: cssVar("brand-subtle"),
  color: cssVar("brand"),
  borderColor: cssVar("brand"),
};

/** One field of the side panel. */
function PanelField(props: {
  readonly caption: string;
  readonly value: string;
}): ReactElement {
  return (
    <div>
      <div style={captionStyle}>{props.caption}</div>
      <div style={valueStyle}>{props.value}</div>
    </div>
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

export interface BrickConsoleProps {
  /** Which game to play. Default: the first of `games`, else Tetris. */
  readonly game?: BrickGameId;
  /**
   * The games this console offers. More than one draws a menu above the
   * keypad; one (or none) draws no menu at all — a picker with a single choice
   * is furniture.
   */
  readonly games?: readonly BrickGameId[];
  /** The LCD pixel size. Default `"auto"` — `sm` on a coarse pointer, `md` otherwise. */
  readonly size?: BrickConsoleSizeChoice;
  /** Pin the deal, for a demo or a test. */
  readonly seed?: number;
  /** Start playing on mount. Default false — a waiting screen should not
   * ambush someone with a falling piece. */
  readonly autoStart?: boolean;
  /** Keep the faint unlit-segment ghost of a real LCD. Default true. */
  readonly ghostPixels?: boolean;
  /** Fired once per run, with the final score and the game it was scored in. */
  readonly onGameOver?: (score: number, game: BrickGameId) => void;
  /** Called when the person picks a different game from the menu. */
  readonly onGameChange?: (game: BrickGameId) => void;
  /** Injected in tests; by default the local `brick-highscores` repository. */
  readonly highScores?: HighScoreStore;
  /**
   * Read the keyboard at all. Default true; `false` detaches every key
   * handler, so a host can hand the keys to something else while the game
   * stays on screen.
   */
  readonly enabled?: boolean;
  /**
   * `"focus"` (default): the frame is focusable and reads keys only while
   * focus is inside it. `"global"`: the window, so the console plays without
   * ever being focused — an editable target still keeps its keys.
   */
  readonly captureKeys?: BrickKeyCapture;
  /**
   * Hold the loop: the tick stops, the board stays. Clearing it resumes only a
   * run this prop paused; a board the person paused stays paused.
   */
  readonly paused?: boolean;
  readonly "data-testid"?: string;
}

/** Keys the console owns while it is mounted. */
const KEY_ACTIONS: Record<string, BrickInput> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  " ": "ok",
};

/** A target whose keystrokes are its own — never the game's. */
const EDITABLE = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
/** A target that acts on Space and Enter itself. */
const ACTIVATABLE = "button,a[href],[role=button]";

/** The shape shared by a DOM `KeyboardEvent` and React's synthetic one. */
interface KeyEventLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: EventTarget | null;
  preventDefault(): void;
}

function targetKeepsKey(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(EDITABLE) !== null) return true;
  return (key === " " || key === "Enter") && target.closest(ACTIVATABLE) !== null;
}

/** The word for a phase, or null while the game is simply being played. */
function statusKey(phase: BrickPhase): string | null {
  if (phase === "over") return BRICK_I18N_KEYS.statusOver;
  if (phase === "paused") return BRICK_I18N_KEYS.statusPaused;
  if (phase === "ready") return BRICK_I18N_KEYS.statusReady;
  return null;
}

/** What a screen reader is told the panel is showing. */
function screenLabel(t: BrickTranslate, phase: BrickPhase, score: number): string {
  const name = t(BRICK_I18N_KEYS.screenLabel);
  const word = statusKey(phase);
  return word === null ? `${name}: ${String(score)}` : `${name}: ${t(word)}`;
}

export function BrickConsole(props: BrickConsoleProps): ReactElement {
  const games = props.games ?? [];
  const fallback = games[0] ?? "tetris";
  const game = props.game ?? fallback;
  const ghostPixels = props.ghostPixels ?? true;
  const enabled = props.enabled ?? true;
  const captureKeys = props.captureKeys ?? "focus";
  const coarse = useCoarsePointer();
  const sizeChoice = props.size ?? "auto";
  const size: BrickConsoleSize =
    sizeChoice === "auto" ? (coarse ? "sm" : "md") : sizeChoice;
  const reducedMotion = useReducedMotion();
  const t = useBrickT();

  const bag = useBrickGame({
    game,
    ...(props.seed === undefined ? {} : { seed: props.seed }),
    ...(props.highScores === undefined ? {} : { highScores: props.highScores }),
    ...(props.onGameOver === undefined ? {} : { onGameOver: props.onGameOver }),
    ...(props.autoStart === undefined ? {} : { autoStart: props.autoStart }),
    ...(props.paused === undefined ? {} : { paused: props.paused }),
  });
  const { press, toggleStart, reset } = bag;

  // One handler for both modes. A key already claimed by someone else, or
  // aimed at a target that acts on it, is not the game's to take.
  const onKeyDown = useCallback(
    (event: KeyEventLike): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (targetKeepsKey(event.target, event.key)) return;
      const action = KEY_ACTIONS[event.key];
      if (action) {
        event.preventDefault();
        press(action);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        toggleStart();
        return;
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        reset();
      }
    },
    [press, toggleStart, reset]
  );

  const focusKeys = enabled && captureKeys === "focus";
  const globalKeys = enabled && captureKeys === "global";

  useEffect(() => {
    if (!globalKeys || typeof window === "undefined") return;
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [globalKeys, onKeyDown]);

  const cell = CELL_PX[size];
  const preview = bag.status.next;
  const phase = bag.phase;
  const phaseKey = statusKey(phase);
  const statusWord = phaseKey === null ? "" : t(phaseKey);

  return (
    <div
      style={frameStyle}
      role="group"
      aria-label={t(BRICK_I18N_KEYS.consoleLabel)}
      data-testid={props["data-testid"] ?? "brick-console"}
      data-phase={phase}
      data-game={bag.definition.id}
      tabIndex={focusKeys ? 0 : undefined}
      onKeyDown={focusKeys ? onKeyDown : undefined}
      data-analytics="none"
      data-analytics-reason="game input, not a product interaction"
    >
      <div style={bodyStyle}>
        <Panel
          cells={bag.cells}
          cols={bag.definition.cols}
          cell={cell}
          ghostPixels={ghostPixels}
          reducedMotion={reducedMotion}
          label={screenLabel(t, phase, bag.status.score)}
          testId="brick-screen"
        />
        <aside style={panelStyle} data-testid="brick-panel">
          <PanelField
            caption={t(BRICK_I18N_KEYS.panelScore)}
            value={String(bag.status.score)}
          />
          <PanelField
            caption={t(BRICK_I18N_KEYS.panelHiScore)}
            value={String(Math.max(bag.best, bag.status.score))}
          />
          <PanelField
            caption={t(BRICK_I18N_KEYS.panelLevel)}
            value={String(bag.status.level)}
          />
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
            {phase === "over" && bag.isRecord
              ? t(BRICK_I18N_KEYS.statusRecord)
              : statusWord}
          </div>
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
                data-analytics="none"
                data-analytics-reason="game choice inside a waiting screen, not a product interaction"
                style={id === game ? menuButtonActiveStyle : menuButtonStyle}
                onClick={() => {
                  props.onGameChange?.(id);
                }}
              >
                {t(definition.labelKey)}
              </button>
            );
          })}
        </div>
      )}

      {coarse && (
        <Keypad onPress={press} onStart={toggleStart} onReset={reset} t={t} />
      )}
    </div>
  );
}

/** Every game id, for a host building its own menu. */
export const BRICK_CONSOLE_GAMES: readonly BrickGameId[] = BRICK_GAME_IDS;
