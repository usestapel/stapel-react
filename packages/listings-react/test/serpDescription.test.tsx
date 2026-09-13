/**
 * THE LIST CARD FILLS ITS TEXT COLUMN.
 *
 * Measured on a live storefront at 1440: the card is 1088px, the photo takes
 * 260 and the actions rail 179, leaving a ~600px text column holding a price,
 * a title, an 81px spec line and a place. The column was allocated and empty,
 * which reads as a card that stops halfway.
 *
 * The reference fills it with the opening of the description. That string is
 * the HOST's and arrives already cut — `description_snippet` on the search
 * card (stapel-classified 0.11.0): plain text, ~160 characters, ended on a
 * whole word, with NOTHING appended. This card must not cut it again; a second
 * cut is the one that lands mid-word.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingSerpCard } from "../src/default/index.js";
import { TITLE_CLAMP_CLASS } from "../src/default/titleClamp.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

const SNIPPET =
  "Aparat v rodnoy kraske, zimu prostoyal v otaplivaemom garazhe. Tip naked bike, privod tsep, PTS original";

describe("the description snippet", () => {
  it("is drawn under the title, verbatim", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          descriptionSnippet={SNIPPET}
        />
      )
    );
    const node = screen.getByTestId("listings-serp-description");
    // VERBATIM: the server already cut this on a word boundary. A card that
    // trimmed, truncated or appended would undo that work.
    expect(node.textContent).toBe(SNIPPET);
  });

  it("carries the same clamp the title does", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          descriptionSnippet={SNIPPET}
        />
      )
    );
    // One module answers "how does this card cut text" for every string on it.
    // Two answers is how the title came to be cut mid-word in the first place.
    expect(screen.getByTestId("listings-serp-description").className).toContain(
      TITLE_CLAMP_CLASS
    );
  });

  it("draws no empty line when the listing has no description", () => {
    // The projection sends `""` for a real listing with no description — 192
    // of them on the stand — and an empty secondary line would be a blank row
    // on every one.
    render(
      providers(
        <ListingSerpCard listing={CARD} href="/l/7" descriptionSnippet="" />
      )
    );
    expect(screen.queryByTestId("listings-serp-description")).toBeNull();
  });

  it("draws nothing at all when the host says nothing", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    expect(screen.queryByTestId("listings-serp-description")).toBeNull();
  });
});
