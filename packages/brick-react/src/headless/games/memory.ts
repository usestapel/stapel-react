/**
 * Memory — the handheld's pattern game, and not a grid of tiles.
 *
 * FOUR 2x2 squares, laid out as a d-pad: one above, one below, one either side.
 * The console lights them in a sequence — a lit pad CHANGES SHAPE, growing from
 * a 2x2 square to a 4x4 one, because a pad that only got brighter is invisible
 * on a panel whose "off" pixels already glow — and then hands the turn over. The
 * player repeats what they saw with the matching arrow. Get it right and the
 * sequence is replayed one longer; get it wrong and the run is over.
 *
 * The sequence is drawn fresh every game (and extended, never regenerated, so
 * what you learned in round three is still true in round four), and the
 * starting level is how many blinks the first round has.
 */
import { fillRect } from "../grid.js";
import type {
  BrickInput,
  Game,
  GameContext,
  GameDefinition,
  GameStatus,
  MutableGrid,
} from "../types.js";

/** The four pads, in d-pad order, with the button each answers to. */
const PADS: readonly { readonly input: BrickInput; readonly x: number; readonly y: number }[] = [
  { input: "up", x: 5, y: 1 },
  { input: "left", x: 1, y: 5 },
  { input: "right", x: 9, y: 5 },
  { input: "down", x: 5, y: 9 },
];

/** A pad at rest is 2x2; lit, it grows to 4x4 — the shape change is the signal. */
const PAD_SIZE = 2;
const PAD_GROWN = 4;

/** Ticks a pad stays lit, and the dark gap between two of them. */
const SHOW_ON = 3;
const SHOW_OFF = 2;

const ROUND_SCORE = 20;
const ROUNDS_PER_LEVEL = 3;

function createMemory(ctx: GameContext): Game {
  const sequence: number[] = [];
  /** -1 is the pause before the sequence starts, and between two rounds. */
  let showIndex = -1;
  let timer = 0;
  let lit = false;
  let listening = false;
  let answer = 0;
  /** The pad the player just pressed, echoed for a couple of ticks. */
  let echo = -1;
  let echoTicks = 0;
  let rounds = 0;
  let score = 0;
  let over = false;

  function extend(): void {
    sequence.push(Math.floor(ctx.random() * PADS.length) % PADS.length);
  }

  function replay(): void {
    showIndex = -1;
    timer = 0;
    lit = false;
    listening = false;
    answer = 0;
  }

  for (let i = 0; i < ctx.startLevel; i += 1) extend();

  return {
    tick() {
      if (over) return;
      if (echoTicks > 0 && --echoTicks === 0) echo = -1;
      if (listening) return;
      timer += 1;
      if (lit) {
        if (timer < SHOW_ON) return;
        lit = false;
        timer = 0;
        return;
      }
      if (timer < SHOW_OFF) return;
      timer = 0;
      showIndex += 1;
      if (showIndex >= sequence.length) {
        showIndex = -1;
        listening = true;
        return;
      }
      lit = true;
    },
    input(action: BrickInput) {
      if (over || !listening) return;
      const pad = PADS.findIndex((candidate) => candidate.input === action);
      if (pad < 0) return;
      echo = pad;
      echoTicks = 2;
      if (sequence[answer] !== pad) {
        over = true;
        return;
      }
      answer += 1;
      if (answer < sequence.length) return;
      rounds += 1;
      score += ROUND_SCORE * sequence.length;
      extend();
      replay();
    },
    render(grid: MutableGrid) {
      const showing = lit ? sequence[showIndex] : undefined;
      for (let i = 0; i < PADS.length; i += 1) {
        const pad = PADS[i];
        if (!pad) continue;
        if (showing === i) {
          fillRect(grid, pad.x - 1, pad.y - 1, PAD_GROWN, PAD_GROWN, 3);
        } else if (echo === i) {
          fillRect(grid, pad.x - 1, pad.y - 1, PAD_GROWN, PAD_GROWN, 2);
        } else {
          fillRect(grid, pad.x, pad.y, PAD_SIZE, PAD_SIZE, 1);
        }
      }
      // The middle square is the turn indicator: it is on while the console is
      // waiting for the player, and dark while it is doing the showing.
      if (listening) {
        fillRect(grid, Math.floor(grid.cols / 2) - 1, Math.floor(grid.rows / 2) - 1, PAD_SIZE, PAD_SIZE, 2);
      }
    },
    status(): GameStatus {
      return {
        score,
        level: ctx.startLevel + Math.floor(rounds / ROUNDS_PER_LEVEL),
        cleared: rounds,
        over,
        next: null,
      };
    },
  };
}

export const MEMORY: GameDefinition = {
  id: "memory",
  // Twelve by twelve: four 2x2 pads at arm's length from each other, and room
  // for each of them to double in size without touching its neighbour.
  cols: 12,
  rows: 12,
  stepMs: 180,
  labelKey: "brick.game.memory",
  controls: [
    { inputs: ["up", "left", "right", "down"], labelKey: "brick.key.pads" },
  ],
  // A pad is tapped, never held: repeating it would answer the same pad twice.
  repeat: [],
  // The one game whose level is not a dial. Here the level IS the sequence: it
  // is how many blinks the first round had, and the sequence in front of the
  // player was dealt at that length and has grown by one a round since. Moving
  // the number mid-run would either lie about what is on the pads or re-deal the
  // very thing being remembered, so the stepper says so and waits for the run.
  levelLockedMidRun:
    "in this game the level IS the sequence being remembered — it was dealt at that length and grows a step a round, so it cannot move under a run; the level for the next run is picked from Start",
  completeness: "full",
  create: createMemory,
};
