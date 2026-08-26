import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { useEventCatalog } from "../src/model/catalog.js";
import { useDeliveries } from "../src/model/deliveries.js";
import {
  useSecretRotation,
  useSubscriptions,
} from "../src/model/subscriptions.js";
import { useSubscriptionForm } from "../src/model/subscriptionForm.js";
import { isMandateUnavailable, isSubscriptionCap } from "../src/model/refusals.js";
import { WEBHOOKS_I18N_KEYS } from "../src/i18n/keys.js";
import {
  MANDATE_UNAVAILABLE,
  SUBSCRIPTION_CAP,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  AUTO_DISABLED,
  CATALOG,
  CREATED_WITH_SECRET,
  DELIVERY_DEAD,
  DELIVERY_RETRYING,
  DELIVERY_SUCCEEDED,
  HEALTHY,
  NOTIFICATION_RULE,
} from "./fixtures.js";

function wrapper(server: MockServer) {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <TestProviders server={server}>{props.children}</TestProviders>;
  };
}

describe("useEventCatalog — the picker reads the deployment", () => {
  it("groups events by the module that emits them, both sorted", async () => {
    const server = mockServer({ "/event-catalog": { body: CATALOG } });
    const { result } = renderHook(() => useEventCatalog(), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.groups.status).toBe("ready"));
    const groups =
      result.current.groups.status === "ready" ? result.current.groups.data : [];
    // Sorted here rather than trusted from the wire: the backend's scan order
    // is a filesystem walk.
    expect(groups.map((g) => g.module)).toEqual(["booking", "listings"]);
    expect(result.current.deliveryTypes).toEqual([
      "webhook",
      "notification",
      "ws",
      "custom",
    ]);
  });

  it("looks an event up for the picker's selected option", async () => {
    const server = mockServer({ "/event-catalog": { body: CATALOG } });
    const { result } = renderHook(() => useEventCatalog(), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.groups.status).toBe("ready"));
    expect(
      result.current.eventByName("listings.listing.published")?.module
    ).toBe("listings");
    expect(result.current.eventByName("nope")).toBeUndefined();
  });
});

describe("useSubscriptions", () => {
  it("separates a rule the BACKEND switched off from one a person did", async () => {
    const server = mockServer({
      "/subscriptions": { body: [HEALTHY, AUTO_DISABLED, NOTIFICATION_RULE] },
    });
    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    // `disabled_at` is the only thing that tells the two apart, and it is the
    // difference between "you turned this off" and "this is broken".
    expect(result.current.autoDisabled.map((r) => r.id)).toEqual([
      AUTO_DISABLED.id,
    ]);
  });

  it("a failed read is never drawn as an empty list", async () => {
    const server = mockServer({ "/subscriptions": MANDATE_UNAVAILABLE });
    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.rows.status).toBe("failed"));
    expect(result.current.autoDisabled).toEqual([]);
    if (result.current.rows.status === "failed") {
      expect(isMandateUnavailable(result.current.rows.error)).toBe(true);
    }
  });

  it("toggling active PATCHes only is_active", async () => {
    const server = mockServer({
      "PATCH /subscriptions/": { body: { ...AUTO_DISABLED, is_active: true } },
      "/subscriptions": { body: [AUTO_DISABLED] },
    });
    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    await act(async () => {
      result.current.toggleActive.mutate({ id: AUTO_DISABLED.id, isActive: true });
    });
    await waitFor(() =>
      expect(result.current.toggleActive.isSuccess).toBe(true)
    );
    const patch = server.calls.find((c) => c.method === "PATCH");
    expect(JSON.parse(patch?.body ?? "{}")).toEqual({ is_active: true });
  });

  it("names the per-owner cap rather than reporting a generic conflict", async () => {
    const server = mockServer({
      "POST /subscriptions": SUBSCRIPTION_CAP,
      "/subscriptions": { body: [] },
    });
    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: wrapper(server),
    });
    await act(async () => {
      result.current.create.mutate({
        eventType: "listings.listing.published",
        delivery: "webhook",
        target: { url: "https://hooks.example/x" },
      });
    });
    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(isSubscriptionCap(result.current.create.error)).toBe(true);
  });
});

describe("useSecretRotation — shown once, then dropped", () => {
  it("is blocked for a delivery type that carries no signature", () => {
    const server = mockServer({});
    const { result } = renderHook(
      () => useSecretRotation(NOTIFICATION_RULE.id, "notification"),
      { wrapper: wrapper(server) }
    );
    // The backend's answer here is a 400 nobody can act on, so the control is
    // gated with the reason instead of offered and refused.
    expect(result.current.rotate.available).toBe(false);
    if (!result.current.rotate.available) {
      expect(result.current.rotate.block.code).toBe(
        WEBHOOKS_I18N_KEYS.secretRotateUnsigned
      );
    }
  });

  it("is available for a signed one", () => {
    const server = mockServer({});
    const { result } = renderHook(
      () => useSecretRotation(HEALTHY.id, "webhook"),
      { wrapper: wrapper(server) }
    );
    expect(result.current.rotate.available).toBe(true);
  });

  it("holds the new secret only until it is acknowledged", async () => {
    const server = mockServer({ "/secret": { body: CREATED_WITH_SECRET } });
    const { result } = renderHook(
      () => useSecretRotation(HEALTHY.id, "webhook"),
      { wrapper: wrapper(server) }
    );
    act(() => result.current.ask());
    expect(result.current.confirming).toBe(true);

    await act(async () => {
      result.current.run();
    });
    await waitFor(() =>
      expect(result.current.secret).toBe(CREATED_WITH_SECRET.secret)
    );
    expect(result.current.confirming).toBe(false);

    // Acknowledging DROPS it: no read ever returns a secret again, so nothing
    // in this process may keep a copy after the person says they have it.
    act(() => result.current.acknowledge());
    expect(result.current.secret).toBeUndefined();
  });
});

describe("useDeliveries — the replay gate and the poll", () => {
  it("replay is available for a dead letter and refused, with the status, for the rest", async () => {
    const server = mockServer({
      "/deliveries": { body: [DELIVERY_DEAD, DELIVERY_SUCCEEDED] },
    });
    const { result } = renderHook(() => useDeliveries(HEALTHY.id), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));

    expect(result.current.replayGate(DELIVERY_DEAD).available).toBe(true);

    const refused = result.current.replayGate(DELIVERY_SUCCEEDED);
    expect(refused.available).toBe(false);
    if (!refused.available) {
      expect(refused.block.code).toBe(WEBHOOKS_I18N_KEYS.logReplayOnlyDead);
      // The reason names the status, so the sentence is about THIS row.
      expect(refused.block.params["status"]).toBe("succeeded");
    }
  });

  it("reports the poll only while something is in flight", async () => {
    const moving = mockServer({
      "/deliveries": { body: [DELIVERY_RETRYING] },
    });
    const { result } = renderHook(() => useDeliveries(HEALTHY.id), {
      wrapper: wrapper(moving),
    });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    expect(result.current.polling).toBe(true);

    const settled = mockServer({
      "/deliveries": { body: [DELIVERY_SUCCEEDED, DELIVERY_DEAD] },
    });
    const second = renderHook(() => useDeliveries(HEALTHY.id), {
      wrapper: wrapper(settled),
    });
    await waitFor(() => expect(second.result.current.rows.status).toBe("ready"));
    // A log of finished deliveries costs ONE request: a settings tab left open
    // must not spend the day asking a question whose answer stopped changing.
    expect(second.result.current.polling).toBe(false);
  });

  it("passes the status filter to the server, not to a client-side filter", async () => {
    const server = mockServer({ "/deliveries": { body: [DELIVERY_DEAD] } });
    renderHook(() => useDeliveries(HEALTHY.id, "dead"), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    expect(server.calls[0]?.url).toContain("status=dead");
  });
});

describe("useSubscriptionForm — every refusal it can answer, it answers", () => {
  const render = () =>
    renderHook(() => useSubscriptionForm(), { wrapper: wrapper(mockServer({})) });

  it("blocks on a missing event before anything is typed", () => {
    const { result } = render();
    expect(result.current.submit.available).toBe(false);
    if (!result.current.submit.available) {
      expect(result.current.submit.block.code).toBe(
        WEBHOOKS_I18N_KEYS.formNeedsEvent
      );
    }
  });

  it("blocks on a missing required target key, naming the field", () => {
    const { result } = render();
    act(() => result.current.setEventType("listings.listing.published"));
    expect(result.current.targetProblem?.code).toBe(
      WEBHOOKS_I18N_KEYS.targetMissing
    );
    expect(result.current.targetProblem?.params["field"]).toBe("url");
  });

  it("refuses an http target with the SCHEME's own sentence", () => {
    const { result } = render();
    act(() => result.current.setEventType("listings.listing.published"));
    act(() => result.current.setTargetField("url", "http://hooks.example/x"));
    // Not "invalid": the URL is well-formed and present, it is the scheme that
    // is refused, and "type https" is a fix a person can act on.
    expect(result.current.targetProblem?.code).toBe(
      WEBHOOKS_I18N_KEYS.targetInsecure
    );
  });

  it("refuses a notification that addresses nobody", () => {
    const { result } = render();
    act(() => result.current.setEventType("listings.listing.published"));
    act(() => result.current.setDelivery("notification"));
    act(() => result.current.setTargetField("notification_type", "alert"));
    expect(result.current.targetProblem?.code).toBe(
      WEBHOOKS_I18N_KEYS.targetNoRecipient
    );
  });

  it("CLEARS the target when the delivery type changes", () => {
    const { result } = render();
    act(() => result.current.setTargetField("url", "https://hooks.example/x"));
    act(() => result.current.setDelivery("ws"));
    // `{url}` and `{stream}` share no key: carrying values across would leave a
    // url in the body of a ws subscription, invisible in a form that has
    // stopped drawing that field.
    expect(result.current.fields.target).toEqual({});
  });

  it("becomes available once every half of the rule is answerable", () => {
    const { result } = render();
    act(() => result.current.setEventType("listings.listing.published"));
    act(() => result.current.setTargetField("url", "https://hooks.example/x"));
    expect(result.current.submit.available).toBe(true);
    expect(result.current.body).toEqual({
      eventType: "listings.listing.published",
      delivery: "webhook",
      target: { url: "https://hooks.example/x" },
    });
  });

  it("blocks on a predicate outside the grammar", () => {
    const { result } = render();
    act(() => result.current.setEventType("listings.listing.published"));
    act(() => result.current.setTargetField("url", "https://hooks.example/x"));
    act(() => result.current.setFilterText('{"city": {"$regex": "^Ber"}}'));
    expect(result.current.submit.available).toBe(false);
    expect(result.current.filterProblem?.code).toBe(
      WEBHOOKS_I18N_KEYS.filterUnknownFieldOp
    );
  });

  it("an edit sends only what MOVED", () => {
    const { result } = renderHook(() => useSubscriptionForm(HEALTHY), {
      wrapper: wrapper(mockServer({})),
    });
    // Seeded from the row: nothing has changed, so the patch is empty and the
    // save is a write that would write nothing.
    expect(result.current.patch).toEqual({});
    act(() => result.current.setDescription("Something else"));
    expect(result.current.patch).toEqual({ description: "Something else" });
  });

  it("seeds the filter editor from the stored predicate", () => {
    const { result } = renderHook(() => useSubscriptionForm(HEALTHY), {
      wrapper: wrapper(mockServer({})),
    });
    expect(JSON.parse(result.current.fields.filterText)).toEqual({
      city: "Berlin",
    });
  });
});
