/**
 * The composer's characteristics step, on a phone.
 *
 * Measured on a live classified deployment at 390x844, with a real account,
 * choosing a three-level path down to Mobile phones (33 feature defs):
 *
 *   - before a category was chosen the page was 2222px tall and the
 *     Characteristics section printed "loading the category's
 *     characteristics…" at y=1535. Nothing was in flight and nothing would be
 *     until a category existed;
 *   - after it was chosen the page was 7292px tall and the first attribute
 *     control sat at y=1596 — nearly two viewports below the fold, behind the
 *     photo dropzone — while the footer said "10 required details not filled
 *     in" with none of them on screen and no way to reach one.
 *
 * Each of those is one `describe` below. The geometry is measured on the
 * FORM's own width (§83), so the environment edge these tests mock is
 * `getBoundingClientRect` — the same edge `attributes-react`'s own responsive
 * suite mocks — never the hook.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { act } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { actionAvailable } from "@stapel/core";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  featureControlId,
  featureRowTestId,
  featureSectionTestId,
} from "@stapel/attributes-react/default";
import {
  COMPOSER_DETAILS_PLACEMENT,
  ListingComposerPage,
  composerFieldId,
} from "../src/default/index.js";
import { DESCRIPTION_FIELD } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { DRAFT, FEATURES, detail } from "./fixtures.js";

const GALLERY = { refs: ["image/9f2c1a"], settled: actionAvailable() };

/** The two form widths the two orders are decided on. `PHONE` is a 390px
 * viewport minus the page's own padding; `DESKTOP` is anything the composer's
 * own 44rem measure fits in. */
const PHONE = 360;
const DESKTOP = 1100;

const realRect = Element.prototype.getBoundingClientRect;

/** jsdom lays nothing out, so every box already reports zero — only the width
 * `useElementWidth` reads has to be real. */
function installFormWidth(width: number): void {
  Element.prototype.getBoundingClientRect = function rect(): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: width,
      width,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

function server() {
  return mockServer({
    "/listings/42/save-draft/": { body: DRAFT },
    "/listings/": { body: DRAFT },
  });
}

/** Does `b` come after `a` in the document? */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** Two grouped features, so the region has headings to key as well as rows. */
const GROUPED: readonly FeatureDef[] = [
  { ...FEATURES[0], group: "Basics" } as FeatureDef,
  { ...FEATURES[1], group: "Engine" } as FeatureDef,
];

function composer(props: {
  readonly features?: readonly FeatureDef[];
  readonly category?: string;
  readonly featuresLoading?: boolean;
}): ReactElement {
  return (
    <ListingComposerPage
      features={props.features ?? GROUPED}
      images={GALLERY}
      category={props.category ?? "tools/power"}
      {...(props.featuresLoading !== undefined
        ? { featuresLoading: props.featuresLoading }
        : {})}
      renderCategoryPicker={() => <button type="button">pick</button>}
      gallerySlot={<div data-testid="gallery">photos</div>}
    />
  );
}

describe("what the form asks first", () => {
  /**
   * The order the seller reads, measured the only way jsdom can measure it:
   * DOCUMENT order, which in a single-column `Form` is vertical order. The
   * pixel version of the same assertion lives in the showcase run — the
   * regression this replaces was measured at 390x844 as title y=5575 under
   * the first attribute at y=500, in a 7308px form.
   */
  const CORE = [
    "listings-composer-title",
    "listings-composer-description",
    "listings-composer-price",
    "listings-composer-location",
    "gallery",
  ] as const;

  for (const [name, width] of [
    ["a phone", PHONE],
    ["a desktop", DESKTOP],
  ] as const) {
    it(`asks title, description, price, where and photos BEFORE the category's own questions on ${name}`, async () => {
      installFormWidth(width);
      render(<TestProviders server={server()}>{composer({})}</TestProviders>);
      await waitFor(() => {
        expect(screen.getByTestId("attributes-fields")).toBeTruthy();
      });

      const category = screen.getByTestId("listings-composer-category");
      const details = screen.getByTestId("listings-composer-details");
      const firstAttribute = screen.getByTestId(featureRowTestId("brand"));
      for (const testId of CORE) {
        const core = screen.getByTestId(testId);
        expect(precedes(category, core)).toBe(true);
        expect(precedes(core, details)).toBe(true);
        expect(precedes(core, firstAttribute)).toBe(true);
      }
    });
  }

  it("says so on the region itself, at every width", async () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-composer-details").getAttribute("data-placement")
      ).toBe(COMPOSER_DETAILS_PLACEMENT);
    });
    cleanup();

    installFormWidth(DESKTOP);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    await waitFor(() => {
      expect(
        screen.getByTestId("listings-composer-details").getAttribute("data-placement")
      ).toBe(COMPOSER_DETAILS_PLACEMENT);
    });
  });

  it("draws the section exactly once", async () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    await waitFor(() => {
      expect(screen.getAllByTestId("listings-composer-details")).toHaveLength(1);
    });
    expect(screen.getAllByTestId("attributes-fields")).toHaveLength(1);
  });
});

describe("the region is short enough to have something after it", () => {
  it("opens the group that asks something required and folds the plumbing away", async () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    await waitFor(() => {
      expect(screen.getByTestId("attributes-fields")).toBeTruthy();
    });
    // `brand` is mandatory, `power` is not — one group open, one closed, both
    // headings on screen.
    const basics = screen.getByTestId(featureSectionTestId("Basics")) as HTMLDetailsElement;
    const engine = screen.getByTestId(featureSectionTestId("Engine")) as HTMLDetailsElement;
    expect(basics.tagName).toBe("DETAILS");
    expect(basics.open).toBe(true);
    expect(engine.open).toBe(false);
    expect(
      screen.getByTestId(`${featureSectionTestId("Engine")}-heading`).textContent
    ).toBe("Engine");
  });

  it("opens a folded section to put the person in the field inside it", async () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    await waitFor(() => {
      expect(screen.getByTestId("attributes-fields")).toBeTruthy();
    });
    // The seller folds the section away themselves, then asks to be taken to
    // the first empty field — which is inside it.
    const basics = screen.getByTestId(featureSectionTestId("Basics")) as HTMLDetailsElement;
    basics.open = false;
    fireEvent(basics, new Event("toggle"));
    expect(basics.open).toBe(false);

    fireEvent.change(screen.getByTestId("listings-composer-description"), {
      target: { value: "A drill in good order" },
    });
    fireEvent.click(screen.getByTestId("listings-composer-goto-missing"));
    expect(basics.open).toBe(true);
    expect(document.activeElement?.id).toBe(featureControlId("brand"));
  });
});

describe("the section says what is actually true", () => {
  it("with no category chosen: no category chosen — not loading", () => {
    installFormWidth(PHONE);
    render(
      <TestProviders server={server()}>
        {composer({ category: "", features: [] })}
      </TestProviders>
    );
    expect(
      screen.getByTestId("listings-composer-features-no-category")
    ).toBeTruthy();
    expect(screen.queryByTestId("listings-composer-features-loading")).toBeNull();
    expect(screen.queryByTestId("listings-composer-features-empty")).toBeNull();
  });

  it("says loading only while a read really is in flight", () => {
    installFormWidth(PHONE);
    render(
      <TestProviders server={server()}>
        {composer({ features: [], featuresLoading: true })}
      </TestProviders>
    );
    expect(screen.getByTestId("listings-composer-features-loading")).toBeTruthy();
    expect(
      screen.queryByTestId("listings-composer-features-no-category")
    ).toBeNull();
  });

  it("keeps 'this category asks for nothing' for the category that asks for nothing", () => {
    installFormWidth(PHONE);
    render(
      <TestProviders server={server()}>{composer({ features: [] })}</TestProviders>
    );
    expect(screen.getByTestId("listings-composer-features-empty")).toBeTruthy();
    expect(
      screen.queryByTestId("listings-composer-features-no-category")
    ).toBeNull();
  });
});

describe("the unfilled-required count can be followed", () => {
  it("offers a real control, with an accessible name, while the submit is blocked", () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    const control = screen.getByRole("button", {
      name: "Take me to the first empty field",
    });
    expect(control.tagName).toBe("BUTTON");
    expect(screen.getByTestId("listings-composer-goto-missing")).toBeTruthy();
  });

  it("puts the person in the first unsatisfied field of the form's own order", () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    // Nothing has been typed, so the description is the first field the mirror
    // is refusing — before any attribute, because that is the order the form
    // asks in.
    fireEvent.click(screen.getByTestId("listings-composer-goto-missing"));
    expect(document.activeElement?.id).toBe(composerFieldId(DESCRIPTION_FIELD));
  });

  it("reaches the mandatory ATTRIBUTE once the listing's own fields are answered", () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    fireEvent.change(screen.getByTestId("listings-composer-description"), {
      target: { value: "A drill in good order" },
    });
    fireEvent.click(screen.getByTestId("listings-composer-goto-missing"));
    // `brand` is the category's mandatory select, and the control it focuses is
    // the one `<FeatureFields/>` labelled — the same id, from the same builder.
    expect(document.activeElement?.id).toBe(featureControlId("brand"));
  });

  it("is gone once nothing is refused", async () => {
    installFormWidth(PHONE);
    render(
      <TestProviders server={server()}>{composer({ features: [] })}</TestProviders>
    );
    fireEvent.change(screen.getByTestId("listings-composer-description"), {
      target: { value: "A drill in good order" },
    });
    await waitFor(() => {
      expect(screen.queryByTestId("listings-composer-goto-missing")).toBeNull();
    });
  });
});

describe("the attribute region is measurable from the composer", () => {
  it("keys the container, each group and each field", async () => {
    installFormWidth(PHONE);
    render(<TestProviders server={server()}>{composer({})}</TestProviders>);
    await waitFor(() => {
      expect(screen.getByTestId("attributes-fields")).toBeTruthy();
    });
    for (const group of ["Basics", "Engine"]) {
      expect(screen.getByTestId(featureSectionTestId(group))).toBeTruthy();
      expect(
        screen.getByTestId(`${featureSectionTestId(group)}-heading`).textContent
      ).toBe(group);
    }
    for (const slug of ["brand", "power"]) {
      expect(screen.getByTestId(featureRowTestId(slug))).toBeTruthy();
    }
  });
});

/**
 * One field, one sentence.
 *
 * A slot field carries a HINT ("buyers filter by distance…") and, when the
 * server refuses it, a REFUSAL under the same control. Both are true, both are
 * about the same box, and they used to print one line apart — the refusal is
 * the one the person just earned. The footer's gate reason is a different
 * sentence in a different place and it stays where it is.
 */
describe("a refused field replaces its hint instead of stacking on it", () => {
  /** The shape stapel-core's handler folds a DRF field error into. */
  const OVER_PRECISE = {
    localizable_error: "error.400.validation_error",
    error: "Ensure that there are no more than 6 decimal places.",
    params: {
      field: "lat_draft",
      detail: { lat_draft: ["Ensure that there are no more than 6 decimal places."] },
    },
    error_language: "en",
  };

  const HINT =
    "Buyers filter by distance, so a listing with no place is a listing they will not find";

  function refusingComposer(): ReturnType<typeof mockServer> {
    const srv = mockServer({
      "/listings/42/save-draft/": { status: 400, body: OVER_PRECISE },
      "/listings/42/": { body: detail({ id: 42, status: "draft" }) },
      "/listings/42/draft/": { status: 404, body: {} },
      "/listings/": { body: DRAFT },
    });
    render(
      <TestProviders server={srv}>
        <ListingComposerPage
          listingId={42}
          features={[]}
          images={GALLERY}
          renderCategoryPicker={() => <button type="button">pick</button>}
          renderLocationPicker={() => <div data-testid="stand-in-picker" />}
        />
      </TestProviders>
    );
    return srv;
  }

  it("shows the hint while the field is clean", async () => {
    installFormWidth(PHONE);
    refusingComposer();
    await waitFor(() => {
      expect(screen.getByText(HINT)).toBeTruthy();
    });
  });

  it("shows the refusal alone once the server has refused the field", async () => {
    installFormWidth(PHONE);
    refusingComposer();
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-composer-save-gate")
          .getAttribute("data-stapel-gated")
      ).toBe("available");
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("listings-composer-save"));
    });
    // The refusal lands ON the control (blocker C2's own claim), and the hint
    // that said the same thing in gentler words steps aside for it.
    await waitFor(() => {
      expect(
        screen
          .getByTestId("listings-composer-location")
          .closest(".ant-form-item-has-error")
      ).not.toBeNull();
    });
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
