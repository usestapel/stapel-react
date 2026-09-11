/**
 * The contacts wire, as this pair speaks it (stapel-profiles ≥0.20.0).
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md): every test here goes
 * through msw at the real paths, so a request this pair sends to the wrong
 * path, with the wrong verb or with a hand-shaped body fails HERE rather than
 * on a stand. The 403/429 answers are real envelopes with real status codes,
 * because the two dialects of a thrown value are exactly what the reveal
 * button branches on.
 */
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createProfilesRuntime } from "../src/model/runtime.js";
import type { ProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { useContacts, useRevealContacts } from "../src/headless/Contacts.js";
import { hasPhone, maskPhoneNumber } from "../src/api/extensions.js";
import { profilesQueryKeys } from "../src/model/queryKeys.js";
import { createI18n } from "@stapel/core";
import {
  PROFILES_I18N_KEYS,
  registerProfilesI18n,
} from "../src/i18n/keys.js";
import { registerProfilesI18nRu } from "../src/i18n/ru.js";
import { registerProfilesI18nEs } from "../src/i18n/es.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";
const OWNER = "1c7e4b90-2222-4000-8000-000000000002";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

const CONTACT = {
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

const LIST = { contacts: [CONTACT], policies: ["members", "verified", "nobody"] };

const SUMMARY = {
  contact_id: 7,
  total: 128,
  last_24h: 4,
  last_7d: 19,
  last_reveal_at: "2026-09-11T09:30:00Z",
};

function listHandlers(): void {
  server.use(
    http.get(`${BASE}/contacts`, () => HttpResponse.json(LIST)),
    http.get(`${BASE}/contacts/7/reveals/summary`, () => HttpResponse.json(SUMMARY))
  );
}

function client(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(
  runtime: ProfilesRuntime,
  queryClient: QueryClient,
  children: ReactNode
): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfilesProvider runtime={runtime}>{children}</ProfilesProvider>
    </QueryClientProvider>
  );
}

function mountContacts(queryClient = client()): {
  result: { current: ReturnType<typeof useContacts> };
  queryClient: QueryClient;
} {
  const runtime = createProfilesRuntime({ baseUrl: BASE });
  const { result } = renderHook(() => useContacts(), {
    wrapper: ({ children }) => wrap(runtime, queryClient, children),
  });
  return { result, queryClient };
}

describe("useContacts — the read", () => {
  it("asks GET /contacts and keeps the deployment's policy vocabulary", async () => {
    listHandlers();
    const { result } = mountContacts();
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    expect(result.current.contacts[0]?.value).toBe("+15550100");
    expect(result.current.policies).toEqual(["members", "verified", "nobody"]);
  });

  it("reads the hand-over counters per contact, not off the list row", async () => {
    listHandlers();
    const { result } = mountContacts();
    await waitFor(() =>
      expect(result.current.summaryFor(7)?.last_24h).toBe(4)
    );
    expect(result.current.summaryFor(7)?.last_7d).toBe(19);
    // A contact nobody asked about is "not known yet", never zero.
    expect(result.current.summaryFor(99)).toBeUndefined();
  });
});

describe("useContacts — the writes, as the wire receives them", () => {
  it("POSTs a new number to /contacts and refreshes the list", async () => {
    listHandlers();
    let body: unknown;
    server.use(
      http.post(`${BASE}/contacts`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(CONTACT, { status: 201 });
      })
    );
    const { result } = mountContacts();
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    result.current.addContact.mutate({ value: "+15550100", label: "Work" });
    await waitFor(() => expect(result.current.addContact.isSuccess).toBe(true));
    expect(body).toEqual({ value: "+15550100", label: "Work" });
  });

  it("PATCHes only the fields that changed to /contacts/{id}", async () => {
    listHandlers();
    let body: unknown;
    let method = "";
    server.use(
      http.patch(`${BASE}/contacts/7`, async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json({ ...CONTACT, policy: "verified" });
      })
    );
    const { result } = mountContacts();
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    result.current.updateContact.mutate({
      contactId: 7,
      patch: { policy: "verified" },
    });
    await waitFor(() => expect(result.current.updateContact.isSuccess).toBe(true));
    expect(method).toBe("PATCH");
    expect(body).toEqual({ policy: "verified" });
  });

  it("DELETEs /contacts/{id}", async () => {
    listHandlers();
    let called = 0;
    server.use(
      http.delete(`${BASE}/contacts/7`, () => {
        called += 1;
        return HttpResponse.json({ success: true });
      })
    );
    const { result } = mountContacts();
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    result.current.removeContact.mutate(7);
    await waitFor(() => expect(result.current.removeContact.isSuccess).toBe(true));
    expect(called).toBe(1);
  });

  it("asks for a code with an empty POST and confirms it with {code}", async () => {
    listHandlers();
    let confirmBody: unknown;
    server.use(
      http.post(`${BASE}/contacts/7/verify/request`, () =>
        HttpResponse.json({ sent: true, expires_in: 600 })
      ),
      http.post(`${BASE}/contacts/7/verify/confirm`, async ({ request }) => {
        confirmBody = await request.json();
        return HttpResponse.json(CONTACT);
      })
    );
    const { result } = mountContacts();
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    result.current.requestCode.mutate(7);
    await waitFor(() => expect(result.current.requestCode.isSuccess).toBe(true));
    expect(result.current.requestCode.data?.expires_in).toBe(600);
    result.current.confirmCode.mutate({ contactId: 7, code: "123456" });
    await waitFor(() => expect(result.current.confirmCode.isSuccess).toBe(true));
    expect(confirmBody).toEqual({ code: "123456" });
  });
});

describe("useRevealContacts", () => {
  it("POSTs {owner_key, listing_id} to /contacts/reveal", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/contacts/reveal`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ phones: [{ label: "Work", value: "+15550100" }] });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRevealContacts(), {
      wrapper: ({ children }) => wrap(runtime, client(), children),
    });
    result.current.mutate({ ownerKey: OWNER, listingId: "91823" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({ owner_key: OWNER, listing_id: "91823" });
    expect(result.current.data?.phones[0]?.value).toBe("+15550100");
  });

  it("omits listing_id when the caller was not standing anywhere", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/contacts/reveal`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ phones: [] });
      })
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRevealContacts(), {
      wrapper: ({ children }) => wrap(runtime, client(), children),
    });
    result.current.mutate({ ownerKey: OWNER });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({ owner_key: OWNER });
  });

  it("puts the revealed number in NO query cache entry", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () =>
        HttpResponse.json({ phones: [{ label: "Work", value: "+15550100" }] })
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = client();
    const { result } = renderHook(() => useRevealContacts(), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ ownerKey: OWNER });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The mutation object has it…
    expect(result.current.data?.phones).toHaveLength(1);
    // …and nothing else does. Not one query entry, under any key: a persisted
    // QueryClient would otherwise carry a stranger's phone number to disk.
    const cached = JSON.stringify(
      queryClient.getQueryCache().getAll().map((entry) => entry.state.data)
    );
    expect(cached).not.toContain("+15550100");
    expect(queryClient.getQueryData(profilesQueryKeys.contacts())).toBeUndefined();
  });

  it("drops the answer when the component that asked goes away", async () => {
    server.use(
      http.post(`${BASE}/contacts/reveal`, () =>
        HttpResponse.json({ phones: [{ label: "Work", value: "+15550100" }] })
      )
    );
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const queryClient = client();
    const { result, unmount } = renderHook(() => useRevealContacts(), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ ownerKey: OWNER });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unmount();
    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
    );
  });

  it("surfaces the registration refusal as its own backend code", async () => {
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
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRevealContacts(), {
      wrapper: ({ children }) => wrap(runtime, client(), children),
    });
    result.current.mutate({ ownerKey: OWNER });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe(
      "error.403.contacts_registration_required"
    );
  });

  it("carries retry_after out of the budget refusal", async () => {
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
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRevealContacts(), {
      wrapper: ({ children }) => wrap(runtime, client(), children),
    });
    result.current.mutate({ ownerKey: OWNER });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.params["retry_after"]).toBe(240);
  });
});

describe("hasPhone — the one bit a public profile carries", () => {
  it("is true only when the profile says so", () => {
    expect(hasPhone({ contacts: { phone: true } })).toBe(true);
    expect(hasPhone({ contacts: { phone: false } })).toBe(false);
    // An older profile shape, a serializer that did not send the block, no
    // profile at all: no button, because nobody said there is a number.
    expect(hasPhone({})).toBe(false);
    expect(hasPhone(null)).toBe(false);
    expect(hasPhone(undefined)).toBe(false);
  });
});

describe("maskPhoneNumber", () => {
  it("leaves the last two digits and the shape of the number", () => {
    expect(maskPhoneNumber("+15550100")).toBe("+••••••00");
    expect(maskPhoneNumber("+7 999 123-45-67")).toBe("+• ••• •••-••-67");
  });

  it("hides nothing there is nothing to hide behind", () => {
    expect(maskPhoneNumber("42")).toBe("42");
  });
});

/**
 * Every contacts key, in every locale this pair ships. The pair's own
 * `i18nRu`/`i18nEs` suites already assert parity over the WHOLE key table;
 * this one names the feature, so a contacts key added later without its ru and
 * es copy fails in the file it belongs to.
 */
describe("contacts copy exists in en, ru and es", () => {
  const CONTACT_KEYS = Object.entries(PROFILES_I18N_KEYS)
    .filter(([name]) => name.startsWith("contacts"))
    .map(([, key]) => key);

  it("has more than a handful of keys to check", () => {
    expect(CONTACT_KEYS.length).toBeGreaterThan(30);
  });

  for (const locale of ["en", "ru", "es"] as const) {
    it(`resolves every contacts key in ${locale}`, async () => {
      const i18n = createI18n({ locale: "en" });
      registerProfilesI18n(i18n);
      registerProfilesI18nRu(i18n);
      registerProfilesI18nEs(i18n);
      await i18n.setLocale(locale);
      for (const key of CONTACT_KEYS) {
        // A plural family is not itself an entry — it is read through the
        // category keys underneath it.
        const plural = i18n.tPlural(key, { count: 2 });
        const flat = i18n.t(key);
        expect(flat === key ? plural : flat, `${locale}: ${key}`).not.toBe(key);
      }
    });
  }
});

/**
 * ONE DOOR, AND IT IS THE 403 (stapel-profiles 0.20.2).
 *
 * The refusal a caller without an account gets is
 * `error.403.contacts_registration_required`, at the TOP LEVEL of the
 * envelope, for a guest session and a signed-out visitor alike — and no
 * contacts route answers 401 at all any more (seven declarations left the
 * schema with that release). A pair that kept a 401 branch would be branching
 * on a response that cannot arrive, which is the shape of defect that survives
 * every green unit test written against a hand-made mock.
 *
 * Asserted against the GENERATED schema, because that is the projection of the
 * pinned contract: if a later pin brings a 401 back, this is where it shows up
 * rather than in a host's error handling.
 */
describe("no contacts route answers 401", () => {
  const CONTACT_OPERATIONS = [
    "list_my_contacts",
    "add_my_contact",
    "update_my_contact",
    "delete_my_contact",
    "request_contact_verification",
    "confirm_contact_verification",
    "get_contact_reveal_summary",
    "reveal_contacts",
  ];

  /** The generated block for one operationId, from its name to the next one. */
  function operationBlock(source: string, name: string): string {
    const start = source.indexOf(`\n    ${name}: {`);
    expect(start, name).toBeGreaterThan(-1);
    const end = source.indexOf("\n    };", start);
    return source.slice(start, end);
  }

  it("declares a 403 and no 401 for every contacts operation", () => {
    // vitest runs from the package root — the same cwd-relative read
    // `pair.test.ts` uses for manifest.json.
    const schema = readFileSync("src/api/generated/schema.ts", "utf8");
    for (const name of CONTACT_OPERATIONS) {
      const block = operationBlock(schema, name);
      expect(block.includes("401:"), `${name} declares a 401`).toBe(false);
      expect(block.includes("403:"), `${name} declares no 403`).toBe(true);
    }
  });
});
