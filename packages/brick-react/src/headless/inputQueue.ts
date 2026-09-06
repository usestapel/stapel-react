/**
 * The input queue. A key press and a simulation step happen on different
 * clocks: a person can tap left twice between two ticks of Tetris, and a game
 * that reads "the current direction" instead of a queue silently eats the
 * second tap. So presses are BUFFERED and drained by the tick, in order.
 *
 * The buffer is bounded. A held arrow key auto-repeats at ~30/s; without a cap
 * a backgrounded tab would hand the next tick two hundred moves and the piece
 * would teleport into a wall the moment the tab came back.
 */
import type { BrickInput } from "./types.js";

export interface InputQueue {
  push(action: BrickInput): void;
  /** Take everything queued, oldest first, and empty the queue. */
  drain(): BrickInput[];
  clear(): void;
  readonly size: number;
}

/** How many presses one tick may inherit. Four is two full direction changes. */
export const INPUT_QUEUE_LIMIT = 4;

export function createInputQueue(limit: number = INPUT_QUEUE_LIMIT): InputQueue {
  let items: BrickInput[] = [];
  return {
    push(action) {
      // Drop the OLDEST when full: the newest press is the one the person is
      // still expecting to see happen.
      if (items.length >= limit) items.shift();
      items.push(action);
    },
    drain() {
      const out = items;
      items = [];
      return out;
    },
    clear() {
      items = [];
    },
    get size() {
      return items.length;
    },
  };
}
