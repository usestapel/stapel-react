/**
 * One click, one navigation — storefront Wave D, named gap G-2.
 *
 * `<ListingCard>` took `href` and `onOpen` as two optional props and rendered
 * BOTH when both were given: the handler ran, the container routed, and the
 * browser then followed the anchor that was still sitting on the button. The
 * storefront's workaround was to pass `onOpen` alone, which cost the most
 * linkable element in the app its anchor — no middle-click, no "open in new
 * tab", nothing for a crawler.
 *
 * The claim under test is therefore about the DOM, not about a prop: whatever
 * the card is given, exactly one navigation mechanism reaches the page.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LinkComponent } from "@stapel/core";
import { ListingCard } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

/** A container's router adapter — the one line a host writes. */
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <span role="link" data-router-to={href} {...rest}>
    {children}
  </span>
);

describe("the open control is exactly one thing", () => {
  it("href alone renders an anchor and no click handler that navigates", () => {
    const { container } = render(providers(<ListingCard listing={CARD} href="/l/7" />));
    const open = screen.getByTestId("listings-card-open");
    expect(open.tagName).toBe("A");
    expect(open.getAttribute("href")).toBe("/l/7");
    // One anchor for one card: the only navigation on the page.
    expect(container.querySelectorAll('a[href="/l/7"]')).toHaveLength(1);
  });

  it("onOpen alone renders a button with no href for the browser to follow", () => {
    const onOpen = vi.fn();
    const { container } = render(
      providers(<ListingCard listing={CARD} onOpen={onOpen} />)
    );
    const open = screen.getByTestId("listings-card-open");
    expect(open.tagName).toBe("BUTTON");
    expect(open.hasAttribute("href")).toBe(false);
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);

    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("a linkComponent takes over the anchor, so nothing reloads the page", () => {
    const { container } = render(
      providers(
        <ListingCard listing={CARD} href="/l/7" linkComponent={RouterLink} />
      )
    );
    // The host's component is the ONLY navigation: no `<a href>` is rendered
    // directly, which is what makes a click stay inside the SPA.
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
    const open = screen.getByTestId("listings-card-open");
    expect(open.getAttribute("data-router-to")).toBe("/l/7");
  });

  it("neither renders no open control at all", () => {
    const { container } = render(providers(<ListingCard listing={CARD} />));
    expect(screen.queryByTestId("listings-card-open")).toBeNull();
    // The card itself is still a card — the price, the title, the heart.
    expect(screen.getByTestId("listings-card-price")).toBeTruthy();
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
  });
});

describe("the type refuses the combination that navigated twice", () => {
  it("rejects href together with onOpen", () => {
    // @ts-expect-error — `href` and `onOpen` are different arms of the union:
    // a card that navigates AND calls back is the defect, not a configuration.
    const both = <ListingCard listing={CARD} href="/l/7" onOpen={() => undefined} />;
    expect(both).toBeTruthy();
  });

  it("rejects a linkComponent on the callback arm", () => {
    // @ts-expect-error — `linkComponent` IS the link; a card that opens by
    // callback has no anchor for it to replace.
    const wrong = <ListingCard listing={CARD} onOpen={() => undefined} linkComponent={RouterLink} />;
    expect(wrong).toBeTruthy();
  });
});
