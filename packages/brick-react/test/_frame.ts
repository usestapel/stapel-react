/**
 * What every game test needs: build a game the way the session builds one, paint
 * one frame, and read the panel back as something a person can compare with the
 * owner's own drawing.
 *
 * The unit of assertion here is the FIELD, never the game's internals. A test
 * that reached into a closure would pass while the screen showed the wrong
 * thing, which is exactly the failure the last round shipped.
 */
import { clearGrid, createGrid, createRng } from "../src/index.js";
import type { CellLevel, Game, GameDefinition, Grid } from "../src/index.js";

export interface BuildOptions {
  readonly seed?: number;
  readonly startLevel?: number;
}

/** One game, built the way `createBrickSession` builds it. */
export function build(definition: GameDefinition, options: BuildOptions = {}): Game {
  const rng = createRng(options.seed ?? 1);
  return definition.create({
    random: rng.next,
    cols: definition.cols,
    rows: definition.rows,
    startLevel: options.startLevel ?? 1,
  });
}

/** Paint the current frame. */
export function frame(definition: GameDefinition, game: Game): Grid {
  const grid = createGrid(definition.cols, definition.rows);
  clearGrid(grid);
  game.render(grid);
  return grid;
}

/** Read one cell. */
export function at(grid: Grid, x: number, y: number): CellLevel {
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return 0;
  return grid.cells[y * grid.cols + x] ?? 0;
}

/**
 * A rectangle of the panel as the owner draws it: `0` for a lit cell, a space
 * for a dark one. This is the only honest way to check a sprite — the drawing
 * in the spec and the string in the test are the same picture.
 */
export function draw(
  grid: Grid,
  x: number,
  y: number,
  width: number,
  height: number,
  min: CellLevel = 1
): string[] {
  const out: string[] = [];
  for (let dy = 0; dy < height; dy += 1) {
    let row = "";
    for (let dx = 0; dx < width; dx += 1) row += at(grid, x + dx, y + dy) >= min ? "0" : " ";
    out.push(row);
  }
  return out;
}

/** Every cell at exactly this level, as `x,y`. */
export function cellsAt(grid: Grid, level: CellLevel): string[] {
  const out: string[] = [];
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) if (at(grid, x, y) === level) out.push(`${String(x)},${String(y)}`);
  }
  return out;
}

/** The bounding box of every cell at this level, or null when there are none. */
export function boxAt(
  grid: Grid,
  level: CellLevel
): { x: number; y: number; width: number; height: number } | null {
  let minX = grid.cols;
  let minY = grid.rows;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      if (at(grid, x, y) !== level) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** A stable string of the frame, for the two determinism tests. */
export function signature(grid: Grid): string {
  return grid.cells.join("");
}
