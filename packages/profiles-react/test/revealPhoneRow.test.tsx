/**
 * THE REVEALED NUMBER IS ONE LINE IN THE BUTTON'S OWN BOX — AND THE ROW SAYS
 * HOW LOUD IT IS.
 *
 * Two rulings, both surfaced by a client fleet's contact dock:
 *
 *  1. The number replaces the button IN PLACE, so a row that wrapped would
 *     make the dock taller the moment the number arrived — the page moving
 *     under the person who just pressed the button. The row therefore never
 *     wraps, the copy control is icon-only, and the label's WORD is dropped
 *     below `CONTACT_REVEAL_LABEL_MIN_WIDTH`, surviving on the `tel:` link's
 *     `aria-label`/`title`.
 *
 *  2. A row with two filled primaries is one decision drawn twice, and which
 *     control carries the brand's fill is the container's call — `emphasis`.
 *
 * The width is the ROW's own and never the viewport's, so the observer is
 * DRIVEN here (jsdom lays nothing out): 320 and 390 are a phone's dock, 1440 a
 * block wide enough to spell the label.
 */
// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import {
  CONTACT_REVEAL_LABEL_MIN_WIDTH,
  RevealPhoneButton,
} from "../src/default/index.js";
import {
  installResizeObserver,
  resetResizeObservers,
  resizeTo,
} from "./resizeDriver.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";
const OWNER = "1c7e4b90-2222-4000-8000-000000000002";
const PHONE = { label: "Мобильный", value: "+79990000001" };

/** The widths the owner's two surfaces are actually drawn at. */
const PHONE_DOCK = 320;
const PHONE_WIDE = 390;
const DESKTOP_BLOCK = 1440;

const server = setupServer();
let previousObserver: typeof ResizeObserver;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  previousObserver = installResizeObserver();
});
beforeEach(() => {
  server.use(
    http.post(`${BASE}/contacts/reveal`, () =>
      HttpResponse.json({ phones: [PHONE] })
    )
  );
});
afterEach(() => {
  cleanup();
  resetResizeObservers();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  globalThis.ResizeObserver = previousObserver;
});

function wrap(children: ReactNode): ReactElement {
  const runtime = createProfilesRuntime({ baseUrl: BASE });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** Press the button at a given box width and wait for the number. */
async function revealAt(width: number): Promise<HTMLElement> {
  render(wrap(<RevealPhoneButton ownerKey={OWNER} />));
  // The box is measured before the press, exactly as a browser would report
  // it for a control that is already on screen.
  act(() => {
    resizeTo(width);
  });
  fireEvent.click(screen.getByTestId("reveal-phone-button"));
  return screen.findByTestId("revealed-phone");
}

describe("the revealed number keeps one line in its own box", () => {
  it.each([PHONE_DOCK, PHONE_WIDE])(
    "is one flex line with no visible label at %ipx",
    async (width) => {
      const row = await revealAt(width);

      // ONE LINE: the row declares it, rather than inheriting whatever the
      // container happened to say.
      expect(row.style.flexWrap).toBe("nowrap");
      expect(getComputedStyle(row).flexWrap).toBe("nowrap");

      // The label is not a visible word anywhere in the row…
      expect(screen.queryByTestId("revealed-phone-label")).toBeNull();
      expect(row.textContent).not.toContain(PHONE.label);

      // …but it is still carried, for a screen reader and for a hover.
      const link = row.querySelector("a");
      expect(link?.getAttribute("href")).toBe(`tel:${PHONE.value}`);
      expect(link?.getAttribute("aria-label")).toContain(PHONE.label);
      expect(link?.getAttribute("title")).toContain(PHONE.label);

      // The copy control is the icon, and its words are its accessible name.
      const copy = screen.getByTestId("revealed-phone-copy");
      expect(copy.textContent).toBe("");
      expect(copy.getAttribute("aria-label")).toBe("Copy");
      expect(copy.querySelector("svg")).toBeTruthy();
    }
  );

  it(`spells the label in a box of ${String(DESKTOP_BLOCK)}px`, async () => {
    const row = await revealAt(DESKTOP_BLOCK);
    expect(screen.getByTestId("revealed-phone-label").textContent).toBe(
      PHONE.label
    );
    expect(row.textContent).toContain(PHONE.label);
    // Still one line — the label is what a wide box has room for, not a
    // licence to wrap.
    expect(row.style.flexWrap).toBe("nowrap");
    // A hover title would now repeat a word that is already on screen.
    expect(row.querySelector("a")?.getAttribute("title")).toBeNull();
  });

  it("puts the threshold between the phone's dock and a wide block", () => {
    expect(CONTACT_REVEAL_LABEL_MIN_WIDTH).toBeGreaterThan(PHONE_WIDE);
    expect(CONTACT_REVEAL_LABEL_MIN_WIDTH).toBeLessThan(DESKTOP_BLOCK);
  });
});

describe("emphasis is the container's call, and the default is unchanged", () => {
  /** What antd paints for each emphasis, as the two classes it writes. */
  const SOLID = ["ant-btn-color-primary", "ant-btn-variant-solid"];
  const TINTED = ["ant-btn-color-default", "ant-btn-variant-filled"];

  it("draws the brand's solid fill when nothing is asked for", async () => {
    render(wrap(<RevealPhoneButton ownerKey={OWNER} />));
    const button = await screen.findByTestId("reveal-phone-button");
    for (const one of SOLID) expect(button.classList.contains(one)).toBe(true);
    for (const one of TINTED) expect(button.classList.contains(one)).toBe(false);
  });

  it("draws the same fill when the primary emphasis is stated", async () => {
    render(wrap(<RevealPhoneButton ownerKey={OWNER} emphasis="primary" />));
    const button = await screen.findByTestId("reveal-phone-button");
    for (const one of SOLID) expect(button.classList.contains(one)).toBe(true);
  });

  it("draws antd's tinted pair for the secondary emphasis", async () => {
    render(wrap(<RevealPhoneButton ownerKey={OWNER} emphasis="secondary" />));
    const button = await screen.findByTestId("reveal-phone-button");
    for (const one of TINTED) expect(button.classList.contains(one)).toBe(true);
    for (const one of SOLID) expect(button.classList.contains(one)).toBe(false);
  });

  it("keeps the emphasis on the arm that is switched off with its reason", async () => {
    render(
      wrap(
        <RevealPhoneButton ownerKey={OWNER} available={false} emphasis="secondary" />
      )
    );
    const button = await screen.findByTestId("reveal-phone-button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    for (const one of TINTED) expect(button.classList.contains(one)).toBe(true);
  });
});
