/**
 * The create sheet closes once the event exists.
 *
 * `onSave` read the mutation's result inside the click handler, where it is
 * still `null` (the answer lands on a later render), so `onSaved` never fired
 * and the "New event" dialog stayed open over "Event created." (Tier-0 e2e
 * D12).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { ReactElement, ReactNode } from "react";
import { EventEditorSheet } from "../src/default/index.js";
import { CalendarProvider, createCalendarRuntime, registerCalendarI18n } from "../src/index.js";

const CREATED = {
  id: "e-9",
  title: "Standup",
  description: "",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T11:00:00Z",
  owner_id: "u-1",
  scope_key: "",
  status: "confirmed",
  recurrence_type: "none",
  rrule: "",
  recurrence_parent_id: null,
  participants: [],
};

const fetchCreated = ((): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify(CREATED), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  )) as typeof globalThis.fetch;

function Wrap(props: { children: ReactNode }): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerCalendarI18n(engine);
  const runtime = createCalendarRuntime({
    baseUrl: "https://calendar.test/calendar/api/v1/",
    fetch: fetchCreated,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={engine}>
        <CalendarProvider runtime={runtime}>{props.children}</CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("<EventEditorSheet> in create mode", () => {
  it("reports the created event and closes", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <Wrap>
        <EventEditorSheet
          open
          onClose={onClose}
          onSaved={onSaved}
          defaultStart="2026-07-13T10:00:00Z"
        />
      </Wrap>
    );
    fireEvent.change(screen.getByTestId("calendar-editor-title"), {
      target: { value: "Standup" },
    });
    fireEvent.click(screen.getByTestId("calendar-editor-submit"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ id: "e-9" });
  });
});
