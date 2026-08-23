/**
 * The two host seams (`src/ui.ts`), exercised the way a pair and a container
 * actually meet them.
 *
 * Types are the whole payload here, so the assertions are the ones a type
 * alone cannot make: that a host component written against ITS OWN router
 * satisfies `LinkComponent` without knowing the shape by name, that the pair's
 * test hooks survive the adapter, and that a `SignInCta` narrows to exactly
 * one of its two arms — which is what stops a skin from wiring both a link and
 * a handler onto one control.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import type { LinkComponent, SignInCta } from "../src/index.js";

/** A host's router adapter: the one line a container writes. */
const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
  <span data-router-to={href} {...rest}>
    {children}
  </span>
);

/** A pair's skin: it knows `href` and nothing else about navigation. */
function PairChrome(props: { linkComponent?: LinkComponent }): ReactElement {
  const Link = props.linkComponent;
  const label = "Tools";
  return Link !== undefined ? (
    <Link href="/c/tools" data-testid="chrome-link" data-category-slug="tools">
      {label}
    </Link>
  ) : (
    <a href="/c/tools" data-testid="chrome-link" data-category-slug="tools">
      {label}
    </a>
  );
}

describe("LinkComponent", () => {
  it("renders a plain anchor when the host hands in nothing", () => {
    const { container } = render(<PairChrome />);
    expect(container.querySelectorAll("a[href]")).toHaveLength(1);
  });

  it("renders through the host's component instead, test hooks and all", () => {
    const { container } = render(<PairChrome linkComponent={RouterLink} />);
    // The point of the seam: no anchor, so no full page load in a SPA.
    expect(container.querySelectorAll("a[href]")).toHaveLength(0);
    const link = screen.getByTestId("chrome-link");
    expect(link.getAttribute("data-router-to")).toBe("/c/tools");
    expect(link.getAttribute("data-category-slug")).toBe("tools");
  });
});

describe("SignInCta", () => {
  /** What every skin taking the prop does with it, in one place. */
  function doorProps(
    cta: SignInCta
  ): { href: string } | { onClick: () => void } {
    return cta.href !== undefined ? { href: cta.href } : { onClick: cta.onSignIn };
  }

  it("carries a route for a container that routes", () => {
    expect(doorProps({ href: "/login?next=/l/7" })).toEqual({
      href: "/login?next=/l/7",
    });
  });

  it("carries a callback for a container that opens a modal", () => {
    const onSignIn = vi.fn();
    const door = doorProps({ onSignIn });
    expect("href" in door).toBe(false);
    if ("onClick" in door) door.onClick();
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
