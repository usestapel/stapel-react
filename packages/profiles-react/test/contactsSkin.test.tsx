/**
 * The two contacts screens, rendered (the default skin IS the product).
 *
 * What is asserted here is what the owner ruled and what the wire promises:
 * a number is masked until its owner asks, an unverified number says it
 * reaches nobody, the policy picker is the SERVER's vocabulary, the button
 * becomes the numbers, a 403 opens the host's registration door, and a 429 is
 * spoken in minutes.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import { ContactsManager, RevealPhoneButton } from "../src/default/index.js";
import { retryAfterMinutes } from "../src/default/RevealPhoneButton.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";
const OWNER = "1c7e4b90-2222-4000-8000-000000000002";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const VERIFIED = {
  id: 7,
  kind: "phone",
  value: "+15550100",
  label: "Work",
  policy: "members",
  enabled: true,
  verified: true,
  verified_at: "2026-09-01T09:00:00Z",
  reveal_count: 128,
  created_at: "2026-08-30T08:00:00Z",
};

const UNVERIFIED = {
  ...VERIFIED,
  id: 8,
  value: "+15550199",
  label: "Mobile",
  policy: "verified",
  verified: false,
  verified_at: null,
  reveal_count: 0,
};

const SUMMARY = {
  contact_id: 7,
  total: 128,
  last_24h: 4,
  last_7d: 19,
  last_reveal_at: "2026-09-11T09:30:00Z",
};

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

function ownerHandlers(contacts: readonly unknown[]): void {
  server.use(
    http.get(`${BASE}/contacts`, () =>
      HttpResponse.json({
        contacts,
        policies: ["members", "verified", "nobody"],
      })
    ),
    http.get(`${BASE}/contacts/:id/reveals/summary`, () =>
      HttpResponse.json(SUMMARY)
    )
  );
}

describe("<ContactsManager/> — the owner's own numbers", () => {
  it("masks the number down to its last two digits until the owner asks", async () => {
    ownerHandlers([VERIFIED]);
    render(wrap(<ContactsManager />));
    const value = await screen.findByTestId("contact-value-7");
    expect(value.textContent).toBe("+••••••00");
    expect(value.textContent).not.toContain("5550100");

    fireEvent.click(screen.getByTestId("contact-show-7"));
    await waitFor(() =>
      expect(screen.getByTestId("contact-value-7").textContent).toBe("+15550100")
    );
  });

  it("renders the policy picker from the vocabulary the server sent", async () => {
    ownerHandlers([VERIFIED]);
    render(wrap(<ContactsManager />));
    await screen.findByTestId("contact-row-7");
    // The picker's current value is the server's, spelled in this pair's words
    // for a shipped policy id.
    expect(screen.getByTestId("contact-policy-7").textContent).toContain(
      "Anybody with an account"
    );
  });

  it("shows the hand-over counters as total / 24h / 7d", async () => {
    ownerHandlers([VERIFIED]);
    render(wrap(<ContactsManager />));
    const counters = await screen.findByTestId("contact-reveals-7");
    expect(counters.textContent).toContain("128");
    expect(counters.textContent).toContain("4");
    expect(counters.textContent).toContain("19");
  });

  it("says out loud that an unverified number reaches nobody", async () => {
    ownerHandlers([UNVERIFIED]);
    render(wrap(<ContactsManager />));
    await screen.findByTestId("contact-row-8");
    expect(screen.getByTestId("contact-verified-8").textContent).toBe(
      "Not confirmed"
    );
    expect(
      screen.getByText("Confirm this number by SMS — until then it is handed to nobody.")
    ).toBeTruthy();
  });

  it("walks the verify flow: request → code → confirm", async () => {
    ownerHandlers([UNVERIFIED]);
    let confirmBody: unknown;
    server.use(
      http.post(`${BASE}/contacts/8/verify/request`, () =>
        HttpResponse.json({ sent: true, expires_in: 600 })
      ),
      http.post(`${BASE}/contacts/8/verify/confirm`, async ({ request }) => {
        confirmBody = await request.json();
        return HttpResponse.json({ ...UNVERIFIED, verified: true });
      })
    );
    render(wrap(<ContactsManager />));
    await screen.findByTestId("contact-row-8");

    fireEvent.click(screen.getByTestId("contact-verify-8"));
    await screen.findByTestId("contact-code-sent");
    expect(screen.getByTestId("contact-code-expires").textContent).toContain("600");

    fireEvent.change(screen.getByTestId("contact-code-input-8"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("contact-code-confirm-8"));
    await waitFor(() => expect(confirmBody).toEqual({ code: "123456" }));
  });

  it("repeats how many attempts a wrong code left", async () => {
    ownerHandlers([UNVERIFIED]);
    server.use(
      http.post(`${BASE}/contacts/8/verify/request`, () =>
        HttpResponse.json({ sent: true, expires_in: null })
      ),
      http.post(`${BASE}/contacts/8/verify/confirm`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.contacts_invalid_code",
            error: "Wrong code.",
            params: { attempts_remaining: 2 },
          },
          { status: 400 }
        )
      )
    );
    render(wrap(<ContactsManager />));
    await screen.findByTestId("contact-row-8");
    fireEvent.click(screen.getByTestId("contact-verify-8"));
    await screen.findByTestId("contact-code-sent");
    fireEvent.change(screen.getByTestId("contact-code-input-8"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByTestId("contact-code-confirm-8"));
    const attempts = await screen.findByTestId("contact-code-attempts");
    expect(attempts.textContent).toBe("2 attempts left.");
  });

  it("echoes the backend's own verdict on a number it refuses", async () => {
    ownerHandlers([]);
    server.use(
      http.post(`${BASE}/contacts`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.contacts_invalid_phone",
            error: "bad number",
            params: {},
          },
          { status: 400 }
        )
      )
    );
    render(wrap(<ContactsManager />));
    await screen.findByTestId("contacts-empty");
    fireEvent.change(screen.getByTestId("contact-add-value"), {
      target: { value: "5550100" },
    });
    fireEvent.click(screen.getByTestId("contact-add-submit"));
    const error = await screen.findByTestId("contact-add-error");
    expect(error.textContent).toContain(
      "Enter the phone number in international form"
    );
  });

  it("asks before deleting, and deletes only on the confirmation", async () => {
    ownerHandlers([VERIFIED]);
    let deleted = 0;
    server.use(
      http.delete(`${BASE}/contacts/7`, () => {
        deleted += 1;
        return HttpResponse.json({ success: true });
      })
    );
    render(wrap(<ContactsManager />));
    await screen.findByTestId("contact-row-7");
    fireEvent.click(screen.getByTestId("contact-delete-7"));
    const confirm = await screen.findByTestId("stapel-confirm-ok");
    expect(deleted).toBe(0);
    fireEvent.click(confirm);
    await waitFor(() => expect(deleted).toBe(1));
  });
});

describe("<RevealPhoneButton/> — the viewer's one ask", () => {
  it("becomes the numbers, as tel: links, in place", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () =>
        HttpResponse.json({ phones: [{ label: "Work", value: "+15550100" }] })
      )
    );
    render(wrap(<RevealPhoneButton ownerKey={OWNER} />));
    fireEvent.click(screen.getByTestId("reveal-phone-button"));
    const phone = await screen.findByTestId("revealed-phone");
    expect(phone.querySelector("a")?.getAttribute("href")).toBe("tel:+15550100");
    expect(phone.textContent).toContain("+15550100");
    // The button is gone: the control WAS the question, and it has been
    // answered where it stood.
    expect(screen.queryByTestId("reveal-phone-button")).toBeNull();
  });

  it("writes no number to storage or to the URL", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () =>
        HttpResponse.json({ phones: [{ label: "Work", value: "+15550100" }] })
      )
    );
    render(wrap(<RevealPhoneButton ownerKey={OWNER} />));
    fireEvent.click(screen.getByTestId("reveal-phone-button"));
    await screen.findByTestId("revealed-phone");
    expect(JSON.stringify({ ...localStorage })).not.toContain("5550100");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("5550100");
    expect(window.location.href).not.toContain("5550100");
  });

  it("says so when the seller has nothing for this viewer", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () => HttpResponse.json({ phones: [] }))
    );
    render(wrap(<RevealPhoneButton ownerKey={OWNER} />));
    fireEvent.click(screen.getByTestId("reveal-phone-button"));
    const none = await screen.findByTestId("reveal-phone-none");
    expect(none.textContent).toBe("This seller has no phone number to show.");
  });

  it("opens the host's registration door on a 403", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.403.contacts_registration_required",
            error: "Register an account to see a seller's phone number",
            params: {},
          },
          { status: 403 }
        )
      )
    );
    render(
      wrap(
        <RevealPhoneButton
          ownerKey={OWNER}
          renderDoor={() => <button data-testid="host-door">{"Register"}</button>}
        />
      )
    );
    fireEvent.click(screen.getByTestId("reveal-phone-button"));
    const refusal = await screen.findByTestId("reveal-phone-registration");
    expect(refusal.textContent).toContain(
      "Register an account to see a seller's phone number."
    );
    expect(screen.getByTestId("host-door")).toBeTruthy();
  });

  it("speaks the budget refusal in minutes, not in seconds", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.429.contacts_reveal_budget",
            error: "Too many phone lookups",
            params: { retry_after: 240 },
          },
          { status: 429 }
        )
      )
    );
    render(wrap(<RevealPhoneButton ownerKey={OWNER} />));
    fireEvent.click(screen.getByTestId("reveal-phone-button"));
    const budget = await screen.findByTestId("reveal-phone-budget");
    expect(budget.textContent).toBe(
      "Too many phone lookups. Try again in 4 minutes."
    );
  });

  it("rounds a part-minute up, and never says zero", () => {
    expect(retryAfterMinutes(240)).toBe(4);
    expect(retryAfterMinutes(61)).toBe(2);
    expect(retryAfterMinutes(5)).toBe(1);
    expect(retryAfterMinutes(undefined)).toBe(1);
  });

  it("states WHY it is off when the seller has no number to ask for", async () => {
    render(wrap(<RevealPhoneButton ownerKey={OWNER} available={false} />));
    const button = await screen.findByTestId("reveal-phone-button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByText("This seller has no phone number to show.")
    ).toBeTruthy();
  });
});
