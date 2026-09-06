/**
 * Racing — MINIMAL but playable. Four lanes, a three-wide car, oncoming traffic
 * that scrolls down, a point for every car survived, a level every ten, and a
 * game over on contact. The road edge is drawn as a dashed stripe that moves
 * with the traffic, because a static road makes a moving car look parked.
 *
 * What "minimal" means: no acceleration (the level IS the speed), no lane
 * change animation, one car shape, no crash sequence.
 */
import { fillRect, setCell } from "../grid.js";
import type {
  BrickInput,
  Game,
  GameContext,
  GameDefinition,
  GameStatus,
  MutableGrid,
} from "../types.js";

const LANES = 4;
const CAR_WIDTH = 3;
const CAR_HEIGHT = 3;
/** Ticks between two spawns, before the level speeds things up. */
const SPAWN_EVERY = 6;
const PASS_SCORE = 5;
const PASSES_PER_LEVEL = 10;

interface Traffic {
  readonly lane: number;
  y: number;
}

function createRacing(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;
  /** Lane width including the edge stripes the road keeps for itself. */
  const laneWidth = Math.floor((cols - 2) / LANES);
  const laneX = (lane: number): number =>
    1 + lane * laneWidth + Math.floor((laneWidth - CAR_WIDTH) / 2);

  const playerY = rows - CAR_HEIGHT;
  let playerLane = 1;
  let traffic: Traffic[] = [];
  let ticks = 0;
  let passed = 0;
  let score = 0;
  let over = false;

  function level(): number {
    return Math.floor(passed / PASSES_PER_LEVEL) + 1;
  }

  function overlaps(car: Traffic): boolean {
    if (car.lane !== playerLane) return false;
    return car.y + CAR_HEIGHT > playerY && car.y < playerY + CAR_HEIGHT;
  }

  return {
    tick() {
      if (over) return;
      ticks += 1;
      for (const car of traffic) car.y += 1;
      const survived = traffic.filter((car) => car.y < rows);
      passed += traffic.length - survived.length;
      score += (traffic.length - survived.length) * PASS_SCORE;
      traffic = survived;

      const spawnEvery = Math.max(3, SPAWN_EVERY - level());
      if (ticks % spawnEvery === 0) {
        const lane = Math.min(LANES - 1, Math.floor(ctx.random() * LANES));
        // Never spawn a car directly on top of one already at the top of the
        // screen: two stacked cars close a lane that cannot be left in time.
        const blocked = traffic.some((car) => car.lane === lane && car.y < CAR_HEIGHT * 2);
        if (!blocked) traffic.push({ lane, y: -CAR_HEIGHT });
      }
      if (traffic.some(overlaps)) over = true;
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "left") playerLane = Math.max(0, playerLane - 1);
      else if (action === "right") playerLane = Math.min(LANES - 1, playerLane + 1);
      else if (action === "down" || action === "ok") {
        // The only "accelerate" a fixed-step game can honestly offer: one extra
        // row of road, scored like one.
        for (const car of traffic) car.y += 1;
      }
    },
    render(grid: MutableGrid) {
      for (let y = 0; y < rows; y += 1) {
        const lit = (y + ticks) % 4 < 2;
        setCell(grid, 0, y, lit ? 2 : 0);
        setCell(grid, cols - 1, y, lit ? 2 : 0);
      }
      for (const car of traffic) {
        fillRect(grid, laneX(car.lane), car.y, CAR_WIDTH, CAR_HEIGHT, 2);
      }
      fillRect(grid, laneX(playerLane), playerY, CAR_WIDTH, CAR_HEIGHT, 3);
    },
    status(): GameStatus {
      return { score, level: level(), cleared: passed, over, next: null };
    },
  };
}

export const RACING: GameDefinition = {
  id: "racing",
  cols: 20,
  rows: 20,
  stepMs: 220,
  labelKey: "brick.game.racing",
  completeness: "minimal",
  create: createRacing,
};
