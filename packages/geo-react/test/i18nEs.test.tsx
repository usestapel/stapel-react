/**
 * The Spanish bundle: complete over the pair's own keys, and actually used.
 *
 * `stapel/i18n-locale-parity` reads these files as text at lint time; this
 * suite proves the same thing at RUNTIME, through the engine, which is the
 * only way to catch a key that is present but registered under the wrong
 * locale — a bundle nobody can reach is not a translation.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { createI18n } from "@stapel/core";
import { GEO_I18N_KEYS, geoI18nBundleEn } from "../src/i18n/keys.js";
import { geoI18nBundleEs, registerGeoI18nEs } from "../src/i18n/es.js";
import { geoErrorBundleEs } from "../src/i18n/generated/errors.es.gen.js";
import { LocationPickerField } from "../src/default/LocationPickerField.js";
import {
  CONFIG_URL,
  RESOLVE_URL,
  SEARCH_URL,
  features,
  mapConfig,
  resolution,
  wrap,
} from "./helpers.js";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** The eight codes stapel_geo owns — the ones the module ships no locale for. */
const OWNED = [
  "error.400.geohash_required",
  "error.400.invalid_bbox",
  "error.400.invalid_geojson",
  "error.400.invalid_import_status",
  "error.400.invalid_params",
  "error.400.lat_lon_required",
  "error.400.uuid_required",
  "error.502.geocoder_unavailable",
] as const;

describe("the es bundle", () => {
  it("covers every key the pair defines", () => {
    for (const key of Object.values(GEO_I18N_KEYS)) {
      expect(geoI18nBundleEs[key], key).toBeDefined();
      expect(String(geoI18nBundleEs[key]).length).toBeGreaterThan(0);
    }
  });

  it("is actually translated — no English left standing in an es bundle", () => {
    for (const key of Object.values(GEO_I18N_KEYS)) {
      const es = String(geoI18nBundleEs[key]);
      const en = String(geoI18nBundleEn[key]);
      // The coordinate template is the same in every language on purpose.
      if (key === GEO_I18N_KEYS.pickerCoordinates) continue;
      expect(es, key).not.toBe(en);
    }
  });

  it("keeps every `{placeholder}` slot the en bundle spells", () => {
    const slots = (text: string) => (text.match(/\{[a-z_]+\}/g) ?? []).sort();
    for (const key of Object.values(GEO_I18N_KEYS)) {
      expect(slots(String(geoI18nBundleEs[key])), key).toEqual(
        slots(String(geoI18nBundleEn[key]))
      );
    }
  });

  it("carries the eight backend codes stapel-geo owns and does not localize", () => {
    for (const code of OWNED) {
      // Absent from the GENERATED bundle — the module ships no translations/.
      expect(code in geoErrorBundleEs, code).toBe(false);
      // Authored by the pair until upstream localizes them.
      expect(geoI18nBundleEs[code], code).toBeDefined();
    }
  });

  it("keeps the two load-bearing sentences non-alarming and non-final", () => {
    // "The map still works — you can place the pin yourself."
    expect(geoI18nBundleEs[GEO_I18N_KEYS.geocoderUnauthorized]).toContain(
      "El mapa sigue funcionando"
    );
    // "The coordinates are still saved."
    expect(geoI18nBundleEs[GEO_I18N_KEYS.pickerNoAddress]).toContain("Las coordenadas");
  });

  it("registers under `es` and renders the skin in Spanish", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    const tree = wrap(<LocationPickerField mode="inline" />, "es");
    // The pair's en floor is registered by `wrap`; the es bundle is opt-in and
    // a host registers it exactly like this.
    const engine = createI18n({ locale: "es" });
    registerGeoI18nEs(engine);
    expect(engine.t(GEO_I18N_KEYS.pickerConfirm)).toBe("Usar esta ubicación");

    render(tree);
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    // Without the es bundle registered the engine falls back to the key
    // itself, never to a stray English sentence in a Spanish screen.
    expect(screen.getByTestId("geo-confirm").textContent).not.toBe("");
  });
});
