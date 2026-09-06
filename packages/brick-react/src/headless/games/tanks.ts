/**
 * Tanks — MINIMAL but playable. One player tank on the bottom band, one bullet
 * in flight at a time, enemy tanks that descend, twenty points a kill, and a
 * game over when an enemy reaches the player's band.
 *
 * What "minimal" means: enemies do not shoot back, there is no terrain to
 * destroy, and the player has one bullet and one life. Everything a person
 * needs to do while waiting is there — aim, fire, dodge — and nothing else is.
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

const TANK = 3;
const KILL_SCORE = 20;
const KILLS_PER_LEVEL = 5;
const SPAWN_EVERY = 7;
/** How many rows from the bottom the player may roam. */
const HOME_BAND = 5;

interface Enemy {
  x: number;
  y: number;
}

interface Bullet {
  readonly x: number;
  y: number;
}

function createTanks(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;

  let playerX = Math.floor((cols - TANK) / 2);
  let playerY = rows - TANK;
  let bullet: Bullet | null = null;
  let enemies: Enemy[] = [];
  let ticks = 0;
  let kills = 0;
  let score = 0;
  let over = false;

  function level(): number {
    return Math.floor(kills / KILLS_PER_LEVEL) + 1;
  }

  function hits(shot: Bullet, enemy: Enemy): boolean {
    return (
      shot.x >= enemy.x &&
      shot.x < enemy.x + TANK &&
      shot.y >= enemy.y &&
      shot.y < enemy.y + TANK
    );
  }

  return {
    tick() {
      if (over) return;
      ticks += 1;

      if (bullet) {
        bullet.y -= 1;
        if (bullet.y < 0) bullet = null;
      }
      if (bullet) {
        const shot = bullet;
        const survivors = enemies.filter((enemy) => !hits(shot, enemy));
        if (survivors.length !== enemies.length) {
          kills += enemies.length - survivors.length;
          score += (enemies.length - survivors.length) * KILL_SCORE;
          enemies = survivors;
          bullet = null;
        }
      }

      if (ticks % Math.max(3, SPAWN_EVERY - level()) === 0) {
        const x = Math.min(cols - TANK, Math.floor(ctx.random() * (cols - TANK + 1)));
        enemies.push({ x, y: -TANK });
      }
      for (const enemy of enemies) enemy.y += 1;
      if (enemies.some((enemy) => enemy.y + TANK > playerY)) over = true;
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "left") playerX = Math.max(0, playerX - 1);
      else if (action === "right") playerX = Math.min(cols - TANK, playerX + 1);
      else if (action === "up") playerY = Math.max(rows - HOME_BAND, playerY - 1);
      else if (action === "down") playerY = Math.min(rows - TANK, playerY + 1);
      else if (action === "ok") {
        // One bullet at a time: a hold-to-spray console has no aiming in it.
        if (!bullet) bullet = { x: playerX + 1, y: playerY - 1 };
      }
    },
    render(grid: MutableGrid) {
      for (const enemy of enemies) {
        fillRect(grid, enemy.x, enemy.y, TANK, TANK, 2);
        setCell(grid, enemy.x + 1, enemy.y + TANK - 1, 3); // the barrel, aimed down
      }
      fillRect(grid, playerX, playerY, TANK, TANK, 3);
      setCell(grid, playerX + 1, playerY, 1); // the barrel, aimed up
      if (bullet) setCell(grid, bullet.x, bullet.y, 3);
    },
    status(): GameStatus {
      return { score, level: level(), cleared: kills, over, next: null };
    },
  };
}

export const TANKS: GameDefinition = {
  id: "tanks",
  cols: 20,
  rows: 20,
  stepMs: 200,
  labelKey: "brick.game.tanks",
  completeness: "minimal",
  create: createTanks,
};
