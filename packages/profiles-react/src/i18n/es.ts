import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { profilesI18nBundleEn } from "./keys.js";
import { profilesErrorBundleEs } from "./generated/errors.es.gen.js";

export { profilesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for profiles-react — the pair's `es` locale, shipped as the
 * `@stapel/profiles-react/i18n/es` subpath (i18n-shipping.md §2) so the locale is
 * opt-in: hosts that don't register it never carry these strings (the main
 * entry does not import this module — gated by size-limit + the tree-shake
 * purity test).
 *
 * COVERAGE IS COMPLETE, AND DECLARED. This bundle carries the GENERATED
 * backend error texts (from stapel-profiles's `translations/errors.es.json`
 * catalog — `pnpm gen:errors`), complete over the error registry by
 * construction: the generator fails on a gap and the Record type fails
 * compilation on drift. Since the wave-B pass it ALSO carries hand-written
 * Spanish for every pair-owned UI key in `PROFILES_I18N_KEYS` — the state
 * before it (generated errors + an English UI) is the worst of the three
 * possible answers, because a Spanish sentence inside an English screen reads
 * as a half-finished product rather than as a missing translation. Parity is
 * asserted key-by-key in `test/i18nEs.test.ts` and by
 * `stapel/i18n-locale-parity` at lint time; the en floor stays registered
 * underneath so a key added to keys.ts and not yet translated here still
 * degrades to English rather than to a raw key.
 *
 * Plural families spell Spanish's own CLDR categories (`one`/`other`), which
 * is why they do not mirror Russian's four — the family must match across
 * locales, the categories must not.
 */
export const profilesI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts (coverage by construction).
  ...profilesErrorBundleEs,

  // profiles-react UI — hand-written es copy, key by key.
  "profiles.error.unknown": "Algo ha salido mal. Inténtalo de nuevo.",
  "profiles.action.retry": "Reintentar",
  "profiles.action.close": "Cerrar",
  "profiles.profile.loading": "Cargando el perfil…",
  "profiles.profile.save": "Guardar cambios",
  "profiles.profile.saving": "Guardando…",
  "profiles.profile.saved": "Perfil guardado.",
  "profiles.profile.no_changes": "No hay nada que guardar: es el valor ya almacenado.",
  "profiles.relationship.follow": "Seguir",
  "profiles.relationship.follow_back": "Seguir también",
  "profiles.relationship.following": "Siguiendo",
  "profiles.relationship.unfollow": "Dejar de seguir",
  "profiles.relationship.block": "Bloquear",
  "profiles.relationship.blocked": "Bloqueado",
  "profiles.relationship.unblock": "Desbloquear",
  "profiles.relationship.self": "Este eres tú",
  "profiles.relationship.confirm_block.title": "¿Bloquear a {name}?",
  "profiles.relationship.confirm_block.body":
    "Dejará de seguirte y no podrá volver a seguirte hasta que lo desbloquees.",
  "profiles.relationship.confirm_unblock.title": "¿Desbloquear a {name}?",
  "profiles.relationship.confirm_unblock.body":
    "Podrá volver a seguirte. El seguimiento no se restaura automáticamente.",
  "profiles.relationship.blocked_notice": "Has bloqueado a esta persona.",
  "profiles.relationship.blocked.self": "Este es tu propio perfil.",
  "profiles.relationship.blocked.blocked": "Desbloquea a esta persona para poder seguirla.",
  "profiles.relationship.blocked.unknown":
    "No hemos podido leer tu relación con esta persona.",
  "profiles.list.followers": "Seguidores",
  "profiles.list.following": "Siguiendo",
  "profiles.list.blocked": "Bloqueados",
  "profiles.list.empty": "Aquí todavía no hay nadie.",
  "profiles.list.count.followers.one": "{count} seguidor",
  "profiles.list.count.followers.other": "{count} seguidores",
  "profiles.list.count.following.one": "{count} persona que sigues",
  "profiles.list.count.following.other": "{count} personas que sigues",
  "profiles.list.count.blocked.one": "{count} persona bloqueada",
  "profiles.list.count.blocked.other": "{count} personas bloqueadas",
  "profiles.list.empty.followers": "Todavía no tienes seguidores",
  "profiles.list.empty.followers_hint": "Cuando alguien te siga, aparecerá aquí.",
  "profiles.list.empty.following": "Todavía no sigues a nadie",
  "profiles.list.empty.following_hint":
    "Sigue a alguien desde su perfil y aparecerá en esta lista.",
  "profiles.list.empty.blocked": "No has bloqueado a nadie",
  "profiles.list.empty.blocked_hint":
    "Una persona bloqueada no puede seguirte ni ver tu perfil.",
  "profiles.person.unnamed": "Sin nombre",
  "profiles.person.you": "Tú",
  "profiles.person.missing": "Perfil sin configurar",
  "profiles.connections.title": "Conexiones",
  "profiles.connections.subtitle":
    "Las personas que te siguen, las que sigues y todas las que has bloqueado.",
  "profiles.connections.kind_label": "Qué lista mostrar",
  "profiles.public.unwritten": "Esta persona todavía no ha configurado su perfil.",
  "profiles.public.location": "Ubicación",
  "profiles.public.rating": "Valoración",
  "profiles.public.count.following.one": "Sigue a {count} persona",
  "profiles.public.count.following.other": "Sigue a {count} personas",
  "profiles.public.rating_value": "{value} de {max}",
  "profiles.settings.title": "Perfil",
  "profiles.settings.subtitle": "Tu nombre, tu avatar y tus preferencias generales.",
  "profiles.settings.avatar.change": "Cambiar avatar",
  "profiles.settings.avatar.uploading": "Subiendo…",
  "profiles.settings.avatar.upload_error":
    "No hemos podido subir esa imagen. Inténtalo de nuevo.",
  "profiles.settings.field.display_name": "Nombre visible",
  "profiles.settings.field.edit": "Editar: {field}",
  "profiles.settings.field.theme": "Tema",
  "profiles.settings.theme.light": "Claro",
  "profiles.settings.theme.dark": "Oscuro",
  "profiles.settings.theme.system": "Del sistema",
  "profiles.initialSetup.title": "Te damos la bienvenida: configuremos tu perfil",
  "profiles.initialSetup.subtitle":
    "Cuéntanos algo sobre ti. Puedes cambiarlo más tarde en los ajustes del perfil.",
  "profiles.initialSetup.name_placeholder": "Tu nombre",
  "profiles.initialSetup.save": "Continuar",
  "profiles.initialSetup.saving": "Guardando…",
  "profiles.initialSetup.skip": "Más tarde",
  "profiles.initialSetup.blocked.name_required":
    "Escribe un nombre visible para continuar.",
  "profiles.language.title": "Idioma",
  "profiles.language.subtitle": "Elige el idioma en el que quieres ver la aplicación.",
  "profiles.language.field.app_language": "Idioma de la aplicación",
  "profiles.language.field.auto": "Automático",
  "profiles.language.field.understands": "Idiomas que entiendes",
  "profiles.language.catalogue_empty": "No hay idiomas para elegir.",
  "profiles.notif_prefs.title": "Notificaciones",
  "profiles.notif_prefs.subtitle": "Elige qué notificaciones recibes y por qué canal.",
  "profiles.notif_prefs.category.messages": "Mensajes",
  "profiles.notif_prefs.category.system": "Sistema",
  "profiles.notif_prefs.channel.email": "Correo",
  "profiles.notif_prefs.channel.push": "Push",
  "profiles.notif_prefs.toggle_label": "Notificaciones de {category} por {channel}",
  "profiles.nav.settings": "Ajustes",
  "profiles.nav.language": "Idioma",
  "profiles.nav.notifications": "Notificaciones",
  "profiles.nav.connections": "Conexiones",
  "profiles.nav.public_profile": "Perfil público",
};

/**
 * Register the pair's `es` locale into a core i18n engine (call once at
 * startup, after {@link registerProfilesI18n}). Layers per the merge-priority
 * convention (i18n-shipping.md §3): the en floor is registered UNDER the es
 * texts inside the `es` locale, so a key the es bundle ever misses degrades to
 * its English text rather than to a raw key. A host bundle registered after
 * this call overrides both.
 */
export function registerProfilesI18nEs(engine: I18nEngine): void {
  engine.registerBundle("es", profilesI18nBundleEn);
  engine.registerBundle("es", profilesI18nBundleEs);
}
