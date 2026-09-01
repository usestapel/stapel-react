import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * Spanish bundle — the `@stapel/attributes-react/i18n/es` subpath, opt-in
 * (i18n-shipping.md §2), same shape and same provenance caveat as `./ru`:
 * stapel-attributes ships English only, so this copy is pair-authored and
 * unreviewed, and deliberately worded to match forms-react's copy of the same
 * twelve engine keys.
 */
export const attributesI18nBundleEs: I18nDictionary = {
  "error.400.feature_below_minimum": "El valor es inferior al mínimo de {feature}",
  "error.400.feature_above_maximum": "El valor supera el máximo de {feature}",
  "error.400.feature_not_in_options": "El valor no está entre las opciones de {feature}",
  "error.400.feature_invalid_type": "Tipo de valor no válido para {feature}",
  "error.400.feature_invalid_format": "Formato no válido para {feature}",
  "error.400.feature_invalid_rules": "Condiciones no válidas en {feature}",
  "error.400.feature_mandatory_missing": "{feature} es obligatorio",
  "error.400.feature_unknown_type": "Tipo de característica desconocido para {feature}",
  "error.400.feature_not_allowed": "{feature} no se admite aquí",
  "error.400.feature_unknown": "Característica desconocida {feature}",
  "error.400.feature_invalid_config": "Configuración no válida de {feature}",
  "error.400.description_too_short": "La descripción debe tener al menos {min_length} caracteres",
  "error.400.description_too_long": "La descripción debe tener como máximo {max_length} caracteres",

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
  "attributes.color.exact": "Tono exacto",
  "attributes.unit": "Unidad",
  "attributes.vocabulary_unavailable": "Este detalle todavía no se puede rellenar aquí.",
  "attributes.vocabulary.no_matches": "Sin coincidencias",
  "attributes.invalid_rules": "Este detalle está mal configurado y no se puede rellenar.",
  "attributes.group.row": "Fila {index}",
  "attributes.group.add_row": "Añadir fila",
  "attributes.group.remove_row": "Quitar",
};

/** Register the `es` bundle. Call AFTER `registerAttributesI18n` so it
 * overrides the English floor. */
export function registerAttributesI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, attributesI18nBundleEs);
}
