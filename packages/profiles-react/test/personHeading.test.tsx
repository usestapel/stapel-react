/**
 * A PERSON'S NAME CAN BE THE PAGE'S HEADING, AND THE FACE CAN LEAVE THE ROW.
 *
 * On a seller page the person's name is the subject of the document and this
 * component drew it as a `<span>`: a screen reader's heading list skipped
 * straight past it, and a storefront that wanted the outline right had to
 * rebuild the row — which is how a user id gets back onto the glass, the one
 * defect `<PersonRow>` exists to prevent. `<PersonAvatar>` was the other half
 * of the same ask: a face in a chat gutter or a table cell, with no room for a
 * row around it.
 *
 * What this suite pins is that both are ADDITIVE. `headingLevel` changes the
 * element and nothing else; omitted, the row is exactly what it was.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PersonAvatar, PersonRow } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import type { ProfileBatchEntry } from "../src/model/profileBatch.js";
import type { PublicProfile } from "../src/index.js";

const ALICE = "b3f1c0de-0000-4000-8000-0000000000a1";
const AVATAR = {
  source: "cdn",
  url: "https://cdn.example.test/avatar/original.jpg",
  mime: "image/jpeg",
  width: 400,
  height: 400,
  aspect: 1,
  square: true,
  preview_b64: null,
  variants: [
    { tier: "160", branch: "w", url: "https://cdn.example.test/avatar/160.jpg", width: 160, height: 160 },
  ],
};

function profileOf(overrides: Record<string, unknown> = {}): PublicProfile {
  return {
    user_id: ALICE,
    display_name: "Alice Nguyen",
    avatar: null,
    avatar_image: null,
    location_display_name_narrow: null,
    location_display_name_broad: null,
    relationship_status: "neutral",
    ...overrides,
  } as unknown as PublicProfile;
}

function found(overrides: Record<string, unknown> = {}): ProfileBatchEntry {
  return { status: "found", profile: profileOf(overrides) };
}

function mount(node: ReactElement): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

describe("<PersonRow headingLevel>", () => {
  it("draws no heading at all by default — a list of people is not a list of headings", () => {
    const { container } = mount(
      <PersonRow entry={found()} userId={ALICE} testId="row" />
    );
    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(screen.getByText("Alice Nguyen")).toBeTruthy();
  });

  it("makes the NAME the heading at the level the host names", () => {
    for (const level of [1, 2, 3, 4] as const) {
      const { container, unmount } = mount(
        <PersonRow
          entry={found()}
          userId={ALICE}
          headingLevel={level}
          testId="row"
        />
      );
      const heading = container.querySelector(`h${String(level)}`);
      expect(heading, `h${String(level)}`).not.toBeNull();
      expect(heading?.textContent).toContain("Alice Nguyen");
      // Only the ELEMENT changes: no browser heading margin inside a row.
      expect((heading as HTMLElement).style.margin).toBe("0px");
      unmount();
    }
  });

  it("is announced as a heading, so a heading list reaches the subject of the page", () => {
    mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        headingLevel={2}
        size="header"
        testId="row"
      />
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "Alice Nguyen"
    );
  });

  it("puts the heading AROUND the link, never the link around the heading", () => {
    const { container } = mount(
      <PersonRow
        entry={found()}
        userId={ALICE}
        headingLevel={2}
        href={`/u/${ALICE}`}
        testId="row"
      />
    );
    const heading = container.querySelector("h2");
    expect(heading?.querySelector("a")?.getAttribute("href")).toBe(`/u/${ALICE}`);
    // …and not the other way round.
    expect(container.querySelector("a h2")).toBeNull();
  });

  it("only names a person it HAS — the skeleton stays a skeleton", () => {
    const { container } = mount(
      <PersonRow
        entry={{ status: "unknown" }}
        userId={ALICE}
        headingLevel={2}
        testId="pending"
      />
    );
    expect(container.querySelector("h2")).toBeNull();
    expect(screen.getByTestId("pending").dataset["stapelPerson"]).toBe("pending");
  });
});

describe("<PersonAvatar>", () => {
  it("draws the backend descriptor through <Image> at the side it is given", () => {
    const { container } = mount(
      <PersonAvatar
        profile={profileOf({ avatar_image: AVATAR })}
        fallbackName="Alice Nguyen"
        side={40}
      />
    );
    // <Image> owns the box and picks its ladder rung from a MEASURED slot, so
    // what a jsdom render proves is the branch taken, not the rung chosen:
    // there is no monogram, and the box is the side asked for.
    expect(container.querySelector(".ant-avatar")).toBeNull();
    expect(screen.queryByText("AN")).toBeNull();
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.width).toBe("40px");
    expect(box.style.height).toBe("40px");
    expect(box.style.borderRadius).toBe("50%");
  });

  it("falls to a monogram — never a broken <img> — when there is no descriptor", () => {
    const { container } = mount(
      <PersonAvatar profile={null} fallbackName="Alice Nguyen" side={40} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AN")).toBeTruthy();
  });
});
