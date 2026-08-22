/**
 * NAMES ARE TRANSLATION KEYS. NOTHING ON THE WIRE RESOLVES THEM.
 *
 * This is the fact a storefront most needs stated plainly, so it is stated
 * here and mirrored honestly rather than papered over.
 *
 * `stapel-categories` stores keys, never a catalogue: "This module stores
 * translation **keys** (e.g. `category.electronics`); it never owns a
 * translation catalog" (`translation.py`). Rendering runs through a
 * `DISPLAY_TRANSLATOR` seam whose default is the identity function, and — this
 * is the part that decides the client's behaviour — **no serializer calls it**.
 * `translate()` has exactly two call sites in the module, `Category.__str__`
 * and the admin's memoized feature label (`models.py`, `translation.py`); the
 * REST layer serializes `name` straight off the model. So:
 *
 *   GET /categories/api/v1/categories/  →  { "name": "category.electronics" }
 *
 * even on a deployment that has configured a real translator. There is no
 * `?lang=`, no `Accept-Language` handling, and no second endpoint that returns
 * resolved labels: `GET /categories/translation-keys/` is `IsServiceRequest`
 * and returns the KEYS with admin refs — it is the extraction feed for
 * translators, the opposite direction.
 *
 * ── Which strings are keys ─────────────────────────────────────────────────
 *
 * The wire says so per row, and the pair reads the flag instead of guessing:
 *
 *  - a category's `name` is a key **iff `translatable` is true** (default
 *    `true`; the field's own help text is "If True, category name is a
 *    translation key").
 *  - a feature's `name` is a key iff its `translate` mode is `"all"` or
 *    `"title"`; `"none"` means the stored string IS the label.
 *  - a feature's option labels and its `placeholder`/`prefix`/`postfix`
 *    config strings are keys only under `translate: "all"`, and only while
 *    `config.translatable_options` is not false
 *    (`translation_keys.py: _extract_option_keys_as_list`).
 *
 * ── What this pair does about it ───────────────────────────────────────────
 *
 * It resolves through the HOST's i18n engine — the same `useT` every other key
 * in the fleet goes through — and it does NOT ship a catalogue: category names
 * are a deployment's content, not a library's chrome, so `category.electronics`
 * belongs in the host's bundle beside its own copy, not in
 * `@stapel/categories-react/i18n/ru`.
 *
 * And when the key does not resolve, the key is shown. That is deliberate.
 * The alternative — falling back to the slug, or to a prettified
 * `"category.electronics" → "Electronics"` — invents a label the operator
 * never approved and hides a missing translation behind something that looks
 * finished. A visible `category.electronics` gets fixed; a plausible-looking
 * "Electronics" ships for a year in the wrong language.
 */
import type { Category, CategoryFeature } from "../api/types.js";

/**
 * How a display string reached the screen — the honest answer, carried instead
 * of being flattened into a string.
 *
 * `"key"`      the value is a translation key; run it through i18n.
 * `"literal"`  the row opted out of translation; the value is the label.
 */
export type CategoryLabelKind = "key" | "literal";

export interface CategoryLabel {
  readonly kind: CategoryLabelKind;
  /** The key to translate, or the literal to print. */
  readonly value: string;
}

/**
 * A category's display string and what to do with it.
 *
 * `translatable` is optional in the schema and defaults to `true` on the model,
 * so an absent flag means KEY. Guessing "literal" for an absent flag is the
 * wrong-way-round failure: it prints `category.electronics` at a visitor on a
 * fully translated deployment.
 */
export function categoryLabel(category: Category): CategoryLabel {
  return {
    kind: category.translatable === false ? "literal" : "key",
    value: category.name,
  };
}

/**
 * A feature's display string and what to do with it.
 *
 * `translate: "none"` is the only mode that makes the name a literal;
 * `"title"` and `"all"` both translate it, and the difference between them is
 * about the feature's OPTIONS, which are attributes-react's business, not
 * this function's. An absent mode means `"all"` (the model default).
 */
export function featureLabel(feature: CategoryFeature): CategoryLabel {
  return {
    kind: feature.translate === "none" ? "literal" : "key",
    // `name` falls back to `slug` server-side (`FeatureDef.__post_init__`);
    // mirror that rather than rendering an empty label.
    value: feature.name ?? feature.slug,
  };
}

/**
 * Are this feature's option labels translation keys?
 *
 * Only under `translate: "all"`, and only while the config has not opted out
 * with `translatable_options: false`. A consumer that labels facet values (the
 * search pair does) needs both halves of that: translating an opted-out option
 * shows the raw key, and NOT translating an opted-in one shows the raw key
 * too — same symptom, opposite fix.
 */
export function featureOptionsAreKeys(feature: CategoryFeature): boolean {
  if ((feature.translate ?? "all") !== "all") return false;
  const config = feature.config;
  return config?.["translatable_options"] !== false;
}

/**
 * Resolve a label with a translator, without pretending about misses.
 *
 * `translate` is the host's `t` (core's `useT()`); i18n engines return the key
 * itself for a miss, which is exactly the behaviour this pair wants and
 * documents above.
 */
export function renderCategoryLabel(
  label: CategoryLabel,
  translate: (key: string) => string
): string {
  return label.kind === "key" ? translate(label.value) : label.value;
}
