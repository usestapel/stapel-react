/**
 * `<LocationPickerField/>` — the one component a product mounts.
 *
 * The whole point of this file is that the picker degrades WITHOUT hiding the
 * map: an anonymous visitor, a throttled one, a lake with no address and a
 * refused position prompt each leave the map and the pin working, because the
 * coordinate never depended on the geocoder. The one state that removes the
 * map is a failed `map/config`, because then there is no tile template.
 *
 * Everything crosses a real HTTP boundary (MSW, contract bodies).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocationPickerField } from "../src/default/LocationPickerField.js";
import type { PickedLocation } from "../src/headless/useLocationPicker.js";
import {
  CONFIG_URL,
  RESOLVE_URL,
  SEARCH_URL,
  envelope,
  features,
  mapConfig,
  nowhere,
  resolution,
  withGeolocation,
  withoutGeolocation,
  wrap,
} from "./helpers.js";
import { resizeTo } from "./resizeDriver.js";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  window.innerWidth = 1024;
});
afterAll(() => {
  server.close();
});

/** Config + a resolve that always answers — the ordinary deployment. */
function happyPath(configOverrides?: Record<string, unknown>): void {
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json(mapConfig(configOverrides))),
    http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
    http.get(SEARCH_URL, () => HttpResponse.json(features([])))
  );
}

describe("<LocationPickerField/> — map/config", () => {
  it("holds the map's exact shape while the config loads, so nothing jumps", async () => {
    happyPath();
    render(wrap(<LocationPickerField mode="inline" height={320} />));
    const placeholder = screen.getByTestId("geo-map-placeholder");
    expect(placeholder.style.height).toBe("320px");
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    expect((screen.getByTestId("geo-map") as HTMLElement).style.height).toBe("320px");
  });

  it("renders NO map and a retry when the config fails — there is no tile template", async () => {
    let attempts = 0;
    server.use(
      http.get(CONFIG_URL, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(envelope("error.500.internal", "Something went wrong"), {
              status: 500,
            })
          : HttpResponse.json(mapConfig());
      }),
      http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-config-error")).toBeDefined();
    });
    expect(screen.getByTestId("geo-config-error").textContent).toContain(
      "map could not be loaded"
    );
    expect(screen.queryByTestId("geo-map")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
  });

  it("opens on the deployment's default_center, in lat/lon order", async () => {
    happyPath();
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-coordinates")).toBeDefined();
    });
    // `default_center: [52.51667, 13.38333]` is [lat, lon] — the one field in
    // this contract that looks like a GeoJSON pair and is not.
    expect(screen.getByTestId("geo-coordinates").textContent).toBe("52.51667, 13.38333");
  });

  it("always renders the attribution the licence requires", async () => {
    happyPath();
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(document.querySelector("[data-geo-attribution]")).not.toBeNull();
    });
    expect(document.querySelector("[data-geo-attribution]")?.textContent).toContain(
      "OpenStreetMap"
    );
  });

  it("draws tiles from the config's own template once the element has a box", async () => {
    happyPath();
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    act(() => {
      resizeTo(512, 384);
    });
    const image = document.querySelector("img");
    expect(image?.getAttribute("src")).toMatch(/^https:\/\/tile\.openstreetmap\.org\/13\//);
  });
});

describe("<LocationPickerField/> — the resolved address", () => {
  it("shows the server's `formatted` line for the pin", async () => {
    happyPath();
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(document.querySelector('[data-geo-resolve="resolved"]')?.textContent).toBe(
        "Unter den Linden, 1, Berlin, Deutschland"
      );
    });
  });

  it("says 'no address here, the coordinates are still saved' over a lake", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () => HttpResponse.json(nowhere())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(document.querySelector('[data-geo-resolve="nowhere"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-geo-resolve="nowhere"]')?.textContent).toContain(
      "coordinates are still saved"
    );
    // A successful call. Not an error, and the coordinate is still on screen.
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(screen.getByTestId("geo-coordinates")).toBeDefined();
  });

  it("states the anonymous case and keeps the map — 401 is a configuration fact", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () =>
        HttpResponse.json(envelope("error.401.unauthorized", "Authentication required"), {
          status: 401,
        })
      ),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(document.querySelector('[data-geo-resolve="unauthorized"]')).not.toBeNull();
    });
    expect(screen.getByTestId("geo-map")).toBeDefined();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("states a 502 as retryable, with the map still there", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () =>
        HttpResponse.json(
          envelope("error.502.geocoder_unavailable", "The geocoder is unavailable"),
          { status: 502 }
        )
      ),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-resolve-error")).toBeDefined();
    });
    expect(screen.getByTestId("geo-map")).toBeDefined();
  });

  it("hands the product the geohash the SERVER stamped, and null when it could not", async () => {
    happyPath();
    const changes: PickedLocation[] = [];
    const { unmount } = render(
      wrap(
        <LocationPickerField
          mode="inline"
          onChange={(picked) => {
            changes.push(picked);
          }}
        />
      )
    );
    await waitFor(() => {
      expect(changes.some((picked) => picked.geohash === "u33dc0cp")).toBe(true);
    });
    unmount();

    server.resetHandlers();
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () =>
        HttpResponse.json(envelope("error.403.forbidden", "Forbidden"), { status: 403 })
      ),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    const anonymous: PickedLocation[] = [];
    render(
      wrap(
        <LocationPickerField
          mode="inline"
          onChange={(picked) => {
            anonymous.push(picked);
          }}
        />
      )
    );
    await waitFor(() => {
      expect(document.querySelector('[data-geo-resolve="unauthorized"]')).not.toBeNull();
    });
    // The coordinate is always real; the geohash is the server's or nothing.
    // Nothing here computes one client-side at a second precision.
    for (const picked of anonymous) {
      expect(picked.geohash).toBeNull();
      expect(Number.isFinite(picked.point.lat)).toBe(true);
    }
  });

  it("moves the pin to a chosen suggestion, at the deployment's picked_zoom", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
      http.get(SEARCH_URL, () =>
        HttpResponse.json(
          features([["Alexanderplatz, Berlin, Deutschland", 13.41314, 52.52182, 7]])
        )
      )
    );
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    fireEvent.change(screen.getByTestId("geo-search-input"), {
      target: { value: "Alexanderplatz" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("geo-suggestion")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("geo-suggestion"));
    await waitFor(() => {
      expect(screen.getByTestId("geo-coordinates").textContent).toBe("52.52182, 13.41314");
    });
    expect(screen.getByTestId("geo-map").getAttribute("data-geo-zoom")).toBe("17");
  });
});

describe("<LocationPickerField/> — the browser's position", () => {
  it("offers the prompt when the deployment allows it and the browser has it", async () => {
    happyPath();
    const restore = withGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 55.7558, longitude: 37.6173, accuracy: 30 } });
    });
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-locate")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("geo-locate"));
    await waitFor(() => {
      expect(screen.getByTestId("geo-coordinates").textContent).toBe("55.75580, 37.61730");
    });
    restore();
  });

  it("does not render the control at all when the deployment turned it off", async () => {
    happyPath({ geolocation: false });
    const restore = withGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 1, longitude: 1 } });
    });
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    expect(screen.queryByTestId("geo-locate")).toBeNull();
    restore();
  });

  it("does not render the control at all where the browser has no API", async () => {
    happyPath();
    const restore = withoutGeolocation();
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    // Not disabled-with-an-explanation: a door that was never there.
    expect(screen.queryByTestId("geo-locate")).toBeNull();
    restore();
  });

  for (const [code, outcome, fragment] of [
    [1, "denied", "browser settings"],
    [2, "unavailable", "could not work out where it is"],
    [3, "timeout", "took too long"],
  ] as const) {
    it(`says its own sentence for a ${outcome} position`, async () => {
      happyPath();
      const restore = withGeolocation((_onSuccess, onError) => {
        onError({ code });
      });
      render(wrap(<LocationPickerField mode="inline" />));
      await waitFor(() => {
        expect(screen.getByTestId("geo-locate")).toBeDefined();
      });
      fireEvent.click(screen.getByTestId("geo-locate"));
      await waitFor(() => {
        expect(screen.getByTestId("geo-position-refused")).toBeDefined();
      });
      const refusal = screen.getByTestId("geo-position-refused");
      expect(refusal.getAttribute("data-geo-position-state")).toBe(outcome);
      expect(refusal.textContent).toContain(fragment);
      // As text beside the control, never in a tooltip or a title.
      expect(refusal.getAttribute("title")).toBeNull();
      // And the map is untouched by any of it.
      expect(screen.getByTestId("geo-map")).toBeDefined();
      restore();
    });
  }
});

describe("<LocationPickerField/> — the dialog surface", () => {
  it("is a bottom SHEET on a phone", async () => {
    window.innerWidth = 390;
    happyPath();
    render(wrap(<LocationPickerField />));
    fireEvent.click(screen.getByTestId("geo-open"));
    await waitFor(() => {
      expect(screen.getByTestId("geo-picker-dialog")).toBeDefined();
    });
    expect(
      screen.getByTestId("geo-picker-dialog").getAttribute("data-stapel-dialog-surface")
    ).toBe("sheet");
  });

  it("is a centred MODAL on a desktop", async () => {
    window.innerWidth = 1024;
    happyPath();
    render(wrap(<LocationPickerField />));
    fireEvent.click(screen.getByTestId("geo-open"));
    await waitFor(() => {
      expect(screen.getByTestId("geo-picker-dialog")).toBeDefined();
    });
    expect(
      screen.getByTestId("geo-picker-dialog").getAttribute("data-stapel-dialog-surface")
    ).toBe("modal");
  });

  it("confirms, closes, and shows the chosen place back on the form", async () => {
    happyPath();
    const confirmed: PickedLocation[] = [];
    render(
      wrap(
        <LocationPickerField
          onConfirm={(picked) => {
            confirmed.push(picked);
          }}
        />
      )
    );
    fireEvent.click(screen.getByTestId("geo-open"));
    await waitFor(() => {
      expect(document.querySelector('[data-geo-resolve="resolved"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByTestId("geo-confirm"));
    await waitFor(() => {
      expect(confirmed).toHaveLength(1);
    });
    expect(confirmed[0]?.geohash).toBe("u33dc0cp");
    expect(confirmed[0]?.address).toBe("Unter den Linden, 1, Berlin, Deutschland");
    await waitFor(() => {
      expect(screen.getByTestId("geo-chosen").textContent).toContain("Unter den Linden");
    });
  });
});

describe("<LocationPickerField/> — the skin themes itself", () => {
  it("mounts its own theme root rather than inheriting the host's page", async () => {
    happyPath();
    render(wrap(<LocationPickerField mode="inline" />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeDefined();
    });
    expect(document.querySelector("[data-geo-skin-root]")).not.toBeNull();
    expect(document.querySelector("[data-stapel-skin-root]")).not.toBeNull();
  });
});

describe("<LocationPickerField/> — an address the form already holds", () => {
  /**
   * A stored point arrives with a stored address. Re-asking the geocoder for
   * it is one authenticated call per mount of every edit screen, and under the
   * deployment's default permissions it is worse than wasteful: a signed-out
   * visitor would be told the address is unavailable while it sits in the
   * field above. So `resolution` seeds the confirmation line and suppresses
   * exactly one request — the redundant one.
   */
  it("opens on the stored address WITHOUT asking the geocoder again", async () => {
    let resolveCalls = 0;
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([]))),
      http.get(RESOLVE_URL, () => {
        resolveCalls += 1;
        return HttpResponse.json(resolution());
      })
    );
    render(
      wrap(
        <LocationPickerField
          mode="inline"
          height={320}
          value={{ lat: 52.51667, lon: 13.38333 }}
          resolution={resolution() as never}
        />
      )
    );

    // On screen from the first frame the map is — not after a round trip.
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeTruthy();
    });
    expect(screen.getByText("Unter den Linden, 1, Berlin, Deutschland")).toBeTruthy();

    // Well past the 400 ms settle: the request that would have re-answered a
    // question already answered never goes out.
    await act(async () => {
      await new Promise((done) => setTimeout(done, 700));
    });
    expect(resolveCalls).toBe(0);
  });

  it("a stored answer with no address is `nowhere`, not a failure", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([]))),
      http.get(RESOLVE_URL, () => HttpResponse.json(resolution()))
    );
    render(
      wrap(
        <LocationPickerField
          mode="inline"
          height={320}
          value={{ lat: 54.8, lon: 15.2 }}
          resolution={nowhere() as never}
        />
      )
    );
    await waitFor(() => {
      expect(document.querySelector('[data-geo-resolve="nowhere"]')).not.toBeNull();
    });
    // An empty answer is an empty state: no alert, and the coordinates stay.
    expect(screen.queryByTestId("geo-resolve-error")).toBeNull();
    expect(screen.getByTestId("geo-coordinates")).toBeTruthy();
  });

  it("moving the pin re-resolves — the seed suppresses one request, not the seam", async () => {
    let resolveCalls = 0;
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([]))),
      http.get(RESOLVE_URL, () => {
        resolveCalls += 1;
        return HttpResponse.json(resolution({ formatted: "Alexanderplatz, Berlin" }));
      })
    );
    render(
      wrap(
        <LocationPickerField
          mode="inline"
          height={320}
          value={{ lat: 52.51667, lon: 13.38333 }}
          resolution={resolution() as never}
        />
      )
    );
    const map = await screen.findByTestId("geo-map");

    // An arrow key is a camera move, and the pin IS the centre.
    fireEvent.keyDown(map, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByText("Alexanderplatz, Berlin")).toBeTruthy();
    });
    expect(resolveCalls).toBeGreaterThan(0);
  });
});
