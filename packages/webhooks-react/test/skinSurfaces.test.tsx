import { afterEach, describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  DeliveriesPane,
  DeliveryDetailSheet,
  MandateNotice,
  SecretReveal,
  SecretRotation,
  SubscriptionSheet,
  SubscriptionsPane,
  WebhooksSettingsPane,
} from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
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

/**
 * Every wired surface, in all four frames — phone and desk, light and dark.
 *
 * The defect class this is the machine form of: a skin that exists and is
 * never mounted. A matrix that draws each surface at both widths and in both
 * modes is what turns "the pair ships a face" from a claim into a check, and
 * the `data-stapel-skin-mode` assertion additionally proves the skin is
 * SUBSCRIBED to the host's theme rather than having sampled a default at
 * import time.
 */
function everyRead(): MockServer {
  return mockServer({
    "/event-catalog": { body: CATALOG },
    "/deliveries/": { body: DELIVERY_DEAD },
    "/deliveries": { body: [DELIVERY_DEAD, DELIVERY_SUCCEEDED] },
    "/secret": { body: CREATED_WITH_SECRET },
    "/subscriptions": { body: [HEALTHY, NOTIFICATION_RULE, AUTO_DISABLED] },
  });
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

const JSDOM_DEFAULT_WIDTH = 1024;
afterEach(() => {
  setViewportWidth(JSDOM_DEFAULT_WIDTH);
  document.documentElement.removeAttribute("data-theme");
});

const SURFACES: readonly (readonly [string, () => ReactElement])[] = [
  ["WebhooksSettingsPane", () => <WebhooksSettingsPane />],
  ["SubscriptionsPane", () => <SubscriptionsPane />],
  [
    "SubscriptionSheet",
    () => <SubscriptionSheet open onClose={() => undefined} />,
  ],
  [
    "SecretReveal",
    () => (
      <SecretReveal
        secret={CREATED_WITH_SECRET.secret}
        onAcknowledge={() => undefined}
      />
    ),
  ],
  [
    "SecretRotation",
    () => (
      <SecretRotation
        subscriptionId={HEALTHY.id}
        deliveryType={HEALTHY.delivery}
        hasSecret
      />
    ),
  ],
  ["DeliveriesPane", () => <DeliveriesPane subscriptionId={HEALTHY.id} />],
  [
    "DeliveryDetailSheet",
    () => (
      <DeliveryDetailSheet
        open
        onClose={() => undefined}
        subscriptionId={HEALTHY.id}
        deliveryId={DELIVERY_DEAD.id}
      />
    ),
  ],
  ["MandateNotice", () => <MandateNotice onRetry={() => undefined} />],
];

const FRAMES: readonly (readonly [string, number, "light" | "dark"])[] = [
  ["phone-light", 390, "light"],
  ["phone-dark", 390, "dark"],
  ["desktop-light", 1280, "light"],
  ["desktop-dark", 1280, "dark"],
];

describe("every wired surface renders in all four frames", () => {
  for (const [name, ui] of SURFACES) {
    for (const [frame, width, mode] of FRAMES) {
      it(`${name} — ${frame}`, async () => {
        setViewportWidth(width);
        document.documentElement.setAttribute("data-theme", mode);
        const { container, baseElement } = render(
          <TestProviders server={everyRead()}>{ui()}</TestProviders>
        );
        const root = baseElement.querySelector("[data-stapel-skin-mode]");
        expect(root?.getAttribute("data-stapel-skin-mode")).toBe(mode);
        await waitFor(() =>
          expect(
            baseElement.querySelector("[data-stapel-load-state='loading']")
          ).toBeNull()
        );
        expect(
          (container.textContent?.length ?? 0) +
            (baseElement.textContent?.length ?? 0)
        ).toBeGreaterThan(0);
      });
    }
  }
});

describe("a runtime theme flip repaints a mounted skin", () => {
  it("follows `data-theme` without a remount", async () => {
    const { container } = render(
      <TestProviders server={everyRead()}>
        <SubscriptionsPane />
      </TestProviders>
    );
    const root = (): Element | null =>
      container.querySelector("[data-stapel-skin-mode]");
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("light");
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    // The defect this replaces: a skin that SAMPLED the document once per
    // render left a shell's dark toggle applying to everything except the
    // panes that had not re-rendered for an unrelated reason.
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("dark");
  });
});

describe("dialogs are bottom sheets on a phone", () => {
  it("the subscription sheet is a sheet at 390 and a modal at 1280", async () => {
    setViewportWidth(390);
    const phone = render(
      <TestProviders server={everyRead()}>
        <SubscriptionSheet open onClose={() => undefined} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(
        phone.baseElement.querySelector("[data-stapel-dialog-surface]")
      ).not.toBeNull()
    );
    expect(
      phone.baseElement
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("sheet");
    phone.unmount();

    setViewportWidth(1280);
    const desk = render(
      <TestProviders server={everyRead()}>
        <SubscriptionSheet open onClose={() => undefined} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(
        desk.baseElement.querySelector("[data-stapel-dialog-surface]")
      ).not.toBeNull()
    );
    expect(
      desk.baseElement
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("modal");
  });
});
