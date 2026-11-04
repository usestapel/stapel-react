import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { ordersI18nBundleEn } from "./keys.js";

/**
 * Russian bundle for orders-react — shipped as the
 * `@stapel/orders-react/i18n/ru` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * Only the pair's OWN UI keys live here. The backend error catalogue for this
 * locale arrives generated (`errors.ru.gen.ts`, `pnpm gen:errors`) once
 * stapel-orders ships a `translations/errors.ru.json` — spread it in
 * FIRST, exactly as `keys.ts` spreads the en one, so every backend code keeps
 * coverage by construction.
 */
export const ordersI18nBundleRu: I18nDictionary = {
  "orders.error.unknown": "Что-то пошло не так. Попробуйте ещё раз.",
  "orders.nav.cart": "Корзина",
  "orders.nav.checkout": "Оформление заказа",
  "orders.nav.mine": "Мои заказы",
  "orders.nav.detail": "Заказ",
  "orders.add.label": "В корзину",
  "orders.add.adding": "Добавляем…",
  "orders.add.in_cart": "В корзине: {count}",
  "orders.add.go_to_cart": "Перейти в корзину",
  "orders.badge.label": "Корзина, товаров: {count}",
  "orders.cart.title": "Корзина",
  "orders.cart.empty": "Ваша корзина пуста.",
  "orders.cart.total": "Итого",
  "orders.cart.quantity": "Количество",
  "orders.cart.remove": "Удалить",
  "orders.cart.checkout": "Оформить заказ",
  "orders.checkout.title": "Оформление заказа",
  "orders.checkout.contact": "Контакты",
  "orders.checkout.address_section": "Адрес доставки",
  "orders.checkout.field.name": "Имя",
  "orders.checkout.field.phone": "Телефон",
  "orders.checkout.field.email": "Email (необязательно)",
  "orders.checkout.field.line1": "Адрес",
  "orders.checkout.field.city": "Город",
  "orders.checkout.field.country": "Код страны",
  "orders.checkout.field.comment": "Комментарий (необязательно)",
  "orders.checkout.field.required": "Обязательное поле",
  "orders.checkout.field.country_format": "Две буквы, например RU",
  "orders.checkout.submit": "Оформить заказ",
  "orders.checkout.price_changed": "Цены изменились с момента добавления товаров. Проверьте новую сумму и оформите заказ ещё раз.",
  "orders.history.title": "Мои заказы",
  "orders.history.empty": "У вас пока нет заказов.",
  "orders.history.load_more": "Показать ещё",
  "orders.order.title": "Заказ {number}",
  "orders.order.cancel": "Отменить заказ",
  "orders.order.total": "Итого",
  "orders.order.placed": "Оформлен",
  "orders.order.delivery": "Доставка",
  "orders.status.new": "Новый",
  "orders.status.confirmed": "Подтверждён",
  "orders.status.shipped": "Отправлен",
  "orders.status.completed": "Выполнен",
  "orders.status.cancelled": "Отменён",
  "orders.status.needs_review": "На проверке",
  "orders.status.unknown": "Неизвестный статус",
};

/**
 * Register the Russian bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerOrdersI18nRu(
  engine: I18nEngine,
  locale = "ru"
): void {
  engine.registerBundle(locale, ordersI18nBundleEn);
  engine.registerBundle(locale, ordersI18nBundleRu);
}
