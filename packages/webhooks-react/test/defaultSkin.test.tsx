import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DeliveriesPane,
  SecretReveal,
  SecretRotation,
  SubscriptionSheet,
  SubscriptionsPane,
  WebhooksSettingsPane,
} from "../src/default/index.js";
import {
  MANDATE_UNAVAILABLE,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  AUTO_DISABLED,
  CATALOG,
  CREATED_WITH_SECRET,
  DELIVERY_DEAD,
  DELIVERY_SUCCEEDED,
  HEALTHY,
  NOTIFICATION_RULE,
} from "./fixtures.js";

function reads(): MockServer {
  return mockServer({
    "/event-catalog": { body: CATALOG },
    "/deliveries/": { body: DELIVERY_DEAD },
    "/deliveries": { body: [DELIVERY_DEAD, DELIVERY_SUCCEEDED] },
    "/secret": { body: CREATED_WITH_SECRET },
    "/subscriptions": { body: [HEALTHY, NOTIFICATION_RULE, AUTO_DISABLED] },
  });
}

describe("<SubscriptionsPane> — the list says what it knows", () => {
  it("marks the rule the BACKEND switched off, with the date", async () => {
    render(
      <TestProviders server={reads()}>
        <SubscriptionsPane />
      </TestProviders>
    );
    const auto = await screen.findByTestId(
      `webhooks-subscriptions-auto-${AUTO_DISABLED.id}`
    );
    // "after repeated failures" — never a number: the threshold is a
    // deployment setting the API does not serve (BACKEND-GAP W-7).
    expect(auto.textContent).toContain("repeated");
    expect(auto.textContent).not.toMatch(/\b5\b/);
  });

  it("gives the active switch an accessible name", async () => {
    render(
      <TestProviders server={reads()}>
        <SubscriptionsPane />
      </TestProviders>
    );
    const toggle = await screen.findByTestId(
      `webhooks-subscriptions-active-${HEALTHY.id}`
    );
    expect(toggle.getAttribute("aria-label")).toBeTruthy();
  });

  it("says that re-activating clears the failure count", async () => {
    render(
      <TestProviders server={reads()}>
        <SubscriptionsPane />
      </TestProviders>
    );
    await screen.findByTestId(`webhooks-subscriptions-active-${AUTO_DISABLED.id}`);
    // `services.py` resets `consecutive_failures` and `disabled_at` on
    // activation: the person is told they get the full ladder again, not one
    // more attempt.
    expect(document.body.textContent).toContain("failure count");
  });

  it("delete asks first, and names what goes with it", async () => {
    render(
      <TestProviders server={reads()}>
        <SubscriptionsPane />
      </TestProviders>
    );
    const remove = await screen.findByTestId(
      `webhooks-subscriptions-remove-${HEALTHY.id}`
    );
    fireEvent.click(remove);
    const confirm = await screen.findByTestId(
      "webhooks-subscriptions-remove-confirm"
    );
    expect(
      confirm.querySelector("[data-stapel-confirm]")?.getAttribute(
        "data-stapel-confirm"
      )
    ).toBe("danger");
    // The delete CASCADES the delivery log — the one consequence that is not
    // obvious from the button.
    expect(document.body.textContent).toContain("delivery history");
  });

  it("names the mandate 503 instead of drawing an operations failure", async () => {
    const server = mockServer({
      "/event-catalog": { body: CATALOG },
      "/subscriptions": MANDATE_UNAVAILABLE,
    });
    render(
      <TestProviders server={server}>
        <SubscriptionsPane />
      </TestProviders>
    );
    const notice = await screen.findByTestId("webhooks-subscriptions-mandate");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toContain("workspace access");
  });
});

describe("<DeliveriesPane> — the log states its retention and gates its replay", () => {
  it("says how long a delivery row survives", async () => {
    render(
      <TestProviders server={reads()}>
        <DeliveriesPane subscriptionId={HEALTHY.id} />
      </TestProviders>
    );
    const note = await screen.findByTestId("webhooks-log-retention");
    // Without this line "my delivery disappeared" and "my delivery was never
    // recorded" are the same screen.
    expect(note.textContent).toContain("7");
    expect(note.textContent).toContain("90");
  });

  it("offers replay on the dead letter and refuses it, with a reason, elsewhere", async () => {
    const { baseElement } = render(
      <TestProviders server={reads()}>
        <DeliveriesPane subscriptionId={HEALTHY.id} />
      </TestProviders>
    );
    await screen.findByTestId("webhooks-log-rows");

    const dead = baseElement.querySelector(
      `[data-testid="webhooks-log-replay-${DELIVERY_DEAD.id}-gate"]`
    );
    expect(dead?.getAttribute("data-stapel-gated")).toBe("available");

    const alive = baseElement.querySelector(
      `[data-testid="webhooks-log-replay-${DELIVERY_SUCCEEDED.id}-gate"]`
    );
    expect(alive?.getAttribute("data-stapel-gated")).toBe("blocked");
    // The reason is BESIDE the control, not in a tooltip a disabled button
    // never fires the events for.
    expect(
      alive?.querySelector("[data-stapel-gated-reason]")?.textContent
    ).toContain("dead letter");
  });

  it("opens a detail sheet with the rebuilt envelope and headers", async () => {
    const { baseElement } = render(
      <TestProviders server={reads()}>
        <DeliveriesPane subscriptionId={HEALTHY.id} />
      </TestProviders>
    );
    await screen.findByTestId("webhooks-log-rows");
    fireEvent.click(screen.getByTestId(`webhooks-log-open-${DELIVERY_DEAD.id}`));

    const headers = await screen.findByTestId(
      "webhooks-log-detail-headers"
    );
    expect(headers.textContent).toContain("X-Stapel-Delivery");
    expect(headers.textContent).toContain("X-Stapel-Attempt");
    // The signature is NOT reconstructed: it is an HMAC with a secret this
    // client does not hold, and a fabricated one would be the single most
    // misleading row on a debugging screen.
    expect(headers.textContent).not.toContain("X-Stapel-Signature");

    const envelope = await screen.findByTestId("webhooks-log-detail-envelope");
    expect(envelope.textContent).toContain(DELIVERY_DEAD.event_id);
    expect(baseElement.textContent).toContain("Rebuilt from the stored event");
  });
});

describe("<SecretReveal> — shown once, and it says so", () => {
  it("labels the copy control and gates the exit on the acknowledgement", async () => {
    const seen: string[] = [];
    render(
      <TestProviders server={reads()}>
        <SecretReveal
          secret={CREATED_WITH_SECRET.secret}
          onAcknowledge={() => seen.push("ack")}
        />
      </TestProviders>
    );
    const copy = screen.getByTestId("webhooks-secret-copy");
    expect(copy.getAttribute("aria-label")).toBeTruthy();

    const done = screen.getByTestId("webhooks-secret-done");
    expect(done.hasAttribute("disabled")).toBe(true);
    // The reason is stated beside the control — the checkbox IS the reason.
    expect(done.getAttribute("data-disabled-reason")).toBeTruthy();

    fireEvent.click(screen.getByTestId("webhooks-secret-ack"));
    await waitFor(() => expect(done.hasAttribute("disabled")).toBe(false));
    fireEvent.click(done);
    expect(seen).toEqual(["ack"]);
  });

  it("shows the value as text, so a refused clipboard is not a dead end", () => {
    render(
      <TestProviders server={reads()}>
        <SecretReveal
          secret={CREATED_WITH_SECRET.secret}
          onAcknowledge={() => undefined}
        />
      </TestProviders>
    );
    expect(screen.getByTestId("webhooks-secret-value").textContent).toBe(
      CREATED_WITH_SECRET.secret
    );
  });

  it("draws no docs link when the host gave none", () => {
    render(
      <TestProviders server={reads()}>
        <SecretReveal secret="s" onAcknowledge={() => undefined} />
      </TestProviders>
    );
    expect(screen.queryByTestId("webhooks-secret-docs")).toBeNull();
  });
});

describe("<SecretRotation> — the break is named before it happens", () => {
  it("gates rotation for an unsigned delivery type, with the reason beside it", () => {
    const { baseElement } = render(
      <TestProviders server={reads()}>
        <SecretRotation
          subscriptionId={NOTIFICATION_RULE.id}
          deliveryType="notification"
          hasSecret={false}
        />
      </TestProviders>
    );
    const gate = baseElement.querySelector(
      '[data-testid="webhooks-rotate-button-gate"]'
    );
    expect(gate?.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(
      gate?.querySelector("[data-stapel-gated-reason]")?.textContent
    ).toContain("not signed");
  });

  it("confirms with the consequence, then shows the secret exactly once", async () => {
    render(
      <TestProviders server={reads()}>
        <SecretRotation
          subscriptionId={HEALTHY.id}
          deliveryType="webhook"
          hasSecret
        />
      </TestProviders>
    );
    fireEvent.click(screen.getByTestId("webhooks-rotate-button"));
    const confirm = await screen.findByTestId("webhooks-rotate-confirm");
    expect(
      confirm.querySelector("[data-stapel-confirm]")?.getAttribute(
        "data-stapel-confirm"
      )
    ).toBe("danger");
    // No overlap window: the sentence, not "are you sure?".
    expect(document.body.textContent).toContain("stops working immediately");

    await act(async () => {
      fireEvent.click(screen.getByTestId("stapel-confirm-ok"));
    });
    const value = await screen.findByTestId("webhooks-rotate-secret-value");
    expect(value.textContent).toBe(CREATED_WITH_SECRET.secret);

    // Acknowledging takes it away, and nothing can bring it back.
    fireEvent.click(screen.getByTestId("webhooks-rotate-secret-ack"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("webhooks-rotate-secret-done"));
    });
    await waitFor(() =>
      expect(screen.queryByTestId("webhooks-rotate-secret-value")).toBeNull()
    );
  });
});

describe("<SubscriptionSheet> — the picker and the refusals", () => {
  it("offers only events the deployment emits, grouped by module", async () => {
    render(
      <TestProviders server={reads()}>
        <SubscriptionSheet open onClose={() => undefined} />
      </TestProviders>
    );
    await screen.findByTestId("webhooks-sheet-event");
    // The catalogue read happened — the picker is not a hardcoded list.
    expect(document.body.textContent).toContain("modules installed here");
  });

  it("blocks the submit with the reason beside the button", async () => {
    const { baseElement } = render(
      <TestProviders server={reads()}>
        <SubscriptionSheet open onClose={() => undefined} />
      </TestProviders>
    );
    await screen.findByTestId("webhooks-sheet-form");
    const gate = baseElement.querySelector(
      '[data-testid="webhooks-sheet-submit-gate"]'
    );
    expect(gate?.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(
      gate?.querySelector("[data-stapel-gated-reason]")?.textContent
    ).toContain("event");
  });

  it("names the operator and the path of a predicate it will not run", async () => {
    render(
      <TestProviders server={reads()}>
        <SubscriptionSheet
          open
          onClose={() => undefined}
          subscription={{ ...HEALTHY, filter: { city: { $regex: "^Ber" } } }}
        />
      </TestProviders>
    );
    const problem = await screen.findByTestId("webhooks-sheet-filter-problem");
    expect(problem.textContent).toContain("$regex");
    expect(problem.textContent).toContain("city");
  });

  it("keeps the create's secret on screen instead of closing on success", async () => {
    const server = mockServer({
      "/event-catalog": { body: CATALOG },
      "POST /subscriptions": { status: 201, body: CREATED_WITH_SECRET },
      "/subscriptions": { body: [] },
    });
    let closed = false;
    render(
      <TestProviders server={server}>
        <SubscriptionSheet
          open
          onClose={() => {
            closed = true;
          }}
        />
      </TestProviders>
    );
    await screen.findByTestId("webhooks-sheet-form");
    fireEvent.change(screen.getByTestId("webhooks-sheet-target-url"), {
      target: { value: "https://hooks.example/x" },
    });
    // The event picker is an antd Select; drive the form's state the way the
    // person does through the one control a test can reach deterministically.
    fireEvent.mouseDown(
      screen.getByTestId("webhooks-sheet-event").querySelector("input") ??
        screen.getByTestId("webhooks-sheet-event")
    );
    const option = await screen.findByTitle("listings.listing.published");
    await act(async () => {
      fireEvent.click(option);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("webhooks-sheet-submit"));
    });
    const value = await screen.findByTestId("webhooks-sheet-secret-value");
    expect(value.textContent).toBe(CREATED_WITH_SECRET.secret);
    // A sheet that closed on success would throw the only copy of the secret
    // away with it.
    expect(closed).toBe(false);
  });
});

describe("<WebhooksSettingsPane> — the page a route mounts", () => {
  it("renders the receiver-docs link only when the host supplied one", async () => {
    const withDocs = render(
      <TestProviders server={reads()} docsHref="https://docs.example/verify">
        <WebhooksSettingsPane />
      </TestProviders>
    );
    expect(await screen.findByTestId("webhooks-settings-docs")).toBeTruthy();
    withDocs.unmount();

    render(
      <TestProviders server={reads()}>
        <WebhooksSettingsPane />
      </TestProviders>
    );
    await screen.findByTestId("webhooks-settings");
    expect(screen.queryByTestId("webhooks-settings-docs")).toBeNull();
  });
});
