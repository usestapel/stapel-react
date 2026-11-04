import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { ordersI18nBundleEn } from "./keys.js";

/**
 * Spanish bundle for orders-react — shipped as the
 * `@stapel/orders-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: a host that never registers it never carries these strings (the main
 * entry does not import this module).
 *
 * Only the pair's OWN UI keys live here. The backend error catalogue for this
 * locale arrives generated (`errors.es.gen.ts`, `pnpm gen:errors`) once
 * stapel-orders ships a `translations/errors.es.json` — spread it in
 * FIRST, exactly as `keys.ts` spreads the en one, so every backend code keeps
 * coverage by construction.
 */
export const ordersI18nBundleEs: I18nDictionary = {
  "orders.error.unknown": "Algo salió mal. Inténtalo de nuevo.",
  "orders.nav.cart": "Carrito",
  "orders.nav.checkout": "Pago",
  "orders.nav.mine": "Mis pedidos",
  "orders.nav.detail": "Pedido",
  "orders.add.label": "Añadir al carrito",
  "orders.add.adding": "Añadiendo…",
  "orders.add.in_cart": "En el carrito: {count}",
  "orders.add.go_to_cart": "Ir al carrito",
  "orders.badge.label": "Carrito, {count} artículos",
  "orders.cart.title": "Carrito",
  "orders.cart.empty": "Tu carrito está vacío.",
  "orders.cart.total": "Total",
  "orders.cart.quantity": "Cantidad",
  "orders.cart.remove": "Quitar",
  "orders.cart.checkout": "Finalizar compra",
  "orders.checkout.title": "Finalizar compra",
  "orders.checkout.contact": "Contacto",
  "orders.checkout.address_section": "Dirección de entrega",
  "orders.checkout.field.name": "Nombre",
  "orders.checkout.field.phone": "Teléfono",
  "orders.checkout.field.email": "Correo (opcional)",
  "orders.checkout.field.line1": "Dirección",
  "orders.checkout.field.city": "Ciudad",
  "orders.checkout.field.country": "Código de país",
  "orders.checkout.field.comment": "Comentario (opcional)",
  "orders.checkout.field.required": "Obligatorio",
  "orders.checkout.field.country_format": "Dos letras, p. ej. ES",
  "orders.checkout.submit": "Realizar pedido",
  "orders.checkout.price_changed": "Los precios cambiaron desde que añadiste estos artículos. Revisa el nuevo total y vuelve a realizar el pedido.",
  "orders.history.title": "Mis pedidos",
  "orders.history.empty": "Aún no tienes pedidos.",
  "orders.history.load_more": "Cargar más",
  "orders.order.title": "Pedido {number}",
  "orders.order.cancel": "Cancelar pedido",
  "orders.order.total": "Total",
  "orders.order.placed": "Realizado",
  "orders.order.delivery": "Entrega",
  "orders.status.new": "Nuevo",
  "orders.status.confirmed": "Confirmado",
  "orders.status.shipped": "Enviado",
  "orders.status.completed": "Completado",
  "orders.status.cancelled": "Cancelado",
  "orders.status.needs_review": "En revisión",
  "orders.status.unknown": "Estado desconocido",
};

/**
 * Register the Spanish bundle. The en bundle goes UNDER it
 * (merge-priority convention): a key this locale has not translated yet
 * degrades to ENGLISH, never to a raw key.
 */
export function registerOrdersI18nEs(
  engine: I18nEngine,
  locale = "es"
): void {
  engine.registerBundle(locale, ordersI18nBundleEn);
  engine.registerBundle(locale, ordersI18nBundleEs);
}
