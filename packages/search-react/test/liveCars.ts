/**
 * The live cars answer, captured from a deployed classified — not a shape a
 * test invented.
 *
 * `GET /search/api/v1/query?type=listing&category=141/151` on 2026-09-04, and
 * the leaf's own schema from
 * `GET /categories/api/v1/categories/166/features/` beside it, trimmed to the
 * twelve slugs the regression is about and otherwise verbatim.
 *
 * What it carries, and why each of the three matters:
 *
 *  - `make_ref_select` is COUNTED, with three buckets and a make label.
 *    The group was missing from the rail the founder walked, so evidence
 *    reaching the client is the premise every assertion in
 *    `facetOrder.test.tsx` rests on.
 *  - make, model, generation and body type are `ref_select`
 *    features whose config is a bare `optionsRef` POINTER — there is no
 *    option table in the schema and there never will be, which is why they
 *    vanish the moment the server does not count them while steering side,
 *    power steering and heating draw their own `select` tables and stay.
 *  - `year` is `int` with `min: 1900, max: 2027` — 128 values, a picker, and
 *    the bare number field the same walk reported.
 *
 * The parent node the page actually asks about (id 151, the cars root)
 * an EMPTY feature list of its own; `LIVE_CARS_FEATURES` is the LEAF's, and
 * the suite renders both ways.
 */
import type { FeatureDef } from "@stapel/attributes-react";
import type { SearchResponse } from "../src/index.js";
import { searchResponse } from "./fixtures.js";

/** The answer's facet halves, verbatim. */
const LIVE = {
  "facets": {
    "accident": {
      "ne-bityy": 2,
      "bityy": 0
    },
    "color": {
      "belyy": 1,
      "serebryanyy": 0,
      "seryy": 0,
      "chernyy": 0,
      "korichnevyy": 0,
      "zolotoy": 0,
      "bezhevyy": 0,
      "krasnyy": 0,
      "bordovyy": 0,
      "oranzhevyy": 0,
      "zheltyy": 0,
      "zelenyy": 0,
      "goluboy": 0,
      "siniy": 0,
      "fioletovyy": 0,
      "purpurnyy": 0,
      "rozovyy": 0
    },
    "make_ref_select": {
      "renault": 1,
      "toyota": 1,
      "vaz-lada": 1
    },
    "model": {
      "camry": 1,
      "duster": 1,
      "vesta": 1
    },
    "generation": {
      "xv80-2024-2026": 1
    },
    "modification": {
      "2-0-cvt-173-l-s": 1
    },
    "complectation": {
      "deluxe": 1
    },
    "fuel_type_ref_select": {
      "benzin": 1
    },
    "transmission": {
      "variator": 1
    },
    "engine_size": {
      "2-0": 1
    },
    "doors": {
      "4": 1
    },
    "body_type_ref_select": {
      "sedan": 1
    }
  },
  "facet_labels": {
    "accident": {
      "label": "Состояние",
      "label_translatable": true,
      "translatable": false,
      "values": {
        "ne-bityy": "Не битый",
        "bityy": "Битый"
      }
    },
    "color": {
      "label": "Цвет",
      "label_translatable": true,
      "translatable": false,
      "values": {
        "belyy": "Белый",
        "serebryanyy": "Серебряный",
        "seryy": "Серый",
        "chernyy": "Чёрный",
        "korichnevyy": "Коричневый",
        "zolotoy": "Золотой",
        "bezhevyy": "Бежевый",
        "krasnyy": "Красный",
        "bordovyy": "Бордовый",
        "oranzhevyy": "Оранжевый",
        "zheltyy": "Жёлтый",
        "zelenyy": "Зелёный",
        "goluboy": "Голубой",
        "siniy": "Синий",
        "fioletovyy": "Фиолетовый",
        "purpurnyy": "Пурпурный",
        "rozovyy": "Розовый"
      }
    },
    "make_ref_select": {
      "label": "Марка",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "renault": "Renault",
        "toyota": "Toyota",
        "vaz-lada": "ВАЗ (LADA)"
      }
    },
    "model": {
      "label": "Модель",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "camry": "Camry",
        "duster": "Duster",
        "vesta": "Vesta"
      }
    },
    "generation": {
      "label": "Поколение",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "xv80-2024-2026": "XV80 (2024—2026)"
      }
    },
    "modification": {
      "label": "Модификация",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "2-0-cvt-173-l-s": "2.0 CVT (173 л.с.)"
      }
    },
    "complectation": {
      "label": "Комплектация",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "deluxe": "Deluxe"
      }
    },
    "fuel_type_ref_select": {
      "label": "Тип двигателя",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "benzin": "Бензин"
      }
    },
    "transmission": {
      "label": "Коробка передач",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "variator": "Вариатор"
      }
    },
    "engine_size": {
      "label": "Объём двигателя",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "2-0": "2.0"
      }
    },
    "doors": {
      "label": "Количество дверей",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "4": "4"
      }
    },
    "body_type_ref_select": {
      "label": "Тип кузова",
      "label_translatable": false,
      "translatable": false,
      "values": {
        "sedan": "Седан"
      }
    }
  },
  "facet_meta": {
    "approximate": false,
    "candidates": 3,
    "counted": [
      "accident",
      "color",
      "make_ref_select",
      "model",
      "generation",
      "modification",
      "complectation",
      "fuel_type_ref_select",
      "transmission",
      "engine_size",
      "doors",
      "body_type_ref_select"
    ],
    "skipped": [
      "wheel_type",
      "ad_type",
      "power_steering",
      "heating",
      "kilometrage",
      "year"
    ],
    "dropped_filters": [],
    "core_ranges": [
      "price"
    ],
    "plan": "evidence",
    "withheld": [],
    "categories": [
      {
        "category": "141/151/166",
        "count": 3
      }
    ]
  }
};

/** The cars leaf's own schema, verbatim — required flags, blocks and all. */
export const LIVE_CARS_FEATURES: readonly FeatureDef[] = [
  {
    "slug": "make_ref_select",
    "name": "Марка",
    "mandatory": true,
    "group": "Технические характеристики",
    "config": {
      "type": "ref_select",
      "optionsRef": {
        "level": "Make",
        "vocabulary": "fleet-autocatalog"
      },
      "maxSelected": 1,
      "minSelected": 0
    }
  },
  {
    "slug": "model",
    "name": "Модель",
    "mandatory": true,
    "group": "Технические характеристики",
    "config": {
      "type": "ref_select",
      "optionsRef": {
        "level": "Model",
        "vocabulary": "fleet-autocatalog",
        "parentFeature": "make_ref_select"
      },
      "maxSelected": 1,
      "minSelected": 0
    }
  },
  {
    "slug": "generation",
    "name": "Поколение",
    "mandatory": true,
    "group": "Технические характеристики",
    "config": {
      "type": "ref_select",
      "optionsRef": {
        "level": "Generation",
        "vocabulary": "fleet-autocatalog",
        "parentFeature": "model"
      },
      "maxSelected": 1,
      "minSelected": 0
    }
  },
  {
    "slug": "year",
    "name": "Год выпуска",
    "mandatory": true,
    "group": "Технические характеристики",
    "config": {
      "max": 2027,
      "min": 1900,
      "type": "int",
      "optionsRef": {
        "level": "Year",
        "vocabulary": "fleet-autocatalog",
        "parentFeature": "generation"
      }
    }
  },
  {
    "slug": "kilometrage",
    "name": "Пробег",
    "mandatory": true,
    "group": "Общее описание автомобиля",
    "config": {
      "max": 1000000,
      "min": 1,
      "type": "int"
    }
  },
  {
    "slug": "accident",
    "name": "Состояние",
    "mandatory": true,
    "group": "Общее описание автомобиля",
    "config": {
      "type": "select",
      "options": [
        {
          "label": "Не битый",
          "value": "ne-bityy"
        },
        {
          "label": "Битый",
          "value": "bityy"
        }
      ],
      "maxSelected": 1,
      "minSelected": 0,
      "translatable_options": false
    }
  },
  {
    "slug": "color",
    "name": "Цвет",
    "mandatory": true,
    "group": "Внешний вид",
    "config": {
      "type": "select",
      "options": [
        {
          "label": "Белый",
          "value": "belyy"
        },
        {
          "label": "Серебряный",
          "value": "serebryanyy"
        },
        {
          "label": "Серый",
          "value": "seryy"
        },
        {
          "label": "Чёрный",
          "value": "chernyy"
        },
        {
          "label": "Коричневый",
          "value": "korichnevyy"
        },
        {
          "label": "Золотой",
          "value": "zolotoy"
        },
        {
          "label": "Бежевый",
          "value": "bezhevyy"
        },
        {
          "label": "Красный",
          "value": "krasnyy"
        },
        {
          "label": "Бордовый",
          "value": "bordovyy"
        },
        {
          "label": "Оранжевый",
          "value": "oranzhevyy"
        },
        {
          "label": "Жёлтый",
          "value": "zheltyy"
        },
        {
          "label": "Зелёный",
          "value": "zelenyy"
        },
        {
          "label": "Голубой",
          "value": "goluboy"
        },
        {
          "label": "Синий",
          "value": "siniy"
        },
        {
          "label": "Фиолетовый",
          "value": "fioletovyy"
        },
        {
          "label": "Пурпурный",
          "value": "purpurnyy"
        },
        {
          "label": "Розовый",
          "value": "rozovyy"
        }
      ],
      "maxSelected": 1,
      "minSelected": 0,
      "translatable_options": false
    }
  },
  {
    "slug": "body_type_ref_select",
    "name": "Тип кузова",
    "mandatory": true,
    "group": "Технические характеристики",
    "config": {
      "type": "ref_select",
      "optionsRef": {
        "level": "BodyType",
        "vocabulary": "fleet-autocatalog",
        "parentFeature": "modification"
      },
      "maxSelected": 1,
      "minSelected": 0
    }
  },
  {
    "slug": "wheel_type",
    "name": "Руль",
    "mandatory": true,
    "group": "Технические характеристики",
    "config": {
      "type": "select",
      "options": [
        {
          "label": "Левый",
          "value": "levyy"
        },
        {
          "label": "Правый",
          "value": "pravyy"
        }
      ],
      "maxSelected": 1,
      "minSelected": 0,
      "translatable_options": false
    }
  },
  {
    "slug": "power_steering",
    "name": "Усилитель руля",
    "mandatory": false,
    "group": "Опции",
    "config": {
      "type": "select",
      "options": [
        {
          "label": "Гидравлический",
          "value": "gidravlicheskiy"
        },
        {
          "label": "Электрический",
          "value": "elektricheskiy"
        },
        {
          "label": "Электрогидравлический",
          "value": "elektrogidravlicheskiy"
        }
      ],
      "maxSelected": 1,
      "minSelected": 0,
      "translatable_options": false
    }
  },
  {
    "slug": "heating",
    "name": "Обогрев",
    "mandatory": false,
    "group": "Опции",
    "config": {
      "type": "select",
      "options": [
        {
          "label": "Передних сидений",
          "value": "perednih-sideniy"
        },
        {
          "label": "Задних сидений",
          "value": "zadnih-sideniy"
        },
        {
          "label": "Зеркал",
          "value": "zerkal"
        },
        {
          "label": "Заднего стекла",
          "value": "zadnego-stekla"
        },
        {
          "label": "Руля",
          "value": "rulya"
        }
      ],
      "maxSelected": null,
      "minSelected": 0,
      "translatable_options": false
    }
  },
  {
    "slug": "ad_type",
    "name": "Вид объявления",
    "mandatory": true,
    "group": "Общее описание автомобиля",
    "config": {
      "type": "select",
      "options": [
        {
          "label": "Продаю личный автомобиль",
          "value": "prodayu-lichnyy-avtomobil"
        },
        {
          "label": "Автомобиль приобретён на продажу",
          "value": "avtomobil-priobreten-na-prodazhu"
        }
      ],
      "maxSelected": 1,
      "minSelected": 0,
      "translatable_options": false
    }
  }
];

/** The live answer as a whole response, with the two cars listed. */
export function liveCarsResponse(
  overrides: Partial<SearchResponse> = {}
): SearchResponse {
  return searchResponse({
    facets: LIVE.facets,
    facet_labels: LIVE.facet_labels,
    facet_meta: LIVE.facet_meta,
    count: 3,
    ...overrides,
  });
}
