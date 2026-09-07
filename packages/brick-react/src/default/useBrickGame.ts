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
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrickSession } from "../headless/session.js";
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

export interface UseBrickGameOptions {
  readonly game: BrickGameId;
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
}

/** The store is created lazily and once, not per console. */
let sharedStore: HighScoreStore | null = null;
function defaultStore(): HighScoreStore {
  sharedStore ??= createHighScoreStore();
  return sharedStore;
}

export function useBrickGame(options: UseBrickGameOptions): BrickGameBag {
  const { game, seed, highScores, onGameOver, autoStart } = options;
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

  // One session per game. A change of `game` throws the old board away, which
  // is the only sane reading of "show me a different game".
  useEffect(() => {
    let live = true;
    const session = createBrickSession({
      definition,
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
  }, [definition, seed, store, autoStart]);

  const pause = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    // A key released while the tab was away never sends its keyup here.
    session.releaseAll();
    if (!session.running) return;
    session.stop();
    setPhase("paused");
  }, []);

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
  }, [paused]);

  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    awayRef.current = false;
    session.reset();
    setCells(session.grid.cells.slice());
    setStatus(session.status());
    setIsRecord(false);
    setPhase("ready");
  }, []);

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
      session.releaseAll();
      session.stop();
      setPhase("paused");
      return;
    }
    session.start();
    setPhase(session.running ? "running" : "ready");
  }, []);

  const press = useCallback((action: BrickInput) => {
    const session = sessionRef.current;
    if (session?.running) session.press(action);
  }, []);

  const hold = useCallback((action: BrickInput, isHeld: boolean) => {
    sessionRef.current?.hold(action, isHeld);
  }, []);

  return {
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
  };
}
