/**
 * The host's component registry reaches THIS pair with zero pair wiring
 * (`SkinProvider` — tokens-antd's second restyle layer, see
 * `docs/skin-component-registry.md` in the repo root).
 *
 * The claim: a host registers a replacement Button ONCE, at the app root,
 * and the default skin's buttons — here the card's heart, a control this
 * package renders — come out with the host's anatomy. Nothing in
 * listings-react names the override; consuming the substrate is the wiring.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { SkinProvider } from "@stapel/tokens-antd/skin";
import type { SkinButtonProps } from "@stapel/tokens-antd/skin";
import { ListingCard } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function HostButton(props: SkinButtonProps): ReactElement {
  const { children, onClick, disabled } = props;
  return (
    <button
      type="button"
      data-host-button=""
      disabled={disabled === true}
      onClick={onClick}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      {...(props["aria-label"] !== undefined ? { "aria-label": props["aria-label"] } : {})}
    >
      {children}
    </button>
  );
}

describe("the skin component registry", () => {
  it("a Button registered once at the host reskins the card's heart — no pair wiring", () => {
    render(
      <SkinProvider components={{ Button: HostButton }}>
        <TestProviders server={mockServer({})}>
          <ListingCard listing={CARD} />
        </TestProviders>
      </SkinProvider>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart.hasAttribute("data-host-button")).toBe(true);
  });

  it("without a provider the heart stays the antd default", () => {
    render(
      <TestProviders server={mockServer({})}>
        <ListingCard listing={CARD} />
      </TestProviders>
    );
    const heart = screen.getByTestId("listings-card-favorite");
    expect(heart.hasAttribute("data-host-button")).toBe(false);
    expect(heart.className).toContain("ant-btn");
  });
});
