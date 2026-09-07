/**
 * Tanks — the battlefield of the original handheld, rebuilt from the owner's
 * drawing. A tank is:
 *
 * ```
 *  0
 * 000
 * 0 0
 * ```
 *
 * — a barrel, a hull, two tracks — and it TURNS: the same six pixels rotated,
 * so which way a tank is pointing is visible on a 3x3 sprite and a shot goes
 * where the barrel does.
 *
 * The enemies do the three things the owner asked for and nothing else:
 *
 *  - they ENTER AT A CORNER of the field, and which corner is part of what
 *    makes a new game a new game;
 *  - they DRIVE BACK AND FORTH along the band they entered on, turning at the
 *    walls rather than charging the player;
 *  - they SHOOT, down the field from the top band and up it from the bottom
 *    one, at a cadence the level tightens.
 *
 * The player holds the middle of the field, with THREE tanks to lose. Standing
 * still is not a strategy — a tank that never moves is on somebody's firing
 * line within seconds — and the lives left are the row of pixels above the
 * player's band.
 *
 * What "minimal" means: one bullet in the air per tank, no terrain to destroy,
 * no base to defend.
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

type Facing = "up" | "down" | "left" | "right";

/**
 * The owner's tank, and the same six pixels turned. Nine bits, row-major, the
 * top-left pixel first — `up` reads ` 0 / 000 / 0 0`.
 */
const TANK: Record<Facing, number> = {
  up: 0b010111101,
  down: 0b101111010,
  left: 0b011110011,
  right: 0b110011110,
};

const SIZE = 3;
const KILL_SCORE = 20;
const KILLS_PER_LEVEL = 5;
/** At most this many enemies out at once — more is a screen, not a fight. */
const MAX_ENEMIES = 3;
/**
 * The player holds three rows in the middle of the field. The bands the
 * enemies patrol are the top and bottom edges, so there are three clear rows
 * between a muzzle and the player: enough for a shot to be SEEN coming, which
 * is the difference between a game and a coin toss.
 */
const HOME_HEIGHT = 3;
/**
 * A shell outruns a tank. Two cells a tick against a tank's one every two ticks
 * is what makes aiming possible at all: with both at one cell a tick you have
 * to lead a 3-wide target by four columns, and every shot a person lines up
 * misses for a reason nothing on the screen explains.
 */
const SHOT_SPEED = 2;
const TANK_MOVE_EVERY = 2;
/** Tanks the player has to lose. Three is what the handheld gave. */
const LIVES = 3;

interface Enemy {
  x: number;
  readonly y: number;
  /** Which way it is driving along its band. */
  dx: number;
  /** Down the field from the top band, up it from the bottom one. */
  readonly facing: Facing;
  /** Where in the fire cycle this one sits, so they do not all shoot at once. */
  readonly phase: number;
  shot: Shot | null;
}

interface Shot {
  x: number;
  y: number;
  readonly dx: number;
  readonly dy: number;
}

/** Where a barrel pointing this way sits, and which way its shot travels. */
const NOSE: Record<Facing, { readonly dx: number; readonly dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

function paintTank(grid: MutableGrid, x: number, y: number, facing: Facing, level: 2 | 3): void {
  const mask = TANK[facing];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (mask & (1 << (SIZE * SIZE - 1 - (row * SIZE + col)))) {
        setCell(grid, x + col, y + row, level);
      }
    }
  }
}

/** Does a point sit inside a 3x3 tank at this origin? */
function inside(px: number, py: number, x: number, y: number): boolean {
  return px >= x && px < x + SIZE && py >= y && py < y + SIZE;
}

function createTanks(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;
  const maxX = cols - SIZE;
  /** The four corners a 3x3 tank can enter at. */
  const corners: readonly { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: maxX, y: 0 },
    { x: 0, y: rows - SIZE },
    { x: maxX, y: rows - SIZE },
  ];
  const homeBottom = Math.floor(rows / 2);
  const homeTop = homeBottom - (HOME_HEIGHT - 1);

  const homeX = Math.floor(maxX / 2);
  let playerX = homeX;
  let playerY = homeBottom;
  let facing: Facing = "up";
  let lives = LIVES;
  let shot: Shot | null = null;
  let enemies: Enemy[] = [];
  let spawned = 0;
  let ticks = 0;
  let kills = 0;
  let score = 0;
  let over = false;

  function level(): number {
    return ctx.startLevel + Math.floor(kills / KILLS_PER_LEVEL);
  }

  function spawn(): void {
    if (enemies.length >= MAX_ENEMIES) return;
    // Pick a corner, and walk on to the next one if it is taken: a tank
    // materialising inside another tank is exactly the kind of nonsense this
    // rewrite exists to remove.
    const first = Math.floor(ctx.random() * corners.length) % corners.length;
    for (let i = 0; i < corners.length; i += 1) {
      const corner = corners[(first + i) % corners.length];
      if (!corner) continue;
      if (enemies.some((enemy) => enemy.y === corner.y && Math.abs(enemy.x - corner.x) < SIZE)) {
        continue;
      }
      enemies.push({
        x: corner.x,
        y: corner.y,
        dx: corner.x === 0 ? 1 : -1,
        facing: corner.y === 0 ? "down" : "up",
        phase: spawned * 3,
        shot: null,
      });
      spawned += 1;
      return;
    }
  }

  function killAt(px: number, py: number): boolean {
    const survivors = enemies.filter((enemy) => !inside(px, py, enemy.x, enemy.y));
    if (survivors.length === enemies.length) return false;
    kills += enemies.length - survivors.length;
    score += (enemies.length - survivors.length) * KILL_SCORE;
    enemies = survivors;
    return true;
  }

  function hitsPlayer(px: number, py: number): boolean {
    return inside(px, py, playerX, playerY);
  }

  /** One tank lost: back to the middle with a clear field, or the run is over. */
  function struck(): void {
    lives -= 1;
    if (lives <= 0) {
      over = true;
      return;
    }
    playerX = homeX;
    playerY = homeBottom;
    facing = "up";
    shot = null;
    for (const enemy of enemies) enemy.shot = null;
  }

  return {
    tick() {
      if (over) return;
      ticks += 1;

      // Cell by cell, so a shell never tunnels through the tank it should have
      // hit.
      for (let i = 0; i < SHOT_SPEED && shot; i += 1) {
        shot.x += shot.dx;
        shot.y += shot.dy;
        if (shot.y < 0 || shot.y >= rows || shot.x < 0 || shot.x >= cols) shot = null;
        else if (killAt(shot.x, shot.y)) shot = null;
      }

      for (const enemy of enemies) {
        // Back and forth along the band it entered on. The turn happens BEFORE
        // the move, so a tank at the wall reverses rather than standing still
        // for a tick — a stall reads as the game having frozen.
        if (ticks % TANK_MOVE_EVERY === 0) {
          if (enemy.x + enemy.dx < 0 || enemy.x + enemy.dx > maxX) enemy.dx = -enemy.dx;
          enemy.x += enemy.dx;
        }
        for (let i = 0; i < SHOT_SPEED && enemy.shot; i += 1) {
          const bullet = enemy.shot;
          bullet.y += bullet.dy;
          if (bullet.y < 0 || bullet.y >= rows) enemy.shot = null;
          else if (hitsPlayer(bullet.x, bullet.y)) {
            enemy.shot = null;
            struck();
          }
        }
        const every = Math.max(8, 20 - 2 * level());
        if (!enemy.shot && (ticks + enemy.phase) % every === 0) {
          const dy = enemy.facing === "down" ? 1 : -1;
          const bullet: Shot = { x: enemy.x + 1, y: enemy.y + (dy > 0 ? SIZE : -1), dx: 0, dy };
          // A muzzle already inside the player IS a hit. Waiting for the next
          // tick would draw a lit cell in the middle of the player's own tank
          // and pretend nothing had happened.
          enemy.shot = bullet;
          if (hitsPlayer(bullet.x, bullet.y)) struck();
        }
        if (inside(playerX + 1, playerY + 1, enemy.x, enemy.y)) struck();
      }

      if (ticks % Math.max(10, 26 - 2 * level()) === 0) spawn();
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "ok") {
        // One bullet in the air: a hold-to-spray console has no aiming in it.
        if (shot) return;
        const nose = NOSE[facing];
        shot = {
          x: playerX + 1 + nose.dx * 2,
          y: playerY + 1 + nose.dy * 2,
          dx: nose.dx,
          dy: nose.dy,
        };
        return;
      }
      if (action === "left") {
        facing = "left";
        playerX = Math.max(0, playerX - 1);
      } else if (action === "right") {
        facing = "right";
        playerX = Math.min(maxX, playerX + 1);
      } else if (action === "up") {
        facing = "up";
        playerY = Math.max(homeTop, playerY - 1);
      } else if (action === "down") {
        facing = "down";
        playerY = Math.min(homeBottom, playerY + 1);
      }
    },
    render(grid: MutableGrid) {
      for (const enemy of enemies) {
        paintTank(grid, enemy.x, enemy.y, enemy.facing, 2);
        if (enemy.shot) setCell(grid, enemy.shot.x, enemy.shot.y, 3);
      }
      paintTank(grid, playerX, playerY, facing, 3);
      if (shot) setCell(grid, shot.x, shot.y, 3);
      // The tanks still in the garage, on the empty row above the player's band.
      for (let i = 0; i < lives - 1; i += 1) setCell(grid, i * 2, homeTop - 2, 1);
    },
    status(): GameStatus {
      return { score, level: level(), cleared: kills, over, next: null };
    },
  };
}

export const TANKS: GameDefinition = {
  id: "tanks",
  // A square battlefield: four corners an enemy can come from, and room
  // between the two bands for a shot to cross.
  cols: 13,
  rows: 17,
  stepMs: 150,
  labelKey: "brick.game.tanks",
  controls: [
    { inputs: ["left", "right", "up", "down"], labelKey: "brick.key.drive" },
    { inputs: ["ok"], labelKey: "brick.key.fire" },
  ],
  repeat: ["left", "right", "up", "down"],
  completeness: "minimal",
  create: createTanks,
};
