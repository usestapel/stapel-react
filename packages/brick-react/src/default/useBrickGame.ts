/**
 * The console's state, without any of its markup. One session, one phase, one
 * mirrored frame — and the two rules that make a game embedded in a waiting
 * screen behave itself:
 *
 *  - IT PAUSES WHEN NOBODY IS LOOKING. Tab hidden or window blurred, the loop
 *    stops. A game that keeps running behind a hidden tab burns battery to
 *    lose on the player's behalf, and comes back to a board they never saw.
 *  - IT COMES BACK WITH THE PERSON (`resumeOnReturn`, default true). A run
 *    that the blur or the hidden tab stopped starts again on focus or on the
 *    tab becoming visible; a board the person paused stays paused, and so
 *    does one the host holds. The loop forgives the time away, so the piece
 *    is where they left it.
 *
 * The host can hold the loop too (`paused`): the tick stops and the board
 * stays. Clearing the hold resumes only a run the hold itself stopped — a
 * board the person paused is theirs to resume.
 *
 * ── A level change never costs a game ──────────────────────────────────────
 * `setStartLevel` reads the board it is asked on. A run in progress — the whole
 * of it is `!over && (running || played)` — moves to that level, tempo and
 * multiplier with it, and the board, the piece and the score stay. `running`
 * counts on its own, so an `autoStart` console is in progress from its first
 * frame and its board is moved, not re-dealt, whether or not anyone has touched
 * it. The other arm — a fresh board at the new level, exactly as before — is
 * reached only by a run that is `over` or a stopped board that has taken no
 * tick and no press. Through 0.5.0 there was only the second behaviour,
 * so a plus pressed four hundred points into a run silently threw the run
 * away; a game whose rules make a mid-run level meaningless says so
 * (`levelLockedMidRun`) and is left alone rather than re-dealt.
 *
 * ── The repeat is ours, not the operating system's ─────────────────────────
 * A held arrow does not reach a page as a stream of presses: the OS waits
 * around half a second and only then starts echoing. That pause is what makes
 * a paddle feel like it "reacts with a big delay", and no amount of animation
 * work fixes it, because the second press genuinely has not happened yet. So
 * the console runs its own repeat off the HOLD — first echo after
 * {@link BRICK_REPEAT_DELAY_MS}, then one every {@link BRICK_REPEAT_RATE_MS} —
 * and ignores the OS's, for exactly the buttons each game names in `repeat`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clampLevel, createBrickSession } from "../headless/session.js";
import { createHighScoreStore } from "../headless/highscores.js";
import { findGame, TETRIS } from "../headless/games/index.js";
import type { BrickSession } from "../headless/session.js";
import type { HighScoreStore } from "../headless/highscores.js";
import type {
  BrickGameId,
  BrickInput,
  CellLevel,
  GameDefinition,
  GameStatus,
} from "../headless/types.js";

/** What the screen is doing right now. */
export type BrickPhase = "ready" | "running" | "paused" | "over";

/** How long a held button waits before the console repeats it. */
export const BRICK_REPEAT_DELAY_MS = 130;
/** And how often it repeats after that. */
export const BRICK_REPEAT_RATE_MS = 55;

export interface UseBrickGameOptions {
  readonly game: BrickGameId;
  /** The level a run starts at. The console owns this; a host may seed it. */
  readonly startLevel?: number;
  /** Same seed, same deal — a demo and a test both pin it. */
  readonly seed?: number;
  /** Injected for tests and for a host that keeps scores elsewhere. */
  readonly highScores?: HighScoreStore;
  /** Fired once per run, with the final score. */
  readonly onGameOver?: (score: number, game: BrickGameId) => void;
  /** Start the loop as soon as the game is mounted. Default: false. */
  readonly autoStart?: boolean;
  /**
   * Hold the loop from outside. The tick stops, the board and score stay,
   * and Start does nothing until the hold clears. Clearing it resumes only a
   * run this option stopped. Default: false.
   */
  readonly paused?: boolean;
  /**
   * Start again on focus / visible a run that a blur or a hidden tab stopped.
   * Default true. A board the person paused is never resumed by this.
   */
  readonly resumeOnReturn?: boolean;
  /**
   * Every phase the console moves through, reported once per change and once on
   * mount. A host that needs to know a run is under way should be told, not left
   * to read `data-phase` off the DOM.
   */
  readonly onPhaseChange?: (phase: BrickPhase) => void;
}

export interface BrickGameBag {
  readonly definition: GameDefinition;
  /** The current frame, `cells[y * cols + x]`. */
  readonly cells: readonly CellLevel[];
  readonly status: GameStatus;
  readonly phase: BrickPhase;
  /** The stored best for this game; 0 until the store answers. */
  readonly best: number;
  /** True when the run that just ended beat the stored best. */
  readonly isRecord: boolean;
  /** Apply a button press to a running game; ignored while it is not running. */
  readonly press: (action: BrickInput) => void;
  /** A button went down or came up (a soft drop, a held direction). */
  readonly hold: (action: BrickInput, held: boolean) => void;
  /** Start, pause, resume, or replay — whichever the phase calls for. */
  readonly toggleStart: () => void;
  /** Back to a fresh board, stopped. */
  readonly reset: () => void;
  /** Stop the loop without changing the board. */
  readonly pause: () => void;
  /** The level a fresh deal starts at — the number the stepper last left. */
  readonly startLevel: number;
  /**
   * Pick a level. On a run IN PROGRESS — `!over && (running || played)`, and
   * `running` counts on its own, so an `autoStart` console qualifies from its
   * first frame — it moves the run: the tempo and the multiplier become the new
   * level's and the board, the piece and the score stay. Only the rest — a run
   * that is `over`, or a stopped board that has taken no tick and no press —
   * gets a fresh board dealt at the level asked for. Nothing here ever discards
   * a game.
   *
   * A game whose rules say the level cannot move mid-run
   * ({@link levelLockReason}) ignores this while its run is under way — it does
   * not re-deal either, because a call that cannot be honoured must not cost
   * the person their board.
   */
  readonly setStartLevel: (level: number) => void;
  /**
   * Why the level cannot be picked right now, or `null` when it can. Only a
   * game that declared `levelLockedMidRun` ever answers with a sentence, and
   * only while a run of it is under way; the console renders it as the
   * stepper's `data-disabled-reason`.
   */
  readonly levelLockReason: string | null;
}

/** The store is created lazily and once, not per console. */
let sharedStore: HighScoreStore | null = null;
function defaultStore(): HighScoreStore {
  sharedStore ??= createHighScoreStore();
  return sharedStore;
}

export function useBrickGame(options: UseBrickGameOptions): BrickGameBag {
  const { game, seed, highScores, onGameOver, autoStart } = options;
  const [startLevel, setLevel] = useState(() => clampLevel(options.startLevel ?? 1));
  // The level is NOT a dependency of the session: a change to it either moves
  // the live run or asks for a new deal, and asking is this counter going up.
  // (Through 0.5.0 it was a dependency, so a plus pressed 400 points into a run
  // re-mounted the session and the run was gone.)
  const levelRef = useRef(startLevel);
  const [deal, setDeal] = useState(0);
  const paused = options.paused ?? false;
  const resumeOnReturn = options.resumeOnReturn ?? true;
  // An unknown id falls back to Tetris rather than throwing: this component's
  // job is to fill a wait, and taking down the page it was embedded in over a
  // typo in a prop would be the one failure worse than a boring wait.
  const definition = findGame(game) ?? TETRIS;

  const store = highScores ?? defaultStore();
  const sessionRef = useRef<BrickSession | null>(null);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  /** True while the `paused` option, not the person, is what stopped the loop. */
  const heldRef = useRef(false);
  const resumeRef = useRef(resumeOnReturn);
  resumeRef.current = resumeOnReturn;
  /** True while a blur or a hidden tab, not the person, is what stopped the loop. */
  const awayRef = useRef(false);

  const [cells, setCells] = useState<readonly CellLevel[]>([]);
  const [status, setStatus] = useState<GameStatus>({
    score: 0,
    level: 1,
    cleared: 0,
    over: false,
    next: null,
  });
  const [phase, setPhase] = useState<BrickPhase>("ready");
  const [best, setBest] = useState(0);
  const [isRecord, setIsRecord] = useState(false);

  /** The timers behind the console's own key repeat, one entry per held button. */
  const repeats = useRef(new Map<BrickInput, number[]>());
  const stopRepeat = useCallback((action: BrickInput) => {
    const handles = repeats.current.get(action);
    if (!handles) return;
    repeats.current.delete(action);
    for (const handle of handles) {
      clearTimeout(handle);
      clearInterval(handle);
    }
  }, []);
  const stopEveryRepeat = useCallback(() => {
    for (const action of [...repeats.current.keys()]) stopRepeat(action);
  }, [stopRepeat]);

  // One session per game. A change of `game` throws the old board away, which
  // is the only sane reading of "show me a different game".
  useEffect(() => {
    let live = true;
    const session = createBrickSession({
      definition,
      startLevel: levelRef.current,
      ...(seed === undefined ? {} : { seed }),
      onFrame: (grid, next) => {
        if (!live) return;
        setCells(grid.cells.slice());
        setStatus(next);
      },
      onGameOver: (final) => {
        if (!live) return;
        setPhase("over");
        overRef.current?.(final.score, definition.id);
        void store.record(definition.id, final.score).then((record) => {
          if (!live) return;
          setIsRecord(record);
          if (record) setBest(final.score);
        });
      },
    });
    sessionRef.current = session;
    setCells(session.grid.cells.slice());
    setStatus(session.status());
    setPhase("ready");
    setIsRecord(false);
    void store.get(definition.id).then((value) => {
      if (live) setBest(value);
    });
    if (autoStart && pausedRef.current) {
      heldRef.current = true;
      setPhase("paused");
    } else if (autoStart) {
      session.start();
      setPhase("running");
    }
    return () => {
      live = false;
      session.stop();
      sessionRef.current = null;
    };
  }, [definition, seed, deal, store, autoStart]);

  // Nothing may outlive the component: a repeat still ticking after unmount
  // would press buttons on a session that is gone.
  useEffect(() => stopEveryRepeat, [stopEveryRepeat]);

  // The phase, published. Once per CHANGE — a host that re-renders is not a
  // host whose game moved.
  const phaseReportRef = useRef(options.onPhaseChange);
  phaseReportRef.current = options.onPhaseChange;
  const reportedRef = useRef<BrickPhase | null>(null);
  useEffect(() => {
    if (reportedRef.current === phase) return;
    reportedRef.current = phase;
    phaseReportRef.current?.(phase);
  }, [phase]);

  const pause = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    // A key released while the tab was away never sends its keyup here.
    stopEveryRepeat();
    session.releaseAll();
    if (!session.running) return;
    session.stop();
    setPhase("paused");
  }, [stopEveryRepeat]);

  // Nobody is looking → nothing is running; they are back → it runs again
  // (see the file header).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const away = (): void => {
      if (sessionRef.current?.running) awayRef.current = true;
      pause();
    };
    const back = (): void => {
      const session = sessionRef.current;
      if (!awayRef.current || !session || document.visibilityState !== "visible") return;
      awayRef.current = false;
      if (!resumeRef.current || pausedRef.current || session.status().over) return;
      session.start();
      setPhase(session.running ? "running" : "ready");
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") back();
      else away();
    };
    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", away);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pause]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (paused) {
      stopEveryRepeat();
      session.releaseAll();
      if (!session.running) return;
      session.stop();
      heldRef.current = true;
      setPhase("paused");
      return;
    }
    if (!heldRef.current) return;
    heldRef.current = false;
    if (session.status().over) return;
    session.start();
    setPhase(session.running ? "running" : "ready");
  }, [paused, stopEveryRepeat]);

  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    awayRef.current = false;
    stopEveryRepeat();
    session.reset();
    setCells(session.grid.cells.slice());
    setStatus(session.status());
    setIsRecord(false);
    setPhase("ready");
  }, [stopEveryRepeat]);

  const toggleStart = useCallback(() => {
    const session = sessionRef.current;
    if (!session || pausedRef.current) return;
    awayRef.current = false;
    if (session.status().over) {
      session.reset();
      setIsRecord(false);
      setCells(session.grid.cells.slice());
      setStatus(session.status());
    }
    if (session.running) {
      stopEveryRepeat();
      session.releaseAll();
      session.stop();
      setPhase("paused");
      return;
    }
    session.start();
    setPhase(session.running ? "running" : "ready");
  }, [stopEveryRepeat]);

  const press = useCallback((action: BrickInput) => {
    const session = sessionRef.current;
    if (session?.running) session.press(action);
  }, []);

  const hold = useCallback(
    (action: BrickInput, isHeld: boolean) => {
      sessionRef.current?.hold(action, isHeld);
      stopRepeat(action);
      if (!isHeld || !definition.repeat?.includes(action)) return;
      if (typeof window === "undefined") return;
      const handles: number[] = [];
      handles.push(
        window.setTimeout(() => {
          handles.push(
            window.setInterval(() => {
              const session = sessionRef.current;
              if (session?.running) session.press(action);
            }, BRICK_REPEAT_RATE_MS)
          );
        }, BRICK_REPEAT_DELAY_MS)
      );
      repeats.current.set(action, handles);
    },
    [definition, stopRepeat]
  );

  const setStartLevel = useCallback(
    (next: number) => {
      stopEveryRepeat();
      const session = sessionRef.current;
      // A run is IN PROGRESS when the loop is running, or when it is stopped on
      // a board somebody has already played — the pause a person took is still
      // their game. Anything else (a fresh deal, a finished one) is a board
      // there is nothing to lose in dealing again.
      const inProgress =
        session !== null && !session.status().over && (session.running || session.played);
      if (inProgress && definition.levelLockedMidRun !== undefined) return;
      const level = clampLevel(next);
      levelRef.current = level;
      setLevel(level);
      if (inProgress) {
        session.setLevel(level);
        return;
      }
      setDeal((n) => n + 1);
    },
    [definition, stopEveryRepeat]
  );

  const levelLockReason =
    definition.levelLockedMidRun !== undefined && (phase === "running" || phase === "paused")
      ? definition.levelLockedMidRun
      : null;

  return {
    levelLockReason,
    definition,
    cells,
    status,
    phase,
    best,
    isRecord,
    press,
    hold,
    toggleStart,
    reset,
    pause,
    startLevel,
    setStartLevel,
  };
}
