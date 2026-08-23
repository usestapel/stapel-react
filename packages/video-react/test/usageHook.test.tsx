import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useScopeUsage } from "../src/index.js";
import type { UseScopeUsageOptions } from "../src/index.js";
import {
  BASE,
  INVALID_PERIOD,
  SCOPE,
  SCOPE_NOT_FOUND,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  AUGUST_ONLY_BODY,
  JULY_ONLY_BODY,
  NO_MONTHS_BODY,
  TZ,
  WINDOW_BODY,
} from "./fixtures.js";

/**
 * The hook, exercised through the REAL client against real-shaped bodies.
 * A probe renders the bag's discriminant as text so an assertion reads the
 * same three-or-four states a skin does — there is no way to observe "ready"
 * here without the load actually having succeeded.
 */
function Probe(props: {
  options?: UseScopeUsageOptions;
  scopeKey?: string;
}): ReactElement {
  const bag = useScopeUsage(props.scopeKey ?? SCOPE, props.options ?? {});
  return (
    <div>
      <span data-testid="status">{bag.rows.status}</span>
      <span data-testid="month">{bag.month ?? "—"}</span>
      <span data-testid="labels">{bag.monthLabels.join(",")}</span>
      <span data-testid="tz">{bag.tz}</span>
      <span data-testid="rows">
        {bag.rows.status === "ready"
          ? bag.rows.data.map((r) => r.user_id).join(",")
          : ""}
      </span>
      <span data-testid="refusal">
        {bag.rows.status === "failed" ? String(bag.rows.error) : ""}
      </span>
    </div>
  );
}

function mount(
  server: MockServer,
  options?: UseScopeUsageOptions
): ReturnType<typeof render> {
  return render(
    <TestProviders server={server}>
      <Probe {...(options !== undefined ? { options } : {})} />
    </TestProviders>
  );
}

const usageOf = (server: MockServer): RegExpMatchArray[] =>
  server.calls
    .map((c) => c.url.match(/\/scopes\/([^/]+)\/usage\/\?(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null);

describe("useScopeUsage — the four outcomes, none collapsed into another", () => {
  it("loading is not empty: the first paint reports `loading`, never zero rows", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    mount(server);
    expect(screen.getByTestId("status").textContent).toBe("loading");
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready")
    );
  });

  it("ready hands out the newest month's rows and every month's label", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    mount(server, { tz: TZ });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready")
    );
    expect(screen.getByTestId("month").textContent).toBe("2026-08");
    expect(screen.getByTestId("rows").textContent).toBe("u-9a1f,u-4c02,u-b7de");
    expect(screen.getByTestId("labels").textContent).toBe("2026-08,2026-07,2026-06");
    expect(screen.getByTestId("tz").textContent).toBe(TZ);
  });

  it("a month with nobody in it is `ready` with zero rows — a real answer, not a failure", async () => {
    const server = mockServer({ "/usage/": { body: JULY_ONLY_BODY } });
    mount(server, { month: "2026-07", tz: TZ });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready")
    );
    expect(screen.getByTestId("rows").textContent).toBe("");
    expect(screen.getByTestId("month").textContent).toBe("2026-07");
  });

  it("an answer with no `months` key is `ready` with nothing, and names no month", async () => {
    const server = mockServer({ "/usage/": { body: NO_MONTHS_BODY } });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready")
    );
    expect(screen.getByTestId("month").textContent).toBe("—");
    expect(screen.getByTestId("labels").textContent).toBe("");
  });

  it("the uniform 404 is `failed` — never an empty table", async () => {
    const server = mockServer({ "/usage/": SCOPE_NOT_FOUND });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("failed")
    );
    expect(screen.getByTestId("refusal").textContent).toContain("Scope not found");
    expect(screen.getByTestId("rows").textContent).toBe("");
  });

  it("a period refusal is `failed` too, and is a different code", async () => {
    const server = mockServer({ "/usage/": INVALID_PERIOD });
    mount(server, { months: 99 });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("failed")
    );
  });

  it("a 500 is `failed`, not empty", async () => {
    const server = mockServer({
      "/usage/": { status: 500, body: { detail: "boom" } },
    });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("failed")
    );
  });
});

describe("useScopeUsage — the request it actually makes", () => {
  it("asks for the window with the view's own defaults when told nothing", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    mount(server);
    await waitFor(() => expect(usageOf(server).length).toBe(1));
    const [match] = usageOf(server);
    expect(match?.[1]).toBe(SCOPE);
    expect(match?.[2]).toContain("months=6");
    expect(match?.[2]).toContain("tz=UTC");
  });

  it("encodes the scope key — it is host-chosen and opaque", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    render(
      <TestProviders server={server}>
        <Probe scopeKey="acme/7 f" />
      </TestProviders>
    );
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    expect(server.calls[0]?.url).toContain(`${BASE}/scopes/acme%2F7%20f/usage/`);
  });

  it("sends `month` and NOT `months` once a month is chosen", async () => {
    const server = mockServer({
      "month=2026-07": { body: JULY_ONLY_BODY },
      "/usage/": { body: WINDOW_BODY },
    });
    mount(server, { month: "2026-07", tz: TZ });
    await waitFor(() =>
      expect(screen.getByTestId("month").textContent).toBe("2026-07")
    );
    const monthCall = server.calls.find((c) => c.url.includes("month=2026-07"));
    expect(monthCall).toBeDefined();
    expect(monthCall?.url).not.toContain("months=");
  });
});

describe("useScopeUsage — changing the month refetches", () => {
  it("issues a new request per month, and the selector's options survive it", async () => {
    const server = mockServer({
      "month=2026-07": { body: JULY_ONLY_BODY },
      "month=2026-08": { body: AUGUST_ONLY_BODY },
      "/usage/": { body: WINDOW_BODY },
    });
    const view = render(
      <TestProviders server={server}>
        <Probe options={{ month: "2026-08", tz: TZ }} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("rows").textContent).toContain("u-9a1f")
    );
    const before = server.calls.length;

    view.rerender(
      <TestProviders server={server}>
        <Probe options={{ month: "2026-07", tz: TZ }} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("month").textContent).toBe("2026-07")
    );

    expect(server.calls.length).toBeGreaterThan(before);
    expect(
      server.calls.filter((c) => c.url.includes("month=2026-07")).length
    ).toBe(1);
    // The window read is cached under its OWN key: switching months does not
    // re-ask for six months to render one, and the options do not collapse to
    // the single month the answer carries.
    expect(
      server.calls.filter((c) => c.url.includes("months=6")).length
    ).toBe(1);
    expect(screen.getByTestId("labels").textContent).toBe("2026-08,2026-07,2026-06");
  });

  it("a month in another zone is its own request — the boundaries differ", async () => {
    const server = mockServer({ "/usage/": { body: AUGUST_ONLY_BODY } });
    const view = render(
      <TestProviders server={server}>
        <Probe options={{ month: "2026-08", tz: "UTC" }} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready")
    );
    const before = server.calls.length;
    view.rerender(
      <TestProviders server={server}>
        <Probe options={{ month: "2026-08", tz: TZ }} />
      </TestProviders>
    );
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(before));
  });
});

describe("useScopeUsage — what it refuses to ask", () => {
  it("does not fire for an empty scope key", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    render(
      <TestProviders server={server}>
        <Probe scopeKey="" />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("loading")
    );
    expect(server.calls).toEqual([]);
  });

  it("does not fire while `enabled` is false", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    mount(server, { enabled: false });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("loading")
    );
    expect(server.calls).toEqual([]);
  });
});
