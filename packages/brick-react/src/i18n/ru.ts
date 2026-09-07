import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * Russian bundle for `@stapel/brick-react` — shipped as the
 * `@stapel/brick-react/i18n/ru` subpath so the locale is opt-in: a host that
 * never registers it carries none of these strings.
 *
 * The waiting captions are the ones that matter most: they are read by someone
 * who is already slightly annoyed, and an English sentence in the middle of a
 * Russian product is what turns "waiting" into "broken".
 */
export const brickI18nBundleRu: I18nDictionary = {
  "brick.game.tetris": "Тетрис",
  "brick.game.snake": "Змейка",
  "brick.game.arkanoid": "Арканоид",
  "brick.game.racing": "Гонки",
  "brick.game.tanks": "Танчики",
  "brick.game.memory": "Память",
  "brick.panel.score": "Очки",
  "brick.panel.hiscore": "Рекорд",
  "brick.panel.level": "Уровень",
  "brick.panel.next": "Далее",
  "brick.status.ready": "Нажмите старт",
  "brick.status.paused": "Пауза",
  "brick.status.over": "Игра окончена",
  "brick.status.record": "Новый рекорд",
  "brick.console.label": "Игровая приставка",
  "brick.console.screen": "Игровой экран",
  "brick.console.menu": "Выберите игру",
  "brick.pad.left": "Влево",
  "brick.pad.right": "Вправо",
  "brick.pad.up": "Вверх",
  "brick.pad.down": "Вниз",
  "brick.pad.ok": "Повернуть или выстрелить",
  "brick.pad.start": "Старт или пауза",
  "brick.pad.reset": "Сброс",
  "brick.pad.label": "Управление игрой",
  "brick.wait.admission": "Пока ждёте, когда вас впустят…",
  "brick.wait.processing": "Пока мы всё обрабатываем…",
  "brick.wait.upload": "Пока загрузка не закончится…",
  "brick.wait.queue": "Пока держим ваше место в очереди…",
  "brick.key.move": "Двигать",
  "brick.key.turn": "Повернуть — удерживайте, чтобы ускориться",
  "brick.key.softdrop": "Ускорить падение — удерживайте",
  "brick.key.harddrop": "Сбросить вниз",
  "brick.key.rotate": "Повернуть",
  "brick.key.lane": "Сменить полосу",
  "brick.key.accelerate": "Ускориться",
  "brick.key.fire": "Выстрелить",
  "brick.key.cursor": "Двигать курсор",
  "brick.key.flip": "Открыть плитку",
  "brick.keyname.left": "← A",
  "brick.keyname.right": "→ D",
  "brick.keyname.up": "↑ W",
  "brick.keyname.down": "↓ S",
  "brick.keyname.ok": "Пробел",
  "brick.keyname.start": "Enter",
  "brick.keyname.reset": "R",
  "brick.legend.label": "Клавиши",
  "brick.button.start": "Старт",
  "brick.button.pause": "Пауза",
  "brick.button.resume": "Продолжить",
  "brick.button.again": "Ещё раз",
  "brick.button.reset": "Сброс",
  "brick.screen.hint": "Нажмите здесь или Enter",
};

/** Register the Russian copy into a core i18n engine. */
export function registerBrickI18nRu(engine: I18nEngine, locale = "ru"): void {
  engine.registerBundle(locale, brickI18nBundleRu);
}
