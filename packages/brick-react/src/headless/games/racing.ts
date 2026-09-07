/**
 * Racing — the two-lane road of the original handheld.
 *
 * The car is the owner's drawing, four rows tall and three wide:
 *
 * ```
 *  0
 * 000
 *  0
 * 0 0
 * ```
 *
 * The bottom row is the WHEELS, and they blink: on one frame they are there, on
 * the next they are not. That is the whole trick that makes a car painted at a
 * fixed row look like it is travelling — the road behind it moves, and the
 * wheels turn.
 *
 * Two lanes, not four. The strip between them is never painted, so the two
 * lanes read as two lanes rather than as a wide road with cars scattered on it;
 * the verges either side are dashed and scroll with the traffic.
 *
 * What "minimal" means here: one car shape, no crash sequence, no gears. The
 * level is the speed, and a held DOWN is the accelerator.
 */
import { setCell } from "../grid.js";
import type {
  BrickInput,
  Game,
  GameContext,
  GameDefinition,
  GameStatus,
  MutableGrid,
} from "../types.js";

/** The car's three body rows, as bit masks — left pixel is the high bit. */
const CAR_BODY: readonly number[] = [0b010, 0b111, 0b010];
/** The wheels: the outer pixels of the bottom row. */
const CAR_WHEELS = 0b101;
const CAR_WIDTH = 3;
const CAR_HEIGHT = 4;

/** The left edge of each of the two lanes, on a nine-wide road. */
const LANE_X: readonly number[] = [1, 5];

const PASS_SCORE = 10;
const PASSES_PER_LEVEL = 10;
/** How fast the road runs while the accelerator is held. */
const BOOST = 3;
/** The vertical gap kept between two spawns, so a lane is always leavable. */
const SPAWN_GAP = CAR_HEIGHT + 2;

interface Traffic {
  readonly lane: number;
  y: number;
}

/** Paint one car. `wheels` is what blinks. */
function paintCar(
  grid: MutableGrid,
  x: number,
  y: number,
  level: 1 | 2 | 3,
  wheels: boolean
): void {
  for (let row = 0; row < CAR_BODY.length; row += 1) {
    const mask = CAR_BODY[row] ?? 0;
    for (let col = 0; col < CAR_WIDTH; col += 1) {
      if (mask & (1 << (CAR_WIDTH - 1 - col))) setCell(grid, x + col, y + row, level);
    }
  }
  if (!wheels) return;
  for (let col = 0; col < CAR_WIDTH; col += 1) {
    if (CAR_WHEELS & (1 << (CAR_WIDTH - 1 - col))) {
      setCell(grid, x + col, y + CAR_HEIGHT - 1, level);
    }
  }
}

function createRacing(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;
  const playerY = rows - CAR_HEIGHT;

  let playerLane = 0;
  let traffic: Traffic[] = [];
  let ticks = 0;
  let passed = 0;
  let score = 0;
  let boosting = false;
  let over = false;

  function level(): number {
    return ctx.startLevel + Math.floor(passed / PASSES_PER_LEVEL);
  }

  function hitsPlayer(car: Traffic): boolean {
    if (car.lane !== playerLane) return false;
    return car.y + CAR_HEIGHT > playerY && car.y < playerY + CAR_HEIGHT;
  }

  return {
    tick() {
      if (over) return;
      ticks += 1;
      for (const car of traffic) car.y += 1;
      const survived = traffic.filter((car) => car.y < rows);
      const cleared = traffic.length - survived.length;
      passed += cleared;
      score += cleared * PASS_SCORE;
      traffic = survived;

      const every = Math.max(3, 8 - level());
      // One car at a time, and never before the last one is clear of the gap:
      // two cars abreast would close both lanes, which is a death no lane
      // change can avoid and therefore not a game.
      const crowded = traffic.some((car) => car.y < SPAWN_GAP);
      if (ticks % every === 0 && !crowded) {
        traffic.push({
          lane: ctx.random() < 0.5 ? 0 : 1,
          y: -CAR_HEIGHT,
        });
      }
      if (traffic.some(hitsPlayer)) over = true;
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "left") playerLane = 0;
      else if (action === "right") playerLane = 1;
    },
    hold(action: BrickInput, isHeld: boolean) {
      if (action === "down" || action === "ok") boosting = isHeld;
    },
    speed() {
      return boosting ? BOOST : 1;
    },
    render(grid: MutableGrid) {
      // The verges: a dashed edge that scrolls with the traffic, so a car
      // painted at a fixed row still reads as moving.
      for (let y = 0; y < rows; y += 1) {
        const lit = (y + ticks) % 4 < 2;
        setCell(grid, 0, y, lit ? 1 : 0);
        setCell(grid, cols - 1, y, lit ? 1 : 0);
      }
      const wheels = ticks % 2 === 0;
      for (const car of traffic) {
        paintCar(grid, LANE_X[car.lane] ?? LANE_X[0] ?? 0, car.y, 2, wheels);
      }
      paintCar(grid, LANE_X[playerLane] ?? 0, playerY, 3, wheels);
    },
    status(): GameStatus {
      return { score, level: level(), cleared: passed, over, next: null };
    },
  };
}

export const RACING: GameDefinition = {
  id: "racing",
  // Nine wide: a verge, a lane, the dark strip between the lanes, a lane, a
  // verge. Twenty rows of road is the length of the original's screen.
  cols: 9,
  rows: 20,
  stepMs: 170,
  labelKey: "brick.game.racing",
  controls: [
    { inputs: ["left", "right"], labelKey: "brick.key.lane" },
    { inputs: ["down"], labelKey: "brick.key.accelerate" },
  ],
  // A lane change is one press, not a slide: repeating it would do nothing
  // twice.
  repeat: [],
  completeness: "minimal",
  create: createRacing,
};
