/**
 * THE LAPTOPS LEAF — the answer behind D249, captured rather than invented.
 *
 * `GET /search/api/v1/query?type=listing&category=noutbuki` on 2026-09-04,
 * with the leaf's own schema (`/categories/api/v1/categories/148/features/`)
 * beside it, trimmed to the ten slugs the regression is about and otherwise
 * verbatim. The vocabulary is renamed `fleet-autocatalog`; nothing else is
 * touched.
 *
 * What it carries, and why each fact matters:
 *
 *  - the leaf holds ONE listing, and that listing fills almost nothing. The
 *    server counted all 24 axes of the plan and every bucket came back ZERO
 *    (`fill_zero_options` on the authored tables, empty maps for the
 *    vocabulary-backed ones). A page drawn from this used to show six
 *    collapsed accordions and no filter a person could move — the walker's
 *    "6 of 6 groups are empty";
 *  - `vendor`, `model` and `screen_size` are `ref_select` with a bare
 *    `optionsRef`: a dictionary of hundreds behind an axis with no buckets,
 *    which is the case the searchable field exists for;
 *  - `ram_size_select`'s `url_key` is `ram_size` — the type suffix dropped —
 *    while `vendor` and `color` have none to drop and stay themselves;
 *  - four slugs are in `facet_meta.skipped`: the budget never looked at
 *    them, and their authored option tables are all a client has.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type { SearchResponse } from "../src/index.js";
import { searchResponse } from "./fixtures.js";

const LIVE = {
  facets: {
    ad_type: { "prodayu-svoe": 0, "tovar-priobreten-na-prodazhu": 0 },
    condition: { novoe: 0, "b-u": 0 },
    vendor: {},
    model: {},
    screen_size: {},
    ram_size_select: { "8-gb": 0, "16-gb": 0, "32-gb": 0 },
    color: { chernyy: 0, serebristyy: 0, belyy: 0 },
  },
  facet_labels: {
    ad_type: {
      label: "Вид объявления",
      label_translatable: true,
      url_key: "ad_type",
      translatable: false,
      values: {
        "prodayu-svoe": "Продаю своё",
        "tovar-priobreten-na-prodazhu": "Товар приобретен на продажу",
      },
    },
    condition: {
      label: "Состояние",
      label_translatable: true,
      url_key: "condition",
      translatable: false,
      values: { novoe: "Новое", "b-u": "Б/у" },
    },
    vendor: {
      label: "Производитель",
      label_translatable: false,
      url_key: "vendor",
      translatable: true,
      values: {},
    },
    model: {
      label: "Модель",
      label_translatable: false,
      url_key: "model",
      translatable: true,
      values: {},
    },
    screen_size: {
      label: "Диагональ экрана ноутбука",
      label_translatable: false,
      url_key: "screen_size",
      translatable: true,
      values: {},
    },
    ram_size_select: {
      label: "Объем оперативной памяти",
      label_translatable: false,
      url_key: "ram_size",
      translatable: false,
      values: { "8-gb": "8 ГБ", "16-gb": "16 ГБ", "32-gb": "32 ГБ" },
    },
    color: {
      label: "Цвет",
      label_translatable: false,
      url_key: "color",
      translatable: false,
      values: { chernyy: "Чёрный", serebristyy: "Серебристый", belyy: "Белый" },
    },
  },
  facet_meta: {
    approximate: false,
    candidates: 1,
    counted: [
      "ad_type",
      "condition",
      "vendor",
      "model",
      "screen_size",
      "ram_size_select",
      "color",
    ],
    skipped: ["screen_condition", "case_condition", "kb_condition", "video_file_url"],
    dropped_filters: [],
    core_ranges: ["price"],
    plan: "category",
    withheld: [],
    categories: [{ category: "32/148", count: 1 }],
  },
};

/** The laptops leaf's own schema, trimmed to the slugs above. */
export const LIVE_LAPTOP_FEATURES: readonly FeatureDef[] = [
  {
    slug: "ad_type",
    name: "Вид объявления",
    mandatory: true,
    config: {
      type: "select",
      maxSelected: 1,
      options: [
        { label: "Продаю своё", value: "prodayu-svoe" },
        { label: "Товар приобретен на продажу", value: "tovar-priobreten-na-prodazhu" },
      ],
    },
  },
  {
    slug: "condition",
    name: "Состояние",
    mandatory: true,
    config: {
      type: "select",
      maxSelected: 1,
      options: [
        { label: "Новое", value: "novoe" },
        { label: "Б/у", value: "b-u" },
      ],
    },
  },
  {
    slug: "vendor",
    name: "Производитель",
    mandatory: false,
    config: {
      type: "ref_select",
      maxSelected: 1,
      optionsRef: { level: "Vendor", vocabulary: "fleet-autocatalog" },
    },
  },
  {
    slug: "model",
    name: "Модель",
    mandatory: false,
    config: {
      type: "ref_select",
      maxSelected: 1,
      optionsRef: {
        level: "Model",
        vocabulary: "fleet-autocatalog",
        parentFeature: "vendor",
      },
    },
  },
  {
    slug: "screen_size",
    name: "Диагональ экрана ноутбука",
    mandatory: false,
    config: {
      type: "ref_select",
      maxSelected: 1,
      optionsRef: { level: "ScreenSize", vocabulary: "fleet-autocatalog" },
    },
  },
  {
    slug: "ram_size_select",
    name: "Объем оперативной памяти",
    mandatory: false,
    config: {
      type: "select",
      options: [
        { label: "8 ГБ", value: "8-gb" },
        { label: "16 ГБ", value: "16-gb" },
        { label: "32 ГБ", value: "32-gb" },
      ],
    },
  },
  {
    slug: "color",
    name: "Цвет",
    mandatory: false,
    config: {
      type: "select",
      options: [
        { label: "Чёрный", value: "chernyy" },
        { label: "Серебристый", value: "serebristyy" },
        { label: "Белый", value: "belyy" },
      ],
    },
  },
  {
    slug: "screen_condition",
    name: "Состояние экрана",
    mandatory: false,
    config: {
      type: "select",
      options: [
        { label: "Идеальное", value: "idealnoe" },
        { label: "Царапины", value: "carapiny" },
      ],
    },
  },
  {
    slug: "video_file_url",
    name: "URL видеофайла",
    mandatory: false,
    config: { type: "string" },
  },
];

/** The live answer as a whole response — one listing, every bucket zero. */
export function liveLaptopsResponse(
  overrides: Partial<SearchResponse> = {}
): SearchResponse {
  return searchResponse({
    facets: LIVE.facets,
    facet_labels: LIVE.facet_labels,
    facet_meta: LIVE.facet_meta,
    count: 1,
    ...overrides,
  });
}
