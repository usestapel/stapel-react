/**
 * A SELLER'S NAME IS A LINK.
 *
 * `<PersonRow/>` could only ever be activated by `onOpen` — a click handler on
 * a `role="button"` div. To a browser that is not navigation: no middle click,
 * no "open in new tab", no "copy link address", no status bar, nothing for a
 * crawler. A storefront put this row under "message the seller" on its listing
 * page, where a reader reaches for all four, and worked around the gap by
 * wrapping the whole row in its own anchor — which nests a button inside a
 * link.
 *
 * So the row takes `href` (the name becomes a real anchor) and
 * `linkComponent` (core's router seam, so a SPA does not reload). What this
 * suite pins is the SHAPE the DOM ends up in, because that is what the four
 * affordances come from — and, in particular, that the row does not become a
 * button AND a link at once.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { PersonRow } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import type { ProfileBatchEntry } from "../src/model/profileBatch.js";

const ALICE = "b3f1c0de-0000-4000-8000-0000000000a1";

const FOUND: ProfileBatchEntry = {
  status: "found",
  profile: {
    user_id: ALICE,
    display_name: "Alice Nguyen",
    avatar: null,
    location_display_name_narrow: null,
    location_display_name_broad: null,
    relationship_status: "neutral",
  } as ProfileBatchEntry["profile"],
};

function mount(node: ReactElement): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

describe("a row with no href is exactly what it was", () => {
  it("renders the name as text, with no anchor anywhere", () => {
    const { container } = mount(
      <PersonRow entry={FOUND} userId={ALICE} testId="row" />
    );
    expect(screen.getByText("Alice Nguyen")).toBeTruthy();
    expect(container.querySelector("a")).toBeNull();
  });

  it("still becomes a button for a host that wired only `onOpen`", () => {
    const onOpen = vi.fn();
    mount(
      <PersonRow entry={FOUND} userId={ALICE} testId="row" onOpen={onOpen} />
    );
    const row = screen.getByTestId("row");
    expect(row.getAttribute("role")).toBe("button");
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(ALICE);
  });
});

describe("a row with an href", () => {
  it("makes the NAME a real anchor to the host's route", () => {
    const { container } = mount(
      <PersonRow entry={FOUND} userId={ALICE} href={`/u/${ALICE}`} testId="row" />
    );
    const anchor = container.querySelector("a");
    expect(anchor).toBeTruthy();
    // The four affordances all come from this one attribute being real.
    expect(anchor?.getAttribute("href")).toBe(`/u/${ALICE}`);
    expect(anchor?.textContent).toContain("Alice Nguyen");
  });

  it("does NOT also make the row a button — one destination, one element", () => {
    mount(
      <PersonRow
        entry={FOUND}
        userId={ALICE}
        href={`/u/${ALICE}`}
        onOpen={() => undefined}
        testId="row"
      />
    );
    expect(screen.getByTestId("row").getAttribute("role")).toBeNull();
  });

  it("still notifies `onOpen` on the click, without swallowing the navigation", () => {
    const onOpen = vi.fn();
    const { container } = mount(
      <PersonRow
        entry={FOUND}
        userId={ALICE}
        href={`/u/${ALICE}`}
        onOpen={onOpen}
        testId="row"
      />
    );
    const anchor = container.querySelector("a");
    // Read the flag AFTER React's own handler has run (it listens on the
    // root container, which this document listener follows) and stop jsdom
    // from trying to navigate for real.
    let cancelledByTheRow = true;
    const watch = (event: Event): void => {
      cancelledByTheRow = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", watch);
    fireEvent.click(anchor as Element);
    document.removeEventListener("click", watch);
    expect(onOpen).toHaveBeenCalledWith(ALICE);
    // The anchor navigates; the callback rides beside it and never cancels.
    expect(cancelledByTheRow).toBe(false);
  });

  it("routes through the host's `<Link>` when one is given", () => {
    const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
      <a href={href} data-router="yes" {...rest}>
        {children}
      </a>
    );
    const { container } = mount(
      <PersonRow
        entry={FOUND}
        userId={ALICE}
        href={`/u/${ALICE}`}
        linkComponent={RouterLink}
        testId="row"
      />
    );
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("data-router")).toBe("yes");
    // The pair's own hooks reach the DOM through a host component that
    // spreads its rest props — the whole reason the seam has a `data-*` index.
    expect(anchor?.getAttribute("data-stapel-person-link")).toBe("");
  });

  it("links a person the batch could not name, too — the row is still theirs", () => {
    const { container } = mount(
      <PersonRow
        entry={{ status: "missing", profile: null }}
        userId={ALICE}
        href={`/u/${ALICE}`}
        testId="row"
      />
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      `/u/${ALICE}`
    );
  });

  it("draws no link at all while the batch has not answered", () => {
    // A skeleton is not a person yet, and a link to a name nobody has read
    // is a target with nothing in it.
    const { container } = mount(
      <PersonRow
        entry={{ status: "unknown", profile: null }}
        userId={ALICE}
        href={`/u/${ALICE}`}
        testId="row"
      />
    );
    expect(container.querySelector("a")).toBeNull();
  });
});
