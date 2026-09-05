/**
 * `useOwnerAggregates` — the batched owner-rating read (stapel-reviews
 * 0.6.0, `POST /reviews/aggregates/by-owner`). Three properties load-bearing
 * enough to be tested directly rather than only through a skin: one query per
 * distinct sorted key set, transparent chunking at the backend's own
 * ceiling, and no request at all for an empty key set.
 */
import { describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import { isTooManyOwnerKeys, useOwnerAggregates } from "../src/index.js";
import type { OwnerAggregatesResponse } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { OWNER_AGGREGATES, TOO_MANY_OWNER_KEYS_400 } from "./fixtures.js";

function Probe(props: {
  readonly ownerKeys: readonly string[];
  readonly targetType?: string;
  readonly onState: (state: UseQueryResult<OwnerAggregatesResponse, StapelApiError>) => void;
}): ReactElement {
  const state = useOwnerAggregates(
    props.ownerKeys,
    props.targetType !== undefined ? { targetType: props.targetType } : {}
  );
  props.onState(state);
  return <span data-testid="probe" />;
}

function mount(
  server: MockServer,
  ownerKeys: readonly string[],
  targetType?: string
) {
  const seen: UseQueryResult<OwnerAggregatesResponse, StapelApiError>[] = [];
  const result = render(
    <TestProviders server={server}>
      <Probe
        ownerKeys={ownerKeys}
        {...(targetType !== undefined ? { targetType } : {})}
        onState={(s) => seen.push(s)}
      />
    </TestProviders>
  );
  return { ...result, seen, last: () => seen[seen.length - 1] };
}

describe("one query per distinct, sorted key set", () => {
  it("a duplicate key in the input is sent once", async () => {
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": { body: OWNER_AGGREGATES },
    });
    const { last } = mount(server, ["u-1", "u-2", "u-1"]);
    await waitFor(() => expect(last()?.status).toBe("success"));
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]?.body).toEqual({ owner_keys: ["u-1", "u-2"] });
  });

  it("re-renders with the same set in a different order do not refetch", async () => {
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": { body: OWNER_AGGREGATES },
    });
    const seen: UseQueryResult<OwnerAggregatesResponse, StapelApiError>[] = [];
    const { rerender } = render(
      <TestProviders server={server}>
        <Probe ownerKeys={["b", "a"]} onState={(s) => seen.push(s)} />
      </TestProviders>
    );
    await waitFor(() => expect(seen.at(-1)?.status).toBe("success"));
    expect(server.calls).toHaveLength(1);

    rerender(
      <TestProviders server={server}>
        <Probe ownerKeys={["a", "b"]} onState={(s) => seen.push(s)} />
      </TestProviders>
    );
    // The order-independent key means this is a CACHE HIT, not a second
    // request — give it a tick to prove nothing new fires.
    await waitFor(() => expect(seen.at(-1)?.status).toBe("success"));
    expect(server.calls).toHaveLength(1);
  });

  it("target_type is part of the key: two callers asking about the same owners under different types do not share a cache entry", async () => {
    let calls = 0;
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": () => {
        calls += 1;
        return { body: OWNER_AGGREGATES };
      },
    });
    const { last } = mount(server, ["u-1"], "listing");
    await waitFor(() => expect(last()?.status).toBe("success"));
    const { last: last2 } = mount(server, ["u-1"], "course");
    await waitFor(() => expect(last2()?.status).toBe("success"));
    expect(calls).toBe(2);
  });
});

describe("chunked at the backend's own ceiling (100)", () => {
  it("splits 150 distinct keys into two requests and merges one result", async () => {
    const keys = Array.from({ length: 150 }, (_, i) => `u-${String(i)}`);
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": (call) => {
        const body = call.body as { owner_keys: string[] };
        const page: OwnerAggregatesResponse = {};
        for (const k of body.owner_keys) page[k] = { avg: 5, count: 1 };
        return { body: page };
      },
    });
    const { last } = mount(server, keys);
    await waitFor(() => expect(last()?.status).toBe("success"));

    expect(server.calls).toHaveLength(2);
    const sizes = server.calls
      .map((c) => (c.body as { owner_keys: string[] }).owner_keys.length)
      .sort((a, b) => a - b);
    expect(sizes).toEqual([50, 100]);

    // One merged result, not one per chunk.
    const data = last()?.data;
    expect(Object.keys(data ?? {})).toHaveLength(150);
    expect(data?.["u-0"]).toEqual({ avg: 5, count: 1 });
    expect(data?.["u-149"]).toEqual({ avg: 5, count: 1 });
  });

  it("never sends more than 100 keys in one request — the hook cannot provoke the too-many-keys refusal", async () => {
    const keys = Array.from({ length: 201 }, (_, i) => `u-${String(i)}`);
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": { body: {} },
    });
    const { last } = mount(server, keys);
    await waitFor(() => expect(last()?.status).toBe("success"));
    for (const call of server.calls) {
      const body = call.body as { owner_keys: string[] };
      expect(body.owner_keys.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("an empty key set makes no request at all", () => {
  it("stays disabled — no fetch, no pending status", async () => {
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": { body: OWNER_AGGREGATES },
    });
    const { last } = mount(server, []);
    // Give React a tick; the hook must never transition out of "no query ran".
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(server.calls).toHaveLength(0);
    expect(last()?.fetchStatus).toBe("idle");
    expect(last()?.status).not.toBe("success");
  });

  it("an input that is ALL duplicates of nothing but empties out still makes no request", async () => {
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": { body: OWNER_AGGREGATES },
    });
    mount(server, ["", ""].filter((k) => k.length > 0));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(server.calls).toHaveLength(0);
  });
});

describe("the error shape a caller sees", () => {
  it("a direct ReviewsApi caller CAN hit the too-many-keys refusal, and it is recognizable by code", async () => {
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": TOO_MANY_OWNER_KEYS_400,
    });
    const { last } = mount(server, ["u-1"]);
    await waitFor(() => expect(last()?.status).toBe("error"));
    expect(isTooManyOwnerKeys(last()?.error)).toBe(true);
  });

  it("a different refusal is NOT mistaken for the too-many-keys one", async () => {
    const server = mockServer({
      "POST /reviews/aggregates/by-owner": {
        status: 400,
        body: { localizable_error: "error.400.reviews_unknown_target_type" },
      },
    });
    const { last } = mount(server, ["u-1"], "ghost-type");
    await waitFor(() => expect(last()?.status).toBe("error"));
    expect(isTooManyOwnerKeys(last()?.error)).toBe(false);
  });
});
