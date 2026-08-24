import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { ReactElement, ReactNode } from "react";
import { AvailabilityPane } from "../src/default/index.js";
import { CalendarAgenda } from "../src/default/index.js";
import { RecurrenceField } from "../src/default/index.js";
import { CalendarProvider, createCalendarRuntime, registerCalendarI18n } from "../src/index.js";
import { registerCalendarI18nRu } from "../src/i18n/ru.js";
import { registerCalendarI18nEs } from "../src/i18n/es.js";
import { CALENDAR_I18N_KEYS, calendarI18nBundleEn } from "../src/i18n/keys.js";
import { calendarI18nBundleRu } from "../src/i18n/ru.js";
import { calendarI18nBundleEs } from "../src/i18n/es.js";
import { NO_RECURRENCE } from "../src/index.js";
import type { CalendarInstance } from "../src/index.js";

/** A canned transport: the skin tests are about what is DRAWN, not about the
 * wire, so every read answers an empty range rather than a network. */
const emptyFetch = ((): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify({ events: [], occurrences: [], busy: [], slots: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  )) as typeof globalThis.fetch;

function Wrap(props: { children: ReactNode; locale?: string }): ReactElement {
  const engine = createI18n({ locale: props.locale ?? "en" });
  registerCalendarI18n(engine);
  registerCalendarI18nRu(engine);
  registerCalendarI18nEs(engine);
  const runtime = createCalendarRuntime({
    baseUrl: "https://calendar.test/calendar/api/v1/",
    fetch: emptyFetch,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={engine}>
        <CalendarProvider runtime={runtime}>{props.children}</CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const INSTANCE: CalendarInstance = {
  key: "e-1",
  eventId: "e-1",
  seriesId: null,
  title: "Design review",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T11:00:00Z",
  status: "confirmed",
  isVirtual: false,
  event: null,
};

describe("the agenda renders times through the formatter, never raw ISO", () => {
  it("shows a formatted time and no ISO string", () => {
    render(
      <Wrap>
        <CalendarAgenda instances={[INSTANCE]} />
      </Wrap>
    );
    expect(screen.getByText("Design review")).toBeDefined();
    expect(document.body.textContent).not.toContain("2026-07-13T10:00:00Z");
  });

  it("names an empty agenda instead of drawing nothing", () => {
    render(
      <Wrap>
        <CalendarAgenda instances={[]} />
      </Wrap>
    );
    expect(screen.getByTestId("calendar-agenda-empty")).toBeDefined();
  });
});

describe("theme sides (the skin self-themes; no hardcoded light)", () => {
  it("renders dark when the document is dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(
      <Wrap>
        <AvailabilityPane />
      </Wrap>
    );
    const root = screen.getByTestId("calendar-availability-root");
    expect(root.getAttribute("data-stapel-skin-mode")).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders light when the document is light", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(
      <Wrap>
        <AvailabilityPane />
      </Wrap>
    );
    expect(
      screen.getByTestId("calendar-availability-root").getAttribute("data-stapel-skin-mode")
    ).toBe("light");
    document.documentElement.removeAttribute("data-theme");
  });
});

describe("the recurrence editor never offers `until` and `count` at once", () => {
  it("shows only the chosen end field", () => {
    const { rerender } = render(
      <Wrap>
        <RecurrenceField
          value={{ ...NO_RECURRENCE, type: "weekly", end: "until" }}
          onChange={() => undefined}
        />
      </Wrap>
    );
    expect(screen.queryByTestId("calendar-recurrence-until")).not.toBeNull();
    expect(screen.queryByTestId("calendar-recurrence-count")).toBeNull();

    rerender(
      <Wrap>
        <RecurrenceField
          value={{ ...NO_RECURRENCE, type: "weekly", end: "count" }}
          onChange={() => undefined}
        />
      </Wrap>
    );
    expect(screen.queryByTestId("calendar-recurrence-count")).not.toBeNull();
    expect(screen.queryByTestId("calendar-recurrence-until")).toBeNull();
  });
});

describe("locale parity (the locale-parity rule, as a test)", () => {
  const uiKeys = Object.values(CALENDAR_I18N_KEYS).filter(
    (key) => !key.startsWith("error.")
  );
  const plural = new Set(["one", "few", "many", "two", "zero", "other"]);
  const has = (bundle: Record<string, string>, key: string): boolean =>
    bundle[key] !== undefined ||
    Object.keys(bundle).some(
      (k) => k.startsWith(`${key}.`) && plural.has(k.slice(key.length + 1))
    );

  for (const [name, bundle] of [
    ["ru", calendarI18nBundleRu],
    ["es", calendarI18nBundleEs],
  ] as const) {
    it(`${name} covers every UI key en defines`, () => {
      const missing = uiKeys.filter((key) => !has(bundle, key));
      expect(missing).toEqual([]);
    });
  }

  it("en covers every UI key it declares", () => {
    const missing = uiKeys.filter((key) => !has(calendarI18nBundleEn, key));
    expect(missing).toEqual([]);
  });

  it("the mandate refusal has copy in all three locales", () => {
    for (const bundle of [calendarI18nBundleEn, calendarI18nBundleRu, calendarI18nBundleEs]) {
      expect(bundle["error.503.mandate_unavailable"]).toBeTruthy();
    }
  });
});
