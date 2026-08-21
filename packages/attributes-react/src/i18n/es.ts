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
  "error.400.feature_mandatory_missing": "{feature} es obligatorio",
  "error.400.feature_unknown_type": "Tipo de característica desconocido para {feature}",
  "error.400.feature_not_allowed": "{feature} no se admite aquí",
  "error.400.feature_unknown": "Característica desconocida {feature}",
  "error.400.feature_invalid_config": "Configuración no válida de {feature}",
  "error.400.description_too_short": "La descripción debe tener al menos {min_length} caracteres",
  "error.400.description_too_long": "La descripción debe tener como máximo {max_length} caracteres",

  "attributes.unsupported_type":
    "Esta versión no incluye un editor para el tipo de atributo «{type}», así que no se puede rellenar aquí.",
  "attributes.submit.blocked.unsupported_type":
    "Algunos atributos no se pueden rellenar en esta página: {types}",
  "attributes.untyped_feature": "Este atributo no declara ningún tipo y no se puede editar.",
  "attributes.value.not_set": "Sin especificar",
  "attributes.value.unreadable": "Esta versión no muestra valores de tipo «{type}»",
  "attributes.bool.yes": "Sí",
  "attributes.bool.no": "No",
  "attributes.select.placeholder": "Elegir",
  "attributes.required": "Obligatorio",
};

/** Register the `es` bundle. Call AFTER `registerAttributesI18n` so it
 * overrides the English floor. */
export function registerAttributesI18nEs(engine: I18nEngine, locale = "es"): void {
  engine.registerBundle(locale, attributesI18nBundleEs);
}
