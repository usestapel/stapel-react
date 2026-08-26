import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { webhooksI18nBundleEn } from "./keys.js";
import { webhooksErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for webhooks-react — shipped as the
 * `@stapel/webhooks-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale
 * is opt-in: a host that never registers it never carries these strings (the
 * main entry does not import this module).
 *
 * The backend error catalogue for this locale is spread in FIRST, exactly as
 * `keys.ts` spreads the en one, so every backend code keeps coverage by
 * construction. The pair's own UI keys follow.
 */
export const webhooksI18nBundleRu: I18nDictionary = {
  ...webhooksErrorBundleRu,

  "webhooks.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "webhooks.nav.webhooks": "Вебхуки",

  "webhooks.title": "Вебхуки",
  "webhooks.intro":
    "Отправляйте события этого рабочего пространства в ваши системы — в момент, когда они происходят.",
  "webhooks.empty": "Вебхуков пока нет",
  "webhooks.emptyHint":
    "Вебхук отправляет событие на ваш адрес сразу, как оно случилось — новое объявление, завершённая бронь, — чтобы ваши системы реагировали, а не опрашивали наши.",
  "webhooks.docs": "Как принимать и проверять события",
  "webhooks.new": "Новый вебхук",
  "webhooks.loading": "Загружаем вебхуки…",
  "webhooks.failed": "Не удалось загрузить ваши вебхуки.",
  "webhooks.mandate": "Не удалось проверить доступ к рабочему пространству",
  "webhooks.mandateHint":
    "Это на нашей стороне, а не в ваших настройках. Попробуйте ещё раз через минуту.",
  "webhooks.never": "—",

  "webhooks.col.event": "Событие",
  "webhooks.col.delivery": "Доставка",
  "webhooks.col.target": "Назначение",
  "webhooks.col.active": "Активен",
  "webhooks.col.strikes": "Сбои",
  "webhooks.col.lastDelivery": "Последняя доставка",
  "webhooks.col.actions": "Действия",
  "webhooks.strikes": "{count} подряд",
  "webhooks.autoDisabled":
    "Отключён автоматически после нескольких неудачных доставок подряд.",
  "webhooks.disabledAt": "Отключён {date}",
  "webhooks.active.label": "Активен",
  "webhooks.active.on": "Получает события",
  "webhooks.active.off": "Не получает события",
  "webhooks.active.reactivatedNote":
    "Если включить снова, счётчик сбоев обнулится и повторные попытки начнутся с полного круга.",
  "webhooks.edit": "Изменить",
  "webhooks.openLog": "Доставки",
  "webhooks.remove": "Удалить",
  "webhooks.removeConfirm": "Удалить этот вебхук?",
  "webhooks.removeConfirmBody":
    "Вместе с ним удалится история доставок, включая недоставленные, которые вы ещё не повторили. Отменить нельзя.",

  "webhooks.form.title": "Новый вебхук",
  "webhooks.form.editTitle": "Изменить вебхук",
  "webhooks.form.event": "Событие",
  "webhooks.form.eventHint":
    "В списке только те события, которые действительно порождают установленные здесь модули.",
  "webhooks.form.eventPlaceholder": "Выберите событие",
  "webhooks.form.delivery": "Доставка",
  "webhooks.form.target": "Назначение",
  "webhooks.form.url": "URL",
  "webhooks.form.urlHint":
    "Только https — по http события не отправляются.",
  "webhooks.form.notificationType": "Тип уведомления",
  "webhooks.form.recipient": "Получатель",
  "webhooks.form.stream": "Поток",
  "webhooks.form.path": "Путь обработчика",
  "webhooks.form.targetField": "{field}",
  "webhooks.form.filter": "Фильтр (необязательно)",
  "webhooks.form.filterHint":
    "JSON-условие по данным события. Оставьте пустым, чтобы получать все события этого типа.",
  "webhooks.form.description": "Описание",
  "webhooks.form.submit": "Создать вебхук",
  "webhooks.form.save": "Сохранить изменения",
  "webhooks.form.needsEvent": "Выберите событие, на которое реагирует вебхук.",
  "webhooks.form.needsDelivery": "Выберите способ доставки события.",
  "webhooks.form.noChanges": "Пока ничего не изменилось.",
  "webhooks.form.unknownDeliveryTarget":
    "Этот способ доставки добавлен вашей установкой, поэтому назначение задаётся как JSON.",

  "webhooks.delivery.webhook": "HTTPS-запрос",
  "webhooks.delivery.notification": "Уведомление",
  "webhooks.delivery.ws": "Живой поток",
  "webhooks.delivery.custom": "Обработчик в приложении",
  "webhooks.delivery.unknown": "{delivery}",

  "webhooks.target.missing": "Для этого способа доставки нужно поле «{field}».",
  "webhooks.target.noRecipient":
    "Укажите получателя: пользователя, адрес почты, номер телефона или чат в Telegram.",
  "webhooks.target.insecure":
    "Адрес должен начинаться с https:// — по http события не отправляются.",

  "webhooks.filter.notJson": "Это не корректный JSON: {detail}",
  "webhooks.filter.notObject": "Фильтр должен быть JSON-объектом.",
  "webhooks.filter.tooDeep":
    "Глубина вложенности фильтра — не больше {limit} уровней.",
  "webhooks.filter.badKey": "Ключ фильтра должен быть непустой строкой.",
  "webhooks.filter.badPath": "«{path}» — некорректный путь по данным события.",
  "webhooks.filter.unknownGroupOp":
    "«{op}» — не оператор группировки. Допустимы $or, $and и $not.",
  "webhooks.filter.groupNeedsList":
    "{op} принимает непустой список фильтров.",
  "webhooks.filter.emptyMatcher": "У «{path}» пустое условие.",
  "webhooks.filter.unknownFieldOp":
    "«{path}»: оператор {op} мы не выполняем.",
  "webhooks.filter.opNeedsList": "«{path}»: {op} принимает список значений.",
  "webhooks.filter.opNeedsBoolean": "«{path}»: {op} принимает true или false.",
  "webhooks.filter.opNeedsString": "«{path}»: {op} принимает текст.",
  "webhooks.filter.opNeedsNumber": "«{path}»: {op} принимает число.",
  "webhooks.filter.valid": "Фильтр корректен.",

  "webhooks.secret.title": "Секрет подписи",
  "webhooks.secret.shownOnce":
    "Секрет показывается только сейчас. Сохраните его: мы храним лишь хеш и показать снова не сможем.",
  "webhooks.secret.copy": "Скопировать секрет подписи",
  "webhooks.secret.copied": "Скопировано",
  "webhooks.secret.ack": "Я сохранил этот секрет",
  "webhooks.secret.close": "Готово",
  "webhooks.secret.docs": "Как проверить подпись",
  "webhooks.secret.rotate": "Сменить секрет",
  "webhooks.secret.rotateConfirm": "Сменить секрет подписи?",
  "webhooks.secret.rotateConfirmBody":
    "Старый секрет перестанет работать сразу — переходного периода нет. Пока приёмник не обновлён, каждая доставка будет отклонена, а после нескольких отказов вебхук отключится.",
  "webhooks.secret.rotateUnsigned":
    "Доставки типа «{delivery}» не подписываются, поэтому менять нечего.",
  "webhooks.secret.rotateUnsaved": "Сначала создайте вебхук.",
  "webhooks.secret.present": "Секрет подписи задан.",
  "webhooks.secret.absent": "Секрета подписи нет.",

  "webhooks.log.title": "Доставки",
  "webhooks.log.empty": "Доставок пока не было",
  "webhooks.log.emptyHint":
    "Попытки появятся здесь, как только событие совпадёт с этим вебхуком.",
  "webhooks.log.retention":
    "Успешные доставки хранятся {succeededDays} дней, недоставленные — {deadDays}.",
  "webhooks.log.status": "Статус",
  "webhooks.log.status.pending": "В очереди",
  "webhooks.log.status.retrying": "Повторяем",
  "webhooks.log.status.succeeded": "Доставлено",
  "webhooks.log.status.dead": "Не доставлено",
  "webhooks.log.status.unknown": "Неизвестно ({status})",
  "webhooks.log.status.all": "Любой статус",
  "webhooks.log.attempts": "Попытки",
  "webhooks.log.response": "Ответ",
  "webhooks.log.error": "Ошибка",
  "webhooks.log.next": "Следующая попытка",
  "webhooks.log.last": "Последняя попытка",
  "webhooks.log.replay": "Повторить",
  "webhooks.log.replayOnlyDead":
    "Повторить можно только недоставленное — у этой доставки статус {status}.",
  "webhooks.log.replayed": "Снова поставлено в очередь, с первой попытки.",
  "webhooks.log.payload": "Данные события",
  "webhooks.log.polling": "Проверяем обновления…",
  "webhooks.log.openDetail": "Открыть эту доставку",

  "webhooks.detail.title": "Доставка",
  "webhooks.detail.envelope": "Конверт",
  "webhooks.detail.headers": "Заголовки",
  "webhooks.detail.reconstructed":
    "Собрано из сохранённого события: так выглядел бы повтор, а не запись исходного запроса.",
  "webhooks.detail.response": "Код ответа",
  "webhooks.detail.noResponse": "Ответ не получен.",
  "webhooks.detail.lastError": "Последняя ошибка",

  "webhooks.dialog.dismiss": "Закрыть",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerWebhooksI18nRu(
  engine: I18nEngine,
  locale = "ru"
): void {
  engine.registerBundle(locale, webhooksI18nBundleEn);
  engine.registerBundle(locale, webhooksI18nBundleRu);
}
