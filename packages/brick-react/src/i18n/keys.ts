import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * `@stapel/brick-react`'s own translation KEYS (frontend-standard §4.2). The
 * console renders no literal string: the game names, the panel captions, every
 * keypad button's accessible name and the waiting captions all come through
 * core's i18n engine.
 *
 * The English bundle is also the FLOOR the components fall back to when they
 * are mounted outside an `<I18nProvider>` — a waiting screen is exactly the
 * kind of surface a host drops in before its providers are up, and a console
 * whose buttons announce themselves as "brick.pad.left" is worse than one that
 * says "Left" in the wrong language.
 */
export const BRICK_I18N_KEYS = {
  gameTetris: "brick.game.tetris",
  gameSnake: "brick.game.snake",
  gameArkanoid: "brick.game.arkanoid",
  gameRacing: "brick.game.racing",
  gameTanks: "brick.game.tanks",
  gameMemory: "brick.game.memory",

  /** The panel's four captions. Short on purpose — the LCD is 10 cells wide. */
  panelScore: "brick.panel.score",
  panelHiScore: "brick.panel.hiscore",
  panelLevel: "brick.panel.level",
  panelNext: "brick.panel.next",

  /** The three things the screen can be doing, said in words for a reader. */
  statusReady: "brick.status.ready",
  statusPaused: "brick.status.paused",
  statusOver: "brick.status.over",
  /** Announced beside the final score when the run beat the stored best. */
  statusRecord: "brick.status.record",

  /** The console itself, and the panel inside it — both are named regions. */
  consoleLabel: "brick.console.label",
  screenLabel: "brick.console.screen",
  menuLabel: "brick.console.menu",

  /**
   * The on-screen keypad. Every one of these is an accessible NAME for a
   * button with no text in it, which is the only reason the keypad is usable
   * with a screen reader at all (stapel/icon-button-needs-label).
   */
  padLeft: "brick.pad.left",
  padRight: "brick.pad.right",
  padUp: "brick.pad.up",
  padDown: "brick.pad.down",
  padOk: "brick.pad.ok",
  padStart: "brick.pad.start",
  padReset: "brick.pad.reset",
  padLabel: "brick.pad.label",

  /** `<WaitingGame/>`'s one-line caption, one per reason. */
  waitAdmission: "brick.wait.admission",
  waitProcessing: "brick.wait.processing",
  waitUpload: "brick.wait.upload",
  waitQueue: "brick.wait.queue",
} as const;

export type BrickI18nKey = (typeof BRICK_I18N_KEYS)[keyof typeof BRICK_I18N_KEYS];

export const brickI18nBundleEn: I18nDictionary = {
  "brick.game.tetris": "Tetris",
  "brick.game.snake": "Snake",
  "brick.game.arkanoid": "Arkanoid",
  "brick.game.racing": "Racing",
  "brick.game.tanks": "Tanks",
  "brick.game.memory": "Memory",
  "brick.panel.score": "Score",
  "brick.panel.hiscore": "Best",
  "brick.panel.level": "Level",
  "brick.panel.next": "Next",
  "brick.status.ready": "Press start",
  "brick.status.paused": "Paused",
  "brick.status.over": "Game over",
  "brick.status.record": "New best",
  "brick.console.label": "Brick game console",
  "brick.console.screen": "Game screen",
  "brick.console.menu": "Choose a game",
  "brick.pad.left": "Left",
  "brick.pad.right": "Right",
  "brick.pad.up": "Up",
  "brick.pad.down": "Down",
  "brick.pad.ok": "Rotate or fire",
  "brick.pad.start": "Start or pause",
  "brick.pad.reset": "Reset",
  "brick.pad.label": "Game controls",
  "brick.wait.admission": "While you wait to be let in…",
  "brick.wait.processing": "While we work on it…",
  "brick.wait.upload": "While the upload finishes…",
  "brick.wait.queue": "While you hold your place in the queue…",
};

/**
 * Register the package's `en` floor into a core i18n engine (call once at
 * startup, before any locale override — the convention every `@stapel/*` pair
 * follows).
 */
export function registerBrickI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, brickI18nBundleEn);
}
