import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { cdnErrorBundleEs } from "./generated/errors.es.gen.js";

export { cdnErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for cdn-react — the `@stapel/cdn-react/i18n/es` subpath.
 * Same two sources as `./ru`: the generated bundle carries the cross-cutting
 * keys stapel-core localizes, and the 11 keys stapel-cdn owns are authored
 * here until upstream ships `translations/errors.es.json`.
 *
 * The UI copy is translated too, not only the errors. An upload control is
 * where a seller spends the most attention while listing something, and a
 * picker that speaks Spanish while its progress line speaks English is the
 * half-translated surface a person notices first.
 */
export const cdnI18nBundleEs: I18nDictionary = {
  ...cdnErrorBundleEs,

  // Backend error codes stapel-cdn owns — authored here.
  "error.400.file_hash_required": "Falta el parámetro file_hash",
  "error.400.file_type_not_allowed": "No se permite este tipo de archivo",
  "error.400.invalid_format": "Formato de archivo no admitido",
  "error.400.invalid_hash": "Hash de archivo no válido",
  "error.400.invalid_image_type": "Tipo de imagen desconocido",
  "error.400.too_many_refs":
    "Demasiadas referencias en una sola petición ({count}; el máximo es {max})",
  "error.400.missing_fields": "Faltan campos obligatorios",
  "error.400.no_file": "No se ha elegido ningún archivo",
  "error.403.storage_quota_exceeded": "Se ha superado la cuota de almacenamiento",
  "error.404.no_images": "No se han encontrado imágenes procesadas",
  "error.413.file_too_large": "El archivo es demasiado grande",
  "error.503.image_decoder_unavailable":
    "Este servidor no puede procesar imágenes {extension} ahora mismo",

  // UI copy.
  "cdn.error.unknown": "Algo ha fallado en esta subida",

  "cdn.pick.image": "Elegir una imagen",
  "cdn.pick.images": "Añadir fotos",
  "cdn.pick.replace": "Reemplazar",
  "cdn.pick.hint": "{formats} · hasta {maxMb} MB",
  "cdn.pick.drop_hint": "Arrastra archivos aquí o haz clic para elegirlos",

  "cdn.phase.hashing": "Leyendo el archivo…",
  "cdn.phase.checking": "Comprobando si ya lo tenemos…",
  "cdn.phase.uploading": "Subiendo…",
  "cdn.phase.processing": "Preparando las vistas previas…",
  "cdn.phase.done": "Listo",
  "cdn.phase.canceled": "Cancelado",
  "cdn.phase.failed": "Ha fallado",
  "cdn.phase.queued": "Esperando su turno",

  "cdn.outcome.deduped": "Ya estaba subido: no se ha enviado nada de nuevo",
  "cdn.outcome.variants_pending":
    "Las vistas previas se están generando; la foto ya está guardada",
  "cdn.outcome.dedup_skipped.no_crypto":
    "Esta página no puede calcular el hash, así que se ha omitido la comprobación de duplicados",
  "cdn.outcome.dedup_skipped.unauthorized":
    "La comprobación de duplicados necesita una sesión iniciada; la subida ha continuado",
  "cdn.outcome.dedup_skipped.check_failed":
    "La comprobación de duplicados no ha respondido; la subida ha continuado",

  "cdn.item.cancel": "Cancelar",
  "cdn.item.retry": "Reintentar",
  "cdn.item.remove": "Quitar",
  "cdn.item.move_earlier": "Mover antes",
  "cdn.item.move_later": "Mover después",
  "cdn.item.cover": "Foto principal",
  "cdn.item.alt": "Foto subida",

  "cdn.gallery.count": "{used} de {max} fotos",
  "cdn.gallery.empty": "Todavía no hay fotos",

  "cdn.upload.blocked.full": "Esta galería admite como máximo {max} fotos",
  "cdn.upload.blocked.pending": "Espera a que terminen las subidas",
  "cdn.upload.blocked.failed": "Quita o reintenta las fotos que han fallado",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerCdnI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, cdnI18nBundleEs);
}
