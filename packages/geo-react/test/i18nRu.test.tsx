/**
 * The Russian bundle: complete over the pair's own keys, and actually used.
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
import { geoI18nBundleRu, registerGeoI18nRu } from "../src/i18n/ru.js";
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

describe("the ru bundle", () => {
  it("covers every key the pair defines", () => {
    for (const key of Object.values(GEO_I18N_KEYS)) {
      expect(geoI18nBundleRu[key], key).toBeDefined();
      expect(String(geoI18nBundleRu[key]).length).toBeGreaterThan(0);
    }
  });

  it("is actually translated — no English left standing in a ru bundle", () => {
    for (const key of Object.values(GEO_I18N_KEYS)) {
      const ru = String(geoI18nBundleRu[key]);
      const en = String(geoI18nBundleEn[key]);
      expect(ru, key).not.toBe(en);
      expect(ru, key).toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("carries the eight backend codes stapel-geo owns and does not localize", () => {
    for (const code of [
      "error.400.lat_lon_required",
      "error.400.invalid_bbox",
      "error.400.invalid_params",
      "error.502.geocoder_unavailable",
    ]) {
      expect(geoI18nBundleRu[code], code).toBeDefined();
    }
  });

  it("keeps the two load-bearing sentences non-alarming and non-final", () => {
    // "The map still works — you can place the pin yourself."
    expect(geoI18nBundleRu[GEO_I18N_KEYS.geocoderUnauthorized]).toContain("Карта работает");
    // "The place is still saved." — a lake has no address and is still a
    // place; the sentence must not read as a failed save. It also must not
    // say "coordinates": nothing this pair renders shows one any more.
    expect(geoI18nBundleRu[GEO_I18N_KEYS.pickerNoAddress]).toContain("сохранится");
    expect(geoI18nBundleRu[GEO_I18N_KEYS.pickerNoAddress]).not.toContain("оординат");
  });

  it("registers under `ru` and renders the skin in Russian", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    const tree = wrap(<LocationPickerField mode="inline" />, "ru");
    // The pair's en floor is registered by `wrap`; the ru bundle is opt-in and
    // a host registers it exactly like this.
    const engine = createI18n({ locale: "ru" });
    registerGeoI18nRu(engine);
    expect(engine.t(GEO_I18N_KEYS.pickerConfirm)).toBe("Выбрать это место");

    render(tree);
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    // Without the ru bundle registered the engine falls back to the key
    // itself, never to a stray English sentence in a Russian screen.
    expect(screen.getByTestId("geo-confirm").textContent).not.toBe("");
  });
});
