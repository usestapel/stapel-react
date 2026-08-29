/**
 * `<LocationField/>` — the field, and the ladder behind one tap.
 *
 * The claims worth a test, in the order a person meets them:
 *
 *  1. empty, it asks; filled, it HOLDS the answer inside itself. Not under it,
 *     which is how a filled form went on looking empty.
 *  2. no latitude and no longitude reaches the screen in any state. That is
 *     the original defect and the only reason this pair exists, so it is
 *     asserted against the rendered text rather than against a component.
 *  3. one tap runs the ladder: granted goes to the browser; unasked opens the
 *     pre-prompt FIRST; refused goes straight to the map on the IP centre,
 *     without asking a question the browser will not answer again.
 *  4. a refusal is never a dead end.
 *
 * Everything crosses a real HTTP boundary (MSW, contract bodies).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocationField } from "../src/default/LocationField.js";
import {
  CONFIG_URL,
  IP_URL,
  RESOLVE_URL,
  SEARCH_URL,
  envelope,
  features,
  ipFallback,
  ipLocation,
  mapConfig,
  resolution,
  withGeolocation,
  withPermissions,
  withoutGeolocation,
  wrap,
} from "./helpers.js";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

/** Config + IP + resolve + search all answering — the ordinary deployment. */
function happyPath(ip: Record<string, unknown> = ipLocation()): void {
  server.use(
    http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
    http.get(IP_URL, () => HttpResponse.json(ip)),
    http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
    http.get(SEARCH_URL, () => HttpResponse.json(features([])))
  );
}

async function fieldReady(): Promise<HTMLElement> {
  return await waitFor(() => screen.getByTestId("geo-field-input"));
}

describe("<LocationField/> — the field itself", () => {
  it("asks the question when empty", async () => {
    happyPath();
    render(wrap(<LocationField />));
    const field = await fieldReady();
    expect(field.getAttribute("placeholder")).toBe("Choose a location");
    expect((field as HTMLInputElement).value).toBe("");
    expect(field.getAttribute("data-geo-field")).toBe("empty");
  });

  it("holds the chosen address INSIDE itself, not underneath", async () => {
    happyPath();
    render(
      wrap(
        <LocationField
          value={{
            point: { lat: 52.51667, lon: 13.38333 },
            address: "Unter den Linden, 1, Berlin, Deutschland",
          }}
        />
      )
    );
    const field = await fieldReady();
    expect((field as HTMLInputElement).value).toBe(
      "Unter den Linden, 1, Berlin, Deutschland"
    );
    expect(field.getAttribute("data-geo-field")).toBe("chosen");
  });

  it("a chosen place with no address still reads as answered", async () => {
    happyPath();
    render(wrap(<LocationField value={{ point: { lat: 54.8, lon: 15.2 } }} />));
    const field = await fieldReady();
    // The middle of a lake is a place. What the field must NOT do is look
    // unanswered because the geocoder had nothing to say about it.
    expect((field as HTMLInputElement).value).toBe("A place on the map, with no address");
    expect(field.getAttribute("data-geo-field")).toBe("chosen");
  });

  it("never puts a coordinate on screen — the defect this pair exists to undo", async () => {
    happyPath();
    render(
      wrap(
        <LocationField
          value={{ point: { lat: 52.51667, lon: 13.38333 }, address: "Unter den Linden" }}
        />
      )
    );
    await fieldReady();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("52.51");
    expect(text).not.toContain("13.38");
  });

  it("says where the map will open from, when a city was guessed from an address", async () => {
    happyPath();
    render(wrap(<LocationField />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-field-origin").textContent).toContain("Moscow, Russia");
    });
  });

  it("claims no city when the server admits it could not place the caller", async () => {
    // `ip_resolved: false` is the deployment's default centre wearing the same
    // shape. Announcing it as "near you" would be the lie the flag prevents.
    happyPath(ipFallback());
    render(wrap(<LocationField />));
    await fieldReady();
    await waitFor(() => {
      expect(screen.queryByTestId("geo-field-origin")).toBeNull();
    });
  });

  it("offers no door at all when there is no tile template to open one onto", async () => {
    server.use(
      http.get(CONFIG_URL, () =>
        HttpResponse.json(envelope("error.503.unavailable", "Unavailable"), { status: 503 })
      ),
      http.get(IP_URL, () => HttpResponse.json(ipLocation()))
    );
    render(wrap(<LocationField />));
    await waitFor(() => {
      expect(screen.getByTestId("geo-field-error")).toBeTruthy();
    });
    expect(screen.queryByTestId("geo-field-input")).toBeNull();
  });
});

describe("<LocationField/> — one tap, and the ladder behind it", () => {
  it("opens the pre-prompt BEFORE the browser's own, when nobody has been asked", async () => {
    happyPath();
    const restorePermissions = withPermissions({ geolocation: "prompt" });
    const getCurrentPosition = vi.fn();
    const restoreGeo = withGeolocation(() => {
      getCurrentPosition();
    });
    render(wrap(<LocationField />));
    fireEvent.click(await fieldReady());

    await waitFor(() => {
      expect(screen.getByTestId("stapel-permission-allow")).toBeTruthy();
    });
    // The browser has NOT been touched: the whole point is that its one-shot
    // prompt fires after an explanation, not before one.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByTestId("geo-map")).toBeNull();
    restoreGeo();
    restorePermissions();
  });

  it("goes straight to the map, on the IP centre, for somebody who already said no", async () => {
    happyPath();
    const restorePermissions = withPermissions({ geolocation: "denied" });
    const restoreGeo = withGeolocation(() => undefined);
    render(wrap(<LocationField />));
    const field = await fieldReady();
    await waitFor(() => {
      expect(screen.getByTestId("geo-field-origin")).toBeTruthy();
    });
    fireEvent.click(field);

    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeTruthy();
    });
    // Their answer stands: no second pre-prompt, and the camera is the city
    // the server derived from their address.
    expect(screen.queryByTestId("stapel-permission-allow")).toBeNull();
    expect(screen.getByTestId("geo-map").getAttribute("data-geo-center")).toBe(
      "55.75580,37.61730"
    );
    restoreGeo();
    restorePermissions();
  });

  it("uses the browser's own fix when permission is already granted", async () => {
    happyPath();
    const restorePermissions = withPermissions({ geolocation: "granted" });
    const restoreGeo = withGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 20 } });
    });
    render(wrap(<LocationField />));
    fireEvent.click(await fieldReady());
    await waitFor(() => {
      expect(screen.getByTestId("geo-map").getAttribute("data-geo-center")).toBe(
        "48.85660,2.35220"
      );
    });
    restoreGeo();
    restorePermissions();
  });

  it("opens the map on the IP centre when the browser has no geolocation at all", async () => {
    happyPath();
    const restore = withoutGeolocation();
    render(wrap(<LocationField />));
    fireEvent.click(await fieldReady());
    await waitFor(() => {
      expect(screen.getByTestId("geo-map").getAttribute("data-geo-center")).toBe(
        "55.75580,37.61730"
      );
    });
    restore();
  });

  it("falls back to the deployment's own centre when the IP verb has nothing", async () => {
    server.use(
      http.get(CONFIG_URL, () => HttpResponse.json(mapConfig())),
      // 204: the deployment declined to have an opinion at all.
      http.get(IP_URL, () => new HttpResponse(null, { status: 204 })),
      http.get(RESOLVE_URL, () => HttpResponse.json(resolution())),
      http.get(SEARCH_URL, () => HttpResponse.json(features([])))
    );
    const restore = withoutGeolocation();
    render(wrap(<LocationField />));
    fireEvent.click(await fieldReady());
    await waitFor(() => {
      expect(screen.getByTestId("geo-map").getAttribute("data-geo-center")).toBe(
        "52.51667,13.38333"
      );
    });
    restore();
  });

  it("a refusal in the sheet is one tap from the map, not a dead end", async () => {
    happyPath();
    const restorePermissions = withPermissions({ geolocation: "prompt" });
    const restoreGeo = withGeolocation((_onSuccess, onError) => {
      onError({ code: 1 });
    });
    render(wrap(<LocationField />));
    fireEvent.click(await fieldReady());
    await waitFor(() => {
      expect(screen.getByTestId("stapel-permission-allow")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("stapel-permission-allow"));

    // The sheet stays and swaps to the guidance; the way forward is in it.
    await waitFor(() => {
      expect(screen.getByTestId("geo-field-permission-fallback")).toBeTruthy();
    });
    expect(screen.queryByTestId("stapel-permission-allow")).toBeNull();
    fireEvent.click(screen.getByTestId("geo-field-permission-fallback"));
    await waitFor(() => {
      expect(screen.getByTestId("geo-map")).toBeTruthy();
    });
    restoreGeo();
    restorePermissions();
  });

  it("does not open anything while disabled", async () => {
    happyPath();
    render(wrap(<LocationField disabled />));
    const field = await fieldReady();
    fireEvent.click(field);
    expect(screen.queryByTestId("geo-map")).toBeNull();
    expect(screen.queryByTestId("stapel-permission-allow")).toBeNull();
  });
});
