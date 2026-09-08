import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { attributesErrorBundleEs } from "./generated/errors.es.gen.js";

export { attributesErrorBundleEs } from "./generated/errors.es.gen.js";

/**
 * Spanish bundle — the `@stapel/attributes-react/i18n/es` subpath, opt-in
 * (i18n-shipping.md §2), same shape as `./ru`.
 *
 * The thirteen engine error strings are GENERATED from upstream's own
 * catalogue (stapel-attributes 0.9.4 ships the `docs/errors.json` registry
 * that made `pnpm gen:errors` possible here), together with the forty-two
 * cross-cutting `stapel_core` keys. The thirteen hand-authored lines that
 * stood in for them are deleted — the reasoning, including why no other pair
 * may carry them, is spelled out once in `./ru.ts`; this is its es half.
 *
 * PROVENANCE: upstream's catalogue and core's are UNREVIEWED
 * (`origin=seed:authored`); the UI copy below is pair-authored, same grade.
 */
export const attributesI18nBundleEs: I18nDictionary = {
  ...attributesErrorBundleEs,

  "attributes.unsupported_type": "Este detalle todavía no se puede rellenar aquí.",
  "attributes.submit.blocked.unsupported_type":
    "Algunos detalles no se pueden rellenar en esta página: {features}",
  "attributes.submit.blocked.invalid": "Revisa los campos marcados antes de continuar.",
  "attributes.untyped_feature": "Este detalle está mal configurado y no se puede rellenar.",
  "attributes.value.not_set": "Sin especificar",
  "attributes.value.unreadable": "Este valor no se puede mostrar aquí",
  "attributes.value.provided": "Indicado por el vendedor",
  "attributes.value.verified": "Verificado",
  "attributes.visibility.not_published": "No se publica",
  "attributes.visibility.owner":
    "Este campo lo ven usted y el equipo de moderación; los compradores no.",
  "attributes.visibility.staff":
    "Este campo solo lo ve el equipo de moderación; a usted tampoco se le muestra.",
  "attributes.bool.yes": "Sí",
  "attributes.bool.no": "No",
  "attributes.select.placeholder": "Elegir",
  "attributes.locked": "Lo define el catálogo: no se puede cambiar aquí.",
  "attributes.select.min_selected": "Elige al menos {count}.",
  "attributes.select.max_selected": "Elige como máximo {count}.",
  "attributes.picker.done": "Listo",
  "attributes.picker.search": "Buscar",
  "attributes.picker.recent": "Recientes",
  "attributes.picker.recommended": "Recomendados",
  "attributes.picker.all_options": "Todas las opciones",
  "attributes.picker.refine": "Sigue escribiendo para acotar la lista.",
  "attributes.ref.parent_first": "Elige antes {parent}.",
  "attributes.baked": "Determinado por tus otras selecciones.",
  "attributes.int.out_of_allowed": "Fuera del rango permitido: de {min} a {max}.",
  "attributes.int.out_of_allowed_for": "Para {parents} el valor va de {min} a {max}.",
  "attributes.int.step_up": "Siguiente valor permitido",
  "attributes.int.step_down": "Valor permitido anterior",
  "attributes.int.choose_value": "Elegir entre los valores permitidos",
  "attributes.help.more": "Cómo rellenarlo",
  "attributes.hint.range": "De {min} a {max}.",
  "attributes.hint.min": "Desde {min}.",
  "attributes.hint.max": "Hasta {max}.",
  "attributes.color.exact": "Tono exacto",
  "attributes.unit": "Unidad",
  "attributes.vocabulary_unavailable": "Este detalle todavía no se puede rellenar aquí.",
  "attributes.vocabulary.no_matches": "Sin coincidencias",
  "attributes.invalid_rules": "Este detalle está mal configurado y no se puede rellenar.",
  "attributes.group.row": "Fila {index}",
  "attributes.group.add_row": "Añadir fila",
  "attributes.group.remove_row": "Quitar",
  "attributes.group.at_max_rows": "Este detalle admite como máximo {count} filas.",
};

/** Register the `es` bundle. Call AFTER `registerAttributesI18n` so it
 * overrides the English floor. */
export function registerAttributesI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, attributesI18nBundleEs);
}
