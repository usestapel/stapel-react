import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * Spanish bundle for `@stapel/brick-react` — shipped as the
 * `@stapel/brick-react/i18n/es` subpath so the locale is opt-in. See `ru.ts`
 * for why the waiting captions carry more weight than their length suggests.
 */
export const brickI18nBundleEs: I18nDictionary = {
  "brick.game.tetris": "Tetris",
  "brick.game.snake": "Serpiente",
  "brick.game.arkanoid": "Arkanoid",
  "brick.game.racing": "Carreras",
  "brick.game.tanks": "Tanques",
  "brick.game.memory": "Memoria",
  "brick.panel.score": "Puntos",
  "brick.panel.hiscore": "Récord",
  "brick.panel.level": "Nivel",
  "brick.panel.next": "Siguiente",
  "brick.status.ready": "Pulsa empezar",
  "brick.status.paused": "En pausa",
  "brick.status.over": "Fin de la partida",
  "brick.status.record": "Nuevo récord",
  "brick.console.label": "Consola de ladrillos",
  "brick.console.screen": "Pantalla de juego",
  "brick.console.menu": "Elige un juego",
  "brick.pad.left": "Izquierda",
  "brick.pad.right": "Derecha",
  "brick.pad.up": "Arriba",
  "brick.pad.down": "Abajo",
  "brick.pad.ok": "Girar o disparar",
  "brick.pad.start": "Empezar o pausar",
  "brick.pad.reset": "Reiniciar",
  "brick.pad.label": "Controles del juego",
  "brick.wait.admission": "Mientras esperas a que te dejen entrar…",
  "brick.wait.processing": "Mientras lo procesamos…",
  "brick.wait.upload": "Mientras termina la subida…",
  "brick.wait.queue": "Mientras guardamos tu sitio en la cola…",
};

/** Register the Spanish copy into a core i18n engine. */
export function registerBrickI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, brickI18nBundleEs);
}
