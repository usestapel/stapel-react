/**
 * THE QUALIFIER SLOT MAY SHRINK.
 *
 * A six-width walk of a client storefront measured the feed card's seller
 * line at 575 CSS px inside a 360px viewport, and a review count cut mid-word
 * at 768. The cause was one declaration: the trailing slot was
 * `flex-shrink: 0`, so a rating badge that wraps its own parts was never
 * handed a width narrow enough to wrap in, and the row grew past its
 * container instead.
 *
 * jsdom lays nothing out, so the measurement itself cannot be reproduced
 * here. What CAN be asserted is the rule that produces it: neither end of the
 * line is rigid, and both may shrink to zero before the row does.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PersonRow } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import type { ProfileBatchEntry } from "../src/model/profileBatch.js";

const ALICE = "b3f1c0de-0000-4000-8000-0000000000a1";

function found(): ProfileBatchEntry {
  return {
    status: "found",
    profile: {
      user_id: ALICE,
      display_name: "Мастерская «МастерДом»",
      avatar: null,
      location_display_name_narrow: null,
      location_display_name_broad: null,
      relationship_status: "neutral",
    } as ProfileBatchEntry["profile"],
  };
}

function mount(node: ReactElement): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "ru" });
  registerProfilesI18n(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

/** A stand-in for `<RatingBadge>`: a block that wraps its own parts, which it
 * can only do inside a slot that is allowed to be narrower than its content. */
function WideTrailing(): ReactElement {
  return (
    <span data-testid="badge">★★★★★ 4.8 из 5 · 128 отзывов</span>
  );
}

function trailingSlot(container: HTMLElement): HTMLElement {
  const slot = container.querySelector("[data-stapel-person-trailing]");
  expect(slot).not.toBeNull();
  return slot as HTMLElement;
}

describe("<PersonRow trailing>", () => {
  it("lets the compact line's qualifier shrink instead of widening the row", () => {
    const { container } = mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        size="compact"
        testId="row"
        trailing={<WideTrailing />}
      />
    );
    const slot = trailingSlot(container);
    // The three declarations, together, ARE the fix: a slot that asks for its
    // content's width (`auto` basis), gives it back under pressure (shrink 1)
    // and has no floor of its own (`min-inline-size: 0`).
    expect(slot.style.flex).toBe("0 1 auto");
    expect(slot.style.minInlineSize).toBe("0");
    // And the thing that was there before is not: a rigid slot is the defect.
    expect(slot.style.flexShrink).not.toBe("0");
  });

  it("keeps the same rule on the stacked row", () => {
    const { container } = mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        testId="row"
        trailing={<WideTrailing />}
      />
    );
    const slot = trailingSlot(container);
    expect(slot.style.flex).toBe("0 1 auto");
    expect(slot.style.minInlineSize).toBe("0");
  });

  it("leaves the lead free to shrink too — neither end is the rigid one", () => {
    const { container } = mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        size="compact"
        testId="row"
        trailing={<WideTrailing />}
      />
    );
    // The line itself: every flex container between the row and the two ends
    // states `min-width: 0`, which is what lets a shrink reach them at all.
    const slot = trailingSlot(container);
    const line = slot.parentElement as HTMLElement;
    expect(line.style.minWidth).toBe("0");
    // Both are still on the line, in reading order.
    const text = screen.getByTestId("row").textContent ?? "";
    expect(text.indexOf("Мастерская")).toBeLessThan(text.indexOf("4.8"));
  });
});
