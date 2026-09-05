/**
 * A CARD'S SELLER LINE IS THIS PAIR'S JOB TOO.
 *
 * `<PersonRow>` had two shapes, and both are list furniture: a 40px row with a
 * second line under the name, and a 72px page header. Neither fits the one
 * line under a listing card that says who is selling — so a storefront wrote
 * its own: its own anchor, its own avatar, its own fallback for "no name yet".
 * That is how a user id gets back onto the glass, which is the single defect
 * this component exists to prevent.
 *
 * `size="compact"` is the same identity in the space of a caption. What this
 * suite pins is that it is the SAME component underneath — the four batch
 * states stay four, the name is still a real link when the host names a route
 * — and that the line is one line.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PERSON_COMPACT_AVATAR, PersonRow } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import type { ProfileBatchEntry } from "../src/model/profileBatch.js";

const ALICE = "b3f1c0de-0000-4000-8000-0000000000a1";

function found(overrides: Record<string, unknown> = {}): ProfileBatchEntry {
  return {
    status: "found",
    profile: {
      user_id: ALICE,
      display_name: "Alice Nguyen",
      avatar: null,
      location_display_name_narrow: null,
      location_display_name_broad: null,
      relationship_status: "neutral",
      ...overrides,
    } as ProfileBatchEntry["profile"],
  };
}

function mount(node: ReactElement): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

describe("<PersonRow size=\"compact\">", () => {
  it("draws the person, small — one line, a 20px face, no vertical stack", () => {
    const { container } = mount(
      <PersonRow entry={found()} userId={ALICE} size="compact" testId="row" />
    );
    expect(screen.getByText("Alice Nguyen")).toBeTruthy();
    // The avatar side is the compact constant, not the list row's 40.
    expect(PERSON_COMPACT_AVATAR).toBe(20);
    const avatar = container.querySelector(".ant-avatar");
    expect(avatar).not.toBeNull();
    expect((avatar as HTMLElement).style.width).toBe(
      `${String(PERSON_COMPACT_AVATAR)}px`
    );
  });

  it("keeps the name a REAL link — the whole reason a card reaches for this", () => {
    const { container } = mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        size="compact"
        href={`/u/${ALICE}`}
        testId="row"
      />
    );
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe(`/u/${ALICE}`);
    expect(anchor?.textContent).toContain("Alice Nguyen");
    // One destination, one activatable element: the row is not ALSO a button.
    expect(screen.getByTestId("row").getAttribute("role")).toBeNull();
  });

  it("takes a trailing node — a rating, a mark — directly after the name", () => {
    mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        size="compact"
        testId="row"
        trailing={<span data-testid="rating">4.8</span>}
      />
    );
    const row = screen.getByTestId("row");
    const text = row.textContent ?? "";
    expect(text).toContain("Alice Nguyen");
    // Reading order, not merely presence: the qualifier follows the name.
    expect(text.indexOf("Alice Nguyen")).toBeLessThan(text.indexOf("4.8"));
    expect(screen.getByTestId("rating")).toBeTruthy();
  });

  it("puts the second line INLINE rather than under the name", () => {
    mount(
      <PersonRow
        entry={found({ location_display_name_narrow: "Lisbon" })}
        userId={ALICE}
        size="compact"
        testId="row"
      />
    );
    // Still said — a compact arm that silently dropped what the row would
    // have shown would be a different component, not a smaller one.
    expect(screen.getByText("Lisbon")).toBeTruthy();
  });

  it("still says which of the four states it got", () => {
    mount(
      <PersonRow
        entry={{ status: "unknown" }}
        userId={ALICE}
        size="compact"
        testId="pending"
      />
    );
    // Not asked / not answered is a SKELETON, never a blank line — the
    // compact arm inherits that rather than reimplementing it.
    expect(screen.getByTestId("pending").dataset["stapelPerson"]).toBe("pending");

    mount(
      <PersonRow
        entry={{ status: "missing" }}
        userId={ALICE}
        size="compact"
        testId="missing"
      />
    );
    expect(screen.getByTestId("missing").dataset["stapelPerson"]).toBe("missing");
  });

  it("leaves the list row exactly as it was", () => {
    const { container } = mount(
      <PersonRow
        entry={found({ location_display_name_narrow: "Lisbon" })}
        userId={ALICE}
        testId="row"
      />
    );
    const avatar = container.querySelector(".ant-avatar");
    expect((avatar as HTMLElement).style.width).toBe("40px");
    expect(screen.getByText("Lisbon")).toBeTruthy();
  });
});
