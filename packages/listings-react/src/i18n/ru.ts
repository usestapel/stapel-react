import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { registerAttributesI18nRu } from "@stapel/attributes-react/i18n/ru";
import { listingsErrorBundleRu } from "./generated/errors.ru.gen.js";

export { listingsErrorBundleRu } from "./generated/errors.ru.gen.js";

/**
 * Russian bundle for listings-react — the `@stapel/listings-react/i18n/ru`
 * subpath (i18n-shipping.md §2) so the locale is opt-in: hosts that do not
 * register it never carry these strings (the main entry does not import this
 * module — gated by size-limit + the bundle-purity test).
 *
 * This is the storefront's DEFAULT language (storefront spec verdict F1:
 * ru-first), which is why the UI copy is here in full and not only the error
 * keys: a seller filling in a listing is the surface where a half-translated
 * form is most obvious.
 *
 * ── What comes from where ──────────────────────────────────────────────────
 *
 * `stapel-listings` ships **no `translations/` directory at all**, so 21 of
 * the 63 registry codes can never come from an upstream catalogue. They split
 * by owner:
 *
 *  - the 42 cross-cutting `stapel_core` codes are GENERATED, merged in from
 *    stapel-core's own catalogue by `pnpm gen:errors` (spread first below);
 *  - the **9 `stapel_listings` codes** are authored here — and when upstream
 *    ships a catalogue, nine lines are deleted and no key or text moves;
 *  - the **12 `stapel_attributes` codes** are NOT here. They belong to
 *    `@stapel/attributes-react`, which already translates them and which is a
 *    peer of this pair anyway. Two packages must not give one refusal two
 *    sentences (spec §13.2, note 3). A host registers both bundles;
 *    `test/i18n.test.ts` proves the union covers the registry.
 *
 * PROVENANCE, stated rather than implied: the core catalogue ships
 * `origin=seed:authored` and is UNREVIEWED; the pair-authored strings below
 * are the same grade. Neither is a claim of review.
 */
export const listingsI18nBundleRu: I18nDictionary = {
  ...listingsErrorBundleRu,

  // ── the 10 stapel_listings-owned codes, pair-authored ────────────────────
  "error.400.category_required": "Нужно выбрать категорию",
  "error.400.image_required":
    "Чтобы опубликовать объявление, добавьте хотя бы одно фото",
  "error.400.listing_feature_not_allowed":
    "Характеристика «{feature}» не относится к этой категории",
  "error.400.listing_invalid_status_filter":
    "Неизвестный статус объявления: «{status}»",
  "error.400.publish_validation_failed":
    "Объявление не прошло проверку и не опубликовано",
  "error.403.listing_anonymous_not_allowed":
    "Чтобы подать объявление, войдите или зарегистрируйтесь",
  "error.403.listing_not_owner": "Это не ваше объявление",
  "error.404.listing_not_found": "Объявление не найдено",
  "error.409.already_favorited": "Объявление уже в избранном",
  "error.409.invalid_listing_transition":
    "Объявление в статусе «{from_status}» так перевести нельзя",
  "error.409.listing_cannot_delete_active":
    "Сначала снимите объявление с публикации — активное удалить нельзя",

  "listings.error.unknown": "Что-то пошло не так с этим объявлением",

  "listings.status.draft": "Черновик",
  "listings.status.pending": "На проверке",
  "listings.status.published": "Опубликовано",
  "listings.status.paused": "Приостановлено",
  "listings.status.expired": "Срок вышел",
  "listings.status.sold": "Продано",
  "listings.status.rejected": "Отклонено",
  "listings.status.blocked": "Снято модератором",
  "listings.status.archived": "В архиве",

  "listings.moderation.first_review":
    "Отправлено на проверку. Объявление появится в продаже после одобрения модератора.",
  "listings.moderation.live_edit_pending":
    "Объявление остаётся опубликованным, пока мы проверяем правки — покупатели видят его прямо сейчас.",
  "listings.moderation.pending_offline":
    "Проверка была запрошена, но объявление уже не в продаже.",
  "listings.moderation.needs_review":
    "Объявление смотрит модератор вручную.",
  "listings.moderation.live_needs_review":
    "Опубликовано, правки смотрит модератор вручную.",
  "listings.moderation.rejected":
    "Модератор отклонил объявление. Исправьте и отправьте снова.",
  "listings.moderation.rejected_still_live":
    "Модератор отклонил объявление; пока решение применяется, оно ещё видно.",

  "listings.card.no_photo": "Без фото",
  "listings.card.photo_unavailable": "Фото недоступно",
  "listings.card.price_absent": "Цена не указана",
  "listings.card.favorite_add": "В избранное",
  "listings.card.favorite_remove": "Убрать из избранного",
  "listings.card.untitled": "Объявление без названия",
  "listings.card.sign_in": "Войти",
  "listings.card.photos": "Фотографии объявления",
  "listings.card.price_was": "Было",
  "listings.card.price_dropped": "Цена снизилась",
  "listings.card.price_raised": "Цена выросла",

  "listings.detail.loading": "Загружаем объявление…",
  "listings.detail.load_failed": "Не удалось загрузить объявление",
  "listings.detail.retry": "Повторить",
  "listings.detail.not_found": "По этому адресу объявления нет",
  "listings.detail.removed": "Это объявление удалено",
  "listings.detail.withdrawn": "Объявление снято с публикации",
  "listings.detail.not_published":
    "Объявление сейчас не в продаже, и то, что вы видите, может быть неактуальным",
  "listings.detail.owner_only_view":
    "Это видите только вы — объявление ещё не опубликовано",
  "listings.detail.description": "Описание",
  "listings.detail.specs": "Характеристики",
  "listings.detail.no_specs": "Продавец не указал дополнительных характеристик",
  "listings.detail.unreadable_features":
    "Характеристик, которые эта версия не смогла прочитать: {count}",
  "listings.detail.photos_unavailable":
    "Фото здесь показать нельзя — приложению нечем их разрешить",
  "listings.detail.photo_alt": "Фото {index} из {total}",
  "listings.detail.published_at": "Опубликовано {date}",
  "listings.detail.expires_at": "В продаже до {date}",
  "listings.detail.stock": "В наличии",
  "listings.detail.views": "Просмотры",
  "listings.detail.edit": "Редактировать объявление",
  "listings.detail.take_down": "Снять с публикации",

  "listings.compose.new_title": "Новое объявление",
  "listings.compose.edit_title": "Редактирование объявления",
  "listings.compose.category": "Категория",
  "listings.compose.category_help":
    "От категории зависит, какие характеристики спросят у продавца",
  "listings.compose.category_required": "Сначала выберите категорию",
  "listings.compose.category_changed_dropped":
    "Ответов, которые не относятся к этой категории и были очищены: {count}",
  "listings.compose.title_label": "Заголовок",
  "listings.compose.title_too_long":
    "Заголовок должен быть не длиннее {max_length} символов",
  "listings.compose.description_label": "Описание",
  "listings.compose.price_label": "Цена",
  "listings.compose.price_invalid":
    "Введите цену числом, не более двух знаков после запятой",
  "listings.compose.currency_label": "Валюта",
  "listings.compose.location_label": "Где находится",
  "listings.compose.location_help":
    "Покупатели ищут по расстоянию — объявление без места они просто не найдут",
  "listings.compose.geo_incomplete":
    "Рядом с широтой нужна долгота — половина координаты никуда не указывает",
  "listings.compose.photos": "Фотографии",
  "listings.compose.too_many_images":
    "К объявлению можно приложить не больше {max} фото",
  "listings.compose.details": "Характеристики",
  "listings.compose.details_loading": "Загружаем характеристики категории…",
  "listings.compose.details_no_category":
    "Сначала выберите категорию — здесь появится то, что она спрашивает.",
  "listings.compose.details_failed":
    "Не удалось загрузить характеристики категории",
  "listings.compose.details_empty":
    "Эта категория не спрашивает дополнительных характеристик",
  "listings.compose.countable": "Продаю штучный товар",
  "listings.compose.stock": "Сколько штук",
  "listings.compose.auto_republish": "Публиковать заново, когда истечёт срок",
  "listings.compose.save": "Сохранить черновик",
  "listings.compose.save_live": "Отложить правки в черновик",
  "listings.compose.saved_live":
    "Правки отложены в черновик — опубликованное объявление не изменилось",
  "listings.compose.saving": "Сохраняем…",
  "listings.compose.saved": "Черновик сохранён",
  "listings.compose.publish": "Опубликовать",
  "listings.compose.republish": "Сохранить изменения",
  "listings.compose.publishing": "Отправляем…",
  "listings.compose.published_first":
    "Отправлено на проверку. Объявление появится в продаже после одобрения модератора.",
  "listings.compose.published_live":
    "Правки отправлены. Объявление остаётся опубликованным, пока мы их проверяем.",
  "listings.compose.invalid_summary":
    "Прежде чем отправить, поправьте характеристик: {count}",

  "listings.compose.blocked.no_category":
    "Выберите категорию — от неё зависит остальная форма",
  "listings.compose.blocked.unsupported_type":
    "Эта категория спрашивает характеристику, которую приложение пока не умеет показывать, поэтому закончить объявление здесь нельзя",
  "listings.compose.blocked.photos_pending":
    "Дождитесь окончания загрузки фотографий",
  "listings.compose.blocked.no_draft": "Черновик ещё не создан",
  "listings.compose.blocked.busy":
    "Секунду — предыдущее изменение ещё сохраняется",
  "listings.compose.blocked.incomplete": "Не заполнено обязательных деталей: {count}",
  "listings.compose.show_first_missing": "Перейти к первому незаполненному полю",
  "listings.compose.blocked.mirror": "Сначала поправьте отмеченные поля",
  "listings.compose.blocked.details_unavailable":
    "Не удалось загрузить характеристики категории, поэтому проверить форму нельзя",

  "listings.mine.title": "Мои объявления",
  "listings.mine.tab.active": "Активные",
  "listings.mine.tab.drafts": "Черновики",
  "listings.mine.tab.archived": "Архив",
  "listings.mine.loading": "Загружаем ваши объявления…",
  "listings.mine.load_failed": "Не удалось загрузить ваши объявления",
  "listings.mine.empty": "Здесь пока пусто",
  "listings.mine.retry": "Повторить",
  "listings.mine.counters_failed": "Не удалось посчитать ваши объявления",
  "listings.mine.empty.active": "Ни одно ваше объявление не опубликовано и не ждёт проверки",
  "listings.mine.empty.drafts": "Черновиков нет — всё начатое появится здесь",
  "listings.mine.empty.archived": "Пока ничего не в архиве, не снято, не истекло и не продано",
  "listings.mine.blocked.title":
    "Модерация сняла ваших объявлений: {count}",
  "listings.mine.blocked.title.one": "Модерация сняла одно ваше объявление",
  "listings.mine.blocked.title.few": "Модерация сняла {count} ваших объявления",
  "listings.mine.blocked.title.many": "Модерация сняла {count} ваших объявлений",
  "listings.mine.blocked.title.other": "Модерация сняла ваших объявлений: {count}",
  "listings.mine.blocked.load_failed":
    "Не удалось проверить, снимала ли модерация ваши объявления",
  "listings.mine.live_under_review": "Опубликовано, правки на проверке",
  "listings.mine.edit": "Редактировать",
  "listings.mine.archive": "В архив",
  "listings.mine.complete": "Отметить проданным",
  "listings.mine.delete": "Удалить",
  "listings.mine.delete_confirm_title": "Удалить объявление?",
  "listings.mine.delete_confirm_body":
    "Оно исчезнет из кабинета, и вернуть его будет нельзя. Архив сохраняет его.",

  "listings.favorites.title": "Избранное",
  "listings.favorites.loading": "Загружаем избранное…",
  "listings.favorites.load_failed": "Не удалось загрузить избранное",
  "listings.favorites.empty": "Вы ещё ничего не сохранили",
  "listings.favorites.empty_hint":
    "Нажмите на сердечко в любом объявлении — оно будет ждать здесь.",
  "listings.favorites.sign_in_hint":
    "Избранное хранится в аккаунте, поэтому переходит с вами на другие устройства.",

  // The two publish checks the 0.17 contract brought with it: a place is
  // required, and a zero price in such a category is an empty field rather
  // than "free".
  "error.400.listing_location_required":
    "Перед публикацией укажите, где находится товар",
  "error.400.listing_zero_price_not_allowed":
    "В этой категории цена 0 недопустима. Оставьте поле пустым — это и есть «цена не указана».",

  "listings.blocked.sign_in": "Войдите, чтобы сделать это",
  "listings.blocked.guest":
    "Этот аккаунт пока так не может — сначала завершите настройку",
  "listings.blocked.mandate_unknown":
    "Не удалось проверить ваш аккаунт, поэтому мы не угадываем, можно ли вам это",
  "listings.blocked.transition":
    "Объявление в статусе «{from_status}» так перевести нельзя",
  "listings.blocked.delete_active":
    "Сначала уберите в архив — объявление в продаже удалить нельзя",
  "listings.blocked.in_flight": "Секунду — это уже выполняется",
  "listings.blocked.no_editor":
    "В этом приложении пока нет экрана редактирования объявления",

  "listings.page.prev": "Назад",
  "listings.page.next": "Дальше",
  "listings.page.indicator": "Страница {page}",

  "listings.nav.detail": "Объявление",
  "listings.nav.compose": "Подать объявление",
  "listings.nav.compose.short": "Подать",
  "listings.nav.mine": "Мои объявления",
  "listings.nav.mine.short": "Мои",
  "listings.nav.favorites": "Избранное",
};

/**
 * Register the Russian bundle into a core i18n engine — AND the twelve
 * `stapel_attributes` sentences this pair deliberately does not author.
 *
 * The split of ownership is right and stays: two packages must not give one
 * refusal two sentences. What was wrong was leaving the JOIN to a README. A
 * host that registered only this bundle got twelve of the composer's most
 * common refusals ("this value is below the minimum", "the description is too
 * long") in English on a Russian page, and nothing failed anywhere to say so.
 *
 * `@stapel/attributes-react` is a peer of this pair and its editors are what
 * RAISE those twelve, so a listings-ru host is an attributes-ru host by
 * construction; chaining the registration states that instead of asking. It is
 * idempotent — a host that also registers the bundle itself simply writes the
 * same keys twice.
 */
export function registerListingsI18nRu(i18n: I18nEngine): void {
  registerAttributesI18nRu(i18n);
  i18n.registerBundle("ru", listingsI18nBundleRu);
}
