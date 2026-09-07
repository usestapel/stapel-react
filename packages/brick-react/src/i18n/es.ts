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
  "brick.key.move": "Mover",
  "brick.key.turn": "Girar — mantén para acelerar",
  "brick.key.softdrop": "Caída suave — mantén",
  "brick.key.harddrop": "Caída instantánea",
  "brick.key.rotate": "Rotar",
  "brick.key.lane": "Cambiar de carril",
  "brick.key.accelerate": "Acelerar",
  "brick.key.fire": "Disparar",
  "brick.key.cursor": "Mover el cursor",
  "brick.key.flip": "Voltear una ficha",
  "brick.keyname.left": "← A",
  "brick.keyname.right": "→ D",
  "brick.keyname.up": "↑ W",
  "brick.keyname.down": "↓ S",
  "brick.keyname.ok": "Espacio",
  "brick.keyname.start": "Intro",
  "brick.keyname.reset": "R",
  "brick.legend.label": "Teclas",
  "brick.button.start": "Empezar",
  "brick.button.pause": "Pausa",
  "brick.button.resume": "Continuar",
  "brick.button.again": "Otra vez",
  "brick.button.reset": "Reiniciar",
  "brick.screen.hint": "Pulsa aquí o Intro",
};

/** Register the Spanish copy into a core i18n engine. */
export function registerBrickI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, brickI18nBundleEs);
}
