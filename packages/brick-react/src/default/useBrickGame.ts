/**
 * The console's state, without any of its markup. One session, one phase, one
 * mirrored frame — and the two rules that make a game embedded in a waiting
 * screen behave itself:
 *
 *  - IT PAUSES WHEN NOBODY IS LOOKING. Tab hidden or window blurred, the loop
 *    stops. A game that keeps running behind a hidden tab burns battery to
 *    lose on the player's behalf, and comes back to a board they never saw.
 *  - IT NEVER RESUMES BY ITSELF. Coming back to a paused board is a person's
 *    decision; coming back to a piece already three rows down is a bug report.
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
  /** Queue a button press. */
  readonly press: (action: BrickInput) => void;
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
    if (!session || !session.running) return;
    session.stop();
    setPhase("paused");
  }, []);

  // Nobody is looking → nothing is running (see the file header).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHide = (): void => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        return;
      }
      pause();
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pause]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (paused) {
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
    session.reset();
    setCells(session.grid.cells.slice());
    setStatus(session.status());
    setIsRecord(false);
    setPhase("ready");
  }, []);

  const toggleStart = useCallback(() => {
    const session = sessionRef.current;
    if (!session || pausedRef.current) return;
    if (session.status().over) {
      session.reset();
      setIsRecord(false);
      setCells(session.grid.cells.slice());
      setStatus(session.status());
    }
    if (session.running) {
      session.stop();
      setPhase("paused");
      return;
    }
    session.start();
    setPhase(session.running ? "running" : "ready");
  }, []);

  const press = useCallback((action: BrickInput) => {
    sessionRef.current?.press(action);
  }, []);

  return {
    definition,
    cells,
    status,
    phase,
    best,
    isRecord,
    press,
    toggleStart,
    reset,
    pause,
  };
}
