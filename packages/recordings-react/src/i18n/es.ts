import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { recordingsErrorBundleEs } from "./generated/errors.es.gen.js";

export { recordingsErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle for recordings-react — the `@stapel/recordings-react/i18n/es`
 * subpath (i18n-shipping.md §2), opt-in exactly like `./ru`.
 *
 * Provenance is the same: every `error.*` key comes from the generated
 * `recordingsErrorBundleEs` (stapel-recordings ships
 * `translations/errors.es.json` for its own seventeen codes, stapel-core for
 * the cross-cutting ones), so nothing below re-authors one. Only UI copy is
 * written here.
 */
export const recordingsI18nBundleEs: I18nDictionary = {
  // Backend error codes — generated es texts, module-owned and core-owned.
  ...recordingsErrorBundleEs,

  "recordings.error.unknown": "Algo ha fallado. Inténtalo de nuevo.",
  "recordings.retry": "Reintentar",

  "recordings.status.created": "Creada",
  "recordings.status.uploading": "Subiendo",
  "recordings.status.queued": "En cola",
  "recordings.status.analyzing": "Analizando",
  "recordings.status.normalizing": "Preparando el audio",
  "recordings.status.transcribing": "Transcribiendo",
  "recordings.status.diarizing": "Distinguiendo voces",
  "recordings.status.merging": "Montando la transcripción",
  "recordings.status.completed": "Lista",
  "recordings.status.error": "Con error",
  "recordings.status.deleted": "Eliminada",
  "recordings.status.unknown": "Estado desconocido",
  "recordings.status.processing_label": "En proceso",

  "recordings.list.heading": "Grabaciones",
  "recordings.list.loading": "Cargando tus grabaciones…",
  "recordings.list.empty": "Todavía no hay grabaciones.",
  "recordings.list.empty_hint":
    "Sube un audio o un vídeo y lo transcribimos.",
  "recordings.list.load_failed":
    "No hemos podido cargar tus grabaciones. Es un fallo nuestro, no una señal de que no tengas ninguna.",
  "recordings.list.error": "No se han podido cargar las grabaciones.",
  "recordings.list.retry": "Reintentar",
  "recordings.list.open": "Abrir grabación",
  "recordings.list.workspace_note":
    "Se muestran las grabaciones que este espacio comparte contigo.",

  "recordings.detail.heading": "Grabación",
  "recordings.detail.back": "Volver a las grabaciones",
  "recordings.detail.created": "Creada",
  "recordings.detail.duration": "Duración",
  "recordings.detail.language": "Idioma",
  "recordings.detail.provider": "Transcrita por",
  "recordings.detail.segments": "Fragmentos",
  "recordings.detail.speakers": "Voces",
  "recordings.detail.words": "Palabras",
  "recordings.detail.processing": "Todavía estamos trabajando en esta grabación.",
  "recordings.detail.unknown_value": "Aún se desconoce",

  "recordings.player.heading": "Reproducción",
  "recordings.player.label": "Audio de la grabación",
  "recordings.player.preparing": "Preparando la reproducción…",
  "recordings.player.not_stored": "Esta grabación no tiene archivo guardado.",
  "recordings.player.unavailable":
    "La entrega de archivos no está disponible ahora. La grabación está a salvo; la reproducción no.",
  "recordings.player.blocked_not_ready":
    "La reproducción se abre cuando termine la subida.",
  "recordings.player.blocked_deleted": "Esta grabación se ha eliminado.",
  "recordings.player.refresh": "Recargar la reproducción",

  "recordings.transcript.heading": "Transcripción",
  "recordings.transcript.empty": "Esta grabación no tiene transcripción.",
  "recordings.transcript.pending":
    "La transcripción aparece aquí a medida que se escribe.",
  "recordings.transcript.load_more": "Cargar más transcripción",
  "recordings.transcript.speaker_fallback": "Voz {number}",
  "recordings.transcript.seek": "Reproducir desde {time}",
  "recordings.transcript.current": "Sonando ahora",
  "recordings.transcript.region_label": "Transcripción, sigue la reproducción",

  "recordings.summary.heading": "Resumen",
  "recordings.summary.empty": "Esta grabación todavía no tiene resumen.",

  "recordings.resummarize.action": "Rehacer el resumen",
  "recordings.resummarize.running": "Rehaciendo…",
  "recordings.resummarize.accepted":
    "En cola: el nuevo resumen sustituirá a este cuando esté listo.",
  "recordings.resummarize.blocked_no_transcript":
    "Todavía no hay transcripción que resumir.",
  "recordings.resummarize.blocked_processing":
    "Espera a que termine la transcripción.",
  "recordings.resummarize.blocked_in_flight":
    "Ya se está rehaciendo el resumen de esta grabación.",

  "recordings.reprocess.action": "Transcribir otra vez",
  "recordings.reprocess.confirm_title": "¿Transcribir esta grabación otra vez?",
  "recordings.reprocess.confirm_body":
    "Todo el proceso se ejecuta desde el principio: una segunda transcripción y un segundo cargo. La transcripción y el resumen actuales se sustituyen.",
  "recordings.reprocess.confirm_ok": "Transcribir otra vez",
  "recordings.reprocess.running": "Enviando…",
  "recordings.reprocess.blocked_not_completed":
    "Solo una grabación terminada se puede transcribir otra vez.",
  "recordings.reprocess.queued": "En cola: la transcripción ha vuelto a empezar.",

  "recordings.payment.title": "Hace falta saldo disponible",
  "recordings.payment.hint":
    "Las transcripciones y los resúmenes se facturan. Recarga para volver a ejecutarlo.",
  "recordings.payment.action": "Recargar",

  "recordings.uploader.heading": "Nueva grabación",
  "recordings.uploader.pick": "Elige un audio o un vídeo",
  "recordings.uploader.picked": "{name} · {size}",
  "recordings.uploader.title_label": "Título",
  "recordings.uploader.title_placeholder": "¿De qué es esta grabación?",
  "recordings.uploader.source_label": "Origen",
  "recordings.uploader.language_label": "Idioma hablado",
  "recordings.uploader.language_auto": "Detectar automáticamente",
  "recordings.uploader.diarization_label": "Distinguir las voces",
  "recordings.uploader.start": "Subir y transcribir",
  "recordings.uploader.cancel": "Cancelar la subida",
  "recordings.uploader.step_creating": "Abriendo la subida…",
  "recordings.uploader.step_uploading": "Subiendo…",
  "recordings.uploader.step_finalizing": "Terminando…",
  "recordings.uploader.done": "Subida hecha: transcripción en cola.",
  "recordings.uploader.progress": "{done} de {total}",
  "recordings.uploader.blocked_no_file": "Elige primero un archivo.",
  "recordings.uploader.blocked_no_title": "Ponle un título a la grabación.",
  "recordings.uploader.blocked_no_workspace":
    "Elige el espacio donde guardar esta grabación.",
  "recordings.uploader.too_large":
    "Ese archivo es mayor de lo que permite esta subida.",
  "recordings.uploader.unsupported_type":
    "Ese archivo no es audio ni vídeo, así que no hay nada que transcribir.",
  "recordings.uploader.session_expired":
    "La ventana de subida se ha cerrado. Empieza la subida de nuevo.",
  "recordings.uploader.source_meet": "Reunión",
  "recordings.uploader.source_dictaphone": "Dictáfono",
  "recordings.uploader.source_upload": "Subida",
  "recordings.uploader.source_other": "Otro",

  "recordings.share.heading": "Grabación compartida",
  "recordings.share.locked_title": "Este enlace está protegido",
  "recordings.share.locked_hint":
    "Escribe el código que te han dado para abrir la grabación.",
  "recordings.share.passcode_label": "Código",
  "recordings.share.unlock": "Abrir grabación",
  "recordings.share.unlocking": "Comprobando…",
  "recordings.share.throttled":
    "Demasiados intentos. Espera un momento antes de volver a probar.",
  "recordings.share.not_found":
    "Este enlace no abre nada: puede haberse revocado o caducado.",
  "recordings.share.view_only":
    "Este enlace solo muestra los datos de la grabación.",
  "recordings.share.media_blocked": "Este enlace no incluye el audio.",
  "recordings.share.transcript_blocked":
    "Este enlace no incluye la transcripción.",
  "recordings.share.footer": "Se ha compartido contigo mediante un enlace.",

  "recordings.composer.create": "Nueva grabación",
  "recordings.composer.creating": "Creando…",
  "recordings.composer.created": "Grabación creada: sube tu archivo.",
  "recordings.upload.uploading": "Subiendo…",
  "recordings.finalize.submit": "Terminar la subida",
  "recordings.finalize.finalizing": "Finalizando…",
  "recordings.finalize.done": "Subida finalizada: transcripción en cola.",
};

/** Register the Spanish bundle into a core i18n engine. */
export function registerRecordingsI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, recordingsI18nBundleEs);
}
