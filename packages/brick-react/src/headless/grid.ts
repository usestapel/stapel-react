/**
 * The panel model. A flat array of {@link CellLevel}s plus the two operations
 * every game needs — "put a pixel here" and "wipe the frame" — with bounds
 * checks in ONE place, because a game that writes past the edge of the panel is
 * the one bug that shows up as a pixel in the wrong row rather than as a crash.
 */
import type { CellLevel, Grid, MutableGrid } from "./types.js";

/** An all-off panel of the given shape. */
export function createGrid(cols: number, rows: number): MutableGrid {
  return { cols, rows, cells: new Array<CellLevel>(cols * rows).fill(0) };
}

/** Turn every pixel off, in place. */
export function clearGrid(grid: MutableGrid): void {
  grid.cells.fill(0);
}

/** Read one pixel; anything outside the panel reads as off. */
export function getCell(grid: Grid, x: number, y: number): CellLevel {
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return 0;
  return grid.cells[y * grid.cols + x] ?? 0;
}

/**
 * Paint one pixel. Out-of-bounds writes are DROPPED, not clamped: a piece
 * rotating half off the panel should lose the half that is off, not smear it
 * down the opposite edge.
 */
export function setCell(
  grid: MutableGrid,
  x: number,
  y: number,
  level: CellLevel
): void {
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return;
  grid.cells[y * grid.cols + x] = level;
}

/** Paint a filled rectangle (used by the chunky sprites — cars, tanks, tiles). */
export function fillRect(
  grid: MutableGrid,
  x: number,
  y: number,
  width: number,
  height: number,
  level: CellLevel
): void {
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) setCell(grid, x + dx, y + dy, level);
  }
}

/** A stable string of the frame — what the demo/distinctness checks compare. */
export function gridSignature(grid: Grid): string {
  return grid.cells.join("");
}
