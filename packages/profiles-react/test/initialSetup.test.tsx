/**
 * Coverage for the InitialSetupPrompt canon (workspaces-org-program §B5):
 * the headless first-run form (`InitialSetupPrompt`), its trigger gate
 * (`useInitialSetupGate`), and the antd default skin (`InitialSetupModal`).
 *
 * TIME + STORAGE FAKES: the "daily" gate measures 24 h from the stamp
 * `stapel.profiles.initialSetup.lastPromptAt`, persisted through
 * `@stapel/core`'s `createRepository("profiles.initialSetup", { scope:
 * "app", storage: "local" })` — which in jsdom bottoms out in the REAL
 * `window.localStorage` under the repository's physical key
 * `stapel:repo:profiles.initialSetup:lastPromptAt` (JSON-encoded number).
 * So the storage fake is jsdom's own localStorage (seeded/asserted raw —
 * tests are exempt from `stapel/no-raw-storage` by the preset's TEST_FILES
 * carve-out), and the clock fake is a `vi.spyOn(Date, "now")` stub —
 * deliberately NOT `vi.useFakeTimers()`, which would also fake the timers
 * `waitFor`/msw depend on.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createProfilesRuntime } from "../src/model/runtime.js";
import type { ProfilesRuntime } from "../src/model/runtime.js";
import { ProfilesProvider } from "../src/headless/ProfilesProvider.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import { InitialSetupPrompt } from "../src/headless/InitialSetupPrompt.js";
import type { InitialSetupPromptBag } from "../src/headless/InitialSetupPrompt.js";
import { useInitialSetupGate } from "../src/headless/useInitialSetupGate.js";
import { InitialSetupModal } from "../src/default/InitialSetupModal.js";

const BASE = "https://profiles.stapel.test/profiles/api/v1";

/** The §B5 canonical stamp's PHYSICAL localStorage key (repository scheme
 * `stapel:repo:<namespace>:<key>` around `profiles.initialSetup` /
 * `lastPromptAt`). */
const STAMP_STORAGE_KEY = "stapel:repo:profiles.initialSetup:lastPromptAt";

const HOUR_MS = 60 * 60 * 1000;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

/** A first-run profile — no display name, setup not passed. Overrides let a
 * test flip exactly the field under test. */
function profileFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: "b3f1c0de-0000-4000-8000-000000000002",
    avatar_source: "file",
    avatar: "",
    display_name: "",
    theme: "system",
    location_id: 0,
    location_display_name_narrow: "",
    location_display_name_broad: "",
    app_language: { code: "en", name: "English", flag: null },
    understands: ["en"],
    use_device_language: false,
    auto_detected_language: "en",
    auto_translate_content: false,
    email_messages: true,
    email_system: true,
    push_messages: true,
    push_system: true,
    essential_cookies_accepted: true,
    initial_setup_passed: false,
    followers_count: 0,
    following_count: 0,
    rating: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function wrap(runtime: ProfilesRuntime, children: ReactNode): ReactElement {
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

/** Serve GET /me (+ a PATCH echo), counting/capturing requests. */
function serveProfile(profile: Record<string, unknown>): {
  patches: Record<string, unknown>[];
  meCount(): number;
} {
  const patches: Record<string, unknown>[] = [];
  let me = 0;
  server.use(
    http.get(`${BASE}/me`, () => {
      me += 1;
      return HttpResponse.json(profile);
    }),
    http.patch(`${BASE}/me`, async ({ request }) => {
      const patch = (await request.json()) as Record<string, unknown>;
      patches.push(patch);
      return HttpResponse.json({ ...profile, ...patch });
    })
  );
  return { patches, meCount: () => me };
}

/** Seed the daily stamp as the repository would have written it. */
function seedStamp(at: number): void {
  localStorage.setItem(STAMP_STORAGE_KEY, JSON.stringify(at));
}

function readStamp(): number | undefined {
  const raw = localStorage.getItem(STAMP_STORAGE_KEY);
  return raw === null ? undefined : (JSON.parse(raw) as number);
}

/** Let async work with no positive observable (the gate's stamp read, a
 * would-be stray PATCH) settle before asserting a NEGATIVE. Real timers —
 * the clock fake is a `Date.now` stub precisely so these still run. */
async function flushGate(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe("useInitialSetupGate", () => {
  it('require: "displayName" — shows only while display_name is blank', async () => {
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    serveProfile(profileFixture({ display_name: "  " }));
    const blank = renderHook(
      () => useInitialSetupGate({ mode: "always", require: "displayName" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(blank.result.current.shouldShow).toBe(true));
    blank.unmount();

    const { meCount } = serveProfile(profileFixture({ display_name: "Ada Lovelace" }));
    const named = renderHook(
      () => useInitialSetupGate({ mode: "always", require: "displayName" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(meCount()).toBeGreaterThan(0));
    await flushGate();
    expect(named.result.current.shouldShow).toBe(false);
  });

  it('require: "initialSetup" — keyed to initial_setup_passed; dismiss() hides', async () => {
    const runtime = createProfilesRuntime({ baseUrl: BASE });

    serveProfile(profileFixture({ display_name: "Ada", initial_setup_passed: false }));
    const { result } = renderHook(
      () => useInitialSetupGate({ mode: "always", require: "initialSetup" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(result.current.shouldShow).toBe(true));

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.shouldShow).toBe(false);
    // Dismiss refreshes the daily stamp (documented behavior).
    await waitFor(() => expect(readStamp()).toBeDefined());
  });

  it('mode: "daily" — stamps at show-time, stays quiet inside 24h, reopens after', async () => {
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    const T0 = 1_760_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(T0);

    // First sight: opens, and records T0 as the last-prompted stamp.
    serveProfile(profileFixture());
    const first = renderHook(
      () => useInitialSetupGate({ mode: "daily", require: "initialSetup" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(first.result.current.shouldShow).toBe(true));
    await waitFor(() => expect(readStamp()).toBe(T0));
    first.unmount();

    // One hour later (same still-unset-up profile): rate-limited — quiet.
    clock.mockReturnValue(T0 + HOUR_MS);
    const { meCount } = serveProfile(profileFixture());
    const second = renderHook(
      () => useInitialSetupGate({ mode: "daily", require: "initialSetup" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(meCount()).toBeGreaterThan(0));
    await flushGate();
    expect(second.result.current.shouldShow).toBe(false);
    expect(readStamp()).toBe(T0); // an unshown prompt must not restamp
    second.unmount();

    // 25 hours later: the window passed — opens again, restamps.
    clock.mockReturnValue(T0 + 25 * HOUR_MS);
    serveProfile(profileFixture());
    const third = renderHook(
      () => useInitialSetupGate({ mode: "daily", require: "initialSetup" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(third.result.current.shouldShow).toBe(true));
    await waitFor(() => expect(readStamp()).toBe(T0 + 25 * HOUR_MS));
  });

  it('mode: "always" ignores a fresh daily stamp (blocking-modal case)', async () => {
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    seedStamp(Date.now() - 60_000); // prompted a minute ago

    serveProfile(profileFixture());
    const { result } = renderHook(
      () => useInitialSetupGate({ mode: "always", require: "displayName" }),
      { wrapper: ({ children }) => wrap(runtime, children) }
    );
    await waitFor(() => expect(result.current.shouldShow).toBe(true));
  });
});

describe("<InitialSetupPrompt/> (headless)", () => {
  function renderBag(
    props: { fields?: readonly ("displayName" | "theme" | "language")[]; onSkip?: () => void } = {}
  ): { bag: () => InitialSetupPromptBag } {
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    let latest: InitialSetupPromptBag | undefined;
    render(
      wrap(
        runtime,
        <InitialSetupPrompt
          {...(props.fields !== undefined ? { fields: props.fields } : {})}
          {...(props.onSkip !== undefined ? { onSkip: props.onSkip } : {})}
        >
          {(bag) => {
            latest = bag;
            return null;
          }}
        </InitialSetupPrompt>
      )
    );
    return {
      bag: () => {
        if (!latest) throw new Error("bag not rendered");
        return latest;
      },
    };
  }

  it("submit() PATCHes exactly the enabled drafts + initial_setup_passed: true", async () => {
    const { patches } = serveProfile(profileFixture());
    const { bag } = renderBag();
    await waitFor(() => expect(bag().isLoading).toBe(false));

    act(() => {
      bag().displayName.set("  Ada Lovelace  ");
      bag().theme.set("dark");
      bag().language.set("ru");
    });
    act(() => {
      bag().submit();
    });

    await waitFor(() => expect(patches).toHaveLength(1));
    // The exact §B5 wire shape — nothing more, nothing less (trimmed name).
    expect(patches[0]).toEqual({
      display_name: "Ada Lovelace",
      theme: "dark",
      app_language: "ru",
      initial_setup_passed: true,
    });
    await waitFor(() => expect(bag().isSubmitted).toBe(true));
  });

  it("fields prop narrows the PATCH to the enabled fields only", async () => {
    const { patches } = serveProfile(profileFixture());
    const { bag } = renderBag({ fields: ["displayName"] });
    await waitFor(() => expect(bag().isLoading).toBe(false));

    act(() => {
      bag().displayName.set("Ada");
    });
    act(() => {
      bag().submit();
    });

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ display_name: "Ada", initial_setup_passed: true });
    expect(bag().theme.enabled).toBe(false);
    expect(bag().language.enabled).toBe(false);
  });

  it("skip() records the stamp and fires onSkip — with NO PATCH", async () => {
    const T0 = 1_760_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(T0);
    const onSkip = vi.fn();
    const { patches } = serveProfile(profileFixture());
    const { bag } = renderBag({ onSkip });
    await waitFor(() => expect(bag().isLoading).toBe(false));

    act(() => {
      bag().skip();
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(readStamp()).toBe(T0));
    // Give any (wrongly) issued PATCH a chance to land before asserting.
    await flushGate();
    expect(patches).toHaveLength(0);
  });

  it("a blank display name blocks submit() (canSubmit false, no request)", async () => {
    const { patches } = serveProfile(profileFixture());
    const { bag } = renderBag();
    await waitFor(() => expect(bag().isLoading).toBe(false));

    expect(bag().canSubmit).toBe(false);
    act(() => {
      bag().submit();
    });
    await flushGate();
    expect(patches).toHaveLength(0);
  });
});

describe("<InitialSetupModal/> (default skin)", () => {
  function serveWithLanguages(profile: Record<string, unknown>): {
    patches: Record<string, unknown>[];
  } {
    const { patches } = serveProfile(profile);
    server.use(
      http.get(`${BASE}/languages/`, () =>
        HttpResponse.json([
          { code: "en", name: "English", flag: null },
          { code: "ru", name: "Russian", flag: null },
        ])
      )
    );
    return { patches };
  }

  it("renders the three §B5 rows, saves once with initial_setup_passed, closes", async () => {
    const { patches } = serveWithLanguages(profileFixture());
    const onClose = vi.fn();
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <InitialSetupModal open onClose={onClose} />));

    await waitFor(() =>
      expect(screen.getByText("Welcome — let's set up your profile")).toBeDefined()
    );
    // Wait out the body's loading Spin (profile read in flight).
    const nameInput = await screen.findByTestId("initial-setup-display-name");
    // The theme row is the SAME canon as <ProfileSettings/> (Segmented +
    // the pair's theme i18n keys); language comes from useLanguages.
    expect(screen.getByText("Theme")).toBeDefined();
    expect(screen.getByText("Light")).toBeDefined();
    expect(screen.getByText("Dark")).toBeDefined();
    expect(screen.getByText("System")).toBeDefined();
    expect(screen.getByText("App language")).toBeDefined();
    // Skippable by default.
    expect(screen.getByText("Maybe later")).toBeDefined();

    fireEvent.change(nameInput, { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByText("Dark"));
    fireEvent.click(screen.getByText("Continue"));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      display_name: "Ada Lovelace",
      theme: "dark",
      app_language: "en",
      initial_setup_passed: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("the Skip button records the skip and closes without a PATCH", async () => {
    const { patches } = serveWithLanguages(profileFixture());
    const onClose = vi.fn();
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <InitialSetupModal open onClose={onClose} />));

    fireEvent.click(await screen.findByText("Maybe later"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readStamp()).toBeDefined());
    await flushGate();
    expect(patches).toHaveLength(0);
  });

  it("skippable={false} is the blocking mode: no Skip, no ✕", async () => {
    serveWithLanguages(profileFixture());
    const runtime = createProfilesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <InitialSetupModal open skippable={false} />));

    await waitFor(() =>
      expect(screen.getByTestId("initial-setup-display-name")).toBeDefined()
    );
    expect(screen.queryByText("Maybe later")).toBeNull();
    expect(document.querySelector(".ant-modal-close")).toBeNull();
    // Save is still there — the only way out.
    expect(screen.getByText("Continue")).toBeDefined();
  });
});
