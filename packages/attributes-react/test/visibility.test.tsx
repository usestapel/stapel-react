/**
 * The visibility axis — and the one claim this package is not allowed to make.
 *
 * The product ask was a "VIN verified" badge. **Nothing in the fleet runs a
 * VIN check**, so that badge is not printed: what the system observed is that
 * the seller supplied a value, and that is what the copy says. The stronger
 * badge exists, is reachable, and is driven by a `verification` result that
 * nothing writes today — so the assertions below are the only thing standing
 * between the honest sentence and the flattering one.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { FeatureDef, FeaturesDto } from "../src/types.js";
import {
  featureVisibility,
  isPublicFeature,
  isRedactedValue,
  isValuePresent,
  isValueVerified,
  valueVerification,
} from "../src/visibility.js";
import { registerAttributesI18n } from "../src/i18n/keys.js";
import { attributesI18nBundleRu, registerAttributesI18nRu } from "../src/i18n/ru.js";
import { FeatureBadges, FeatureValueList } from "../src/default/FeatureBadges.js";
import {
  FeatureFields,
  featureVisibilityTestId,
} from "../src/default/FeatureFields.js";
import { INT_FEATURE, STRING_FEATURE, feature } from "./fixtures.js";

afterEach(() => cleanup());

function wrap(node: ReactElement, locale = "en"): ReactElement {
  const i18n = createI18n({ locale });
  registerAttributesI18n(i18n);
  if (locale === "ru") registerAttributesI18nRu(i18n);
  return <I18nProvider i18n={i18n}>{node}</I18nProvider>;
}

/** A mandatory identifier, which is the whole point of the axis: required,
 * validated, stored — and never handed to a buyer. */
const VIN: FeatureDef = feature(
  "vin",
  { type: "string", maxLength: 17 },
  { name: "VIN", mandatory: true, visibility: "owner" }
);

const STAFF_ONLY: FeatureDef = feature(
  "registry_no",
  { type: "string" },
  { name: "Registry number", mandatory: true, visibility: "staff" }
);

/** What stapel-listings sends a reader who may not see the value: no `value`
 * key, in place and in order, saying only that the field was answered. */
const STUB: FeaturesDto = {
  vin: { type: "string", value: undefined, redacted: true, present: true },
};

const ABSENT_STUB: FeaturesDto = {
  vin: { type: "string", value: undefined, redacted: true, present: false },
};

describe("the wire predicates", () => {
  it("defaults an unmarked feature to public — the axis costs nothing to a catalogue that never used it", () => {
    expect(featureVisibility(STRING_FEATURE)).toBe("public");
    expect(isPublicFeature(STRING_FEATURE)).toBe(true);
    expect(featureVisibility({ ...STRING_FEATURE, visibility: "public" })).toBe("public");
  });

  it("reads the three declared audiences", () => {
    expect(featureVisibility(VIN)).toBe("owner");
    expect(featureVisibility(STAFF_ONLY)).toBe("staff");
    expect(isPublicFeature(VIN)).toBe(false);
  });

  it("fails SAFE on a visibility it does not know — a typo must not publish a VIN", () => {
    // Python raises `UnknownVisibility` here; a browser has nobody to raise
    // at, so it takes the only direction that cannot leak.
    const typo = { ...VIN, visibility: "privat" } as unknown as FeatureDef;
    expect(featureVisibility(typo)).toBe("staff");
    expect(isPublicFeature(typo)).toBe(false);
  });

  it("reads the stub markers, and says nothing about a row that carries none", () => {
    expect(isRedactedValue(STUB["vin"])).toBe(true);
    expect(isValuePresent(STUB["vin"])).toBe(true);
    expect(isValuePresent(ABSENT_STUB["vin"])).toBe(false);
    expect(isRedactedValue({ type: "string", value: "WVWZZZ" })).toBe(false);
    expect(isRedactedValue(undefined)).toBe(false);
    expect(valueVerification(STUB["vin"])).toBeUndefined();
    expect(isValueVerified(STUB["vin"])).toBe(false);
  });

  it("takes a verification only as an object — a truthy string is not a result", () => {
    expect(valueVerification({ verification: "yes" })).toBeUndefined();
    expect(valueVerification({ verification: ["verified"] })).toBeUndefined();
    expect(valueVerification({ verification: { status: "verified" } })).toEqual({
      status: "verified",
    });
  });
});

describe("<FeatureValueList/> — a withheld value is a row, not a hole", () => {
  it("keeps the redacted row IN PLACE, so the public table has the seller's own rows", () => {
    render(
      wrap(
        <FeatureValueList
          features={[STRING_FEATURE, VIN, INT_FEATURE]}
          values={{ title: { type: "string", value: "Golf" }, ...STUB }}
        />
      )
    );
    const labels = [...screen.getByTestId("attributes-value-list").querySelectorAll(
      ".ant-descriptions-item-label"
    )].map((node) => node.textContent);
    expect(labels).toEqual(["title", "VIN", "year"]);
  });

  it("says the value was SUPPLIED, and does not say it was checked", () => {
    render(wrap(<FeatureValueList features={[VIN]} values={STUB} />));
    const cell = screen.getByTestId("attributes-value-provided");
    expect(cell.textContent).toBe("Provided by the seller");
    // The claim nobody is entitled to make: no VIN check exists anywhere in
    // the fleet, so no wording here may imply one.
    const table = screen.getByTestId("attributes-value-list").textContent ?? "";
    expect(table.toLowerCase()).not.toContain("verified");
    expect(table.toLowerCase()).not.toContain("checked");
    expect(screen.queryByTestId("attributes-value-verified")).toBeNull();
  });

  it("prints no value, of any kind, for the withheld row", () => {
    render(
      wrap(
        <FeatureValueList
          features={[VIN]}
          // A stub that somehow still carried the number must not print it:
          // the branch is taken off `redacted`, before any formatting.
          values={{ vin: { type: "string", value: "WVWZZZ1JZXW000001", redacted: true, present: true } }}
        />
      )
    );
    expect(screen.getByTestId("attributes-value-list").textContent).not.toContain("WVWZZZ");
  });

  it("falls back to the ordinary 'not filled in' treatment when the seller did not answer", () => {
    render(wrap(<FeatureValueList features={[VIN]} values={ABSENT_STUB} />));
    expect(screen.queryByTestId("attributes-value-provided")).toBeNull();
    expect(screen.getByTestId("attributes-value-list").textContent).toContain("Not specified");
  });

  it("says «Указано продавцом» in Russian — and still not «проверен»", () => {
    render(wrap(<FeatureValueList features={[VIN]} values={STUB} />, "ru"));
    expect(screen.getByTestId("attributes-value-provided").textContent).toBe(
      "Указано продавцом"
    );
    expect(screen.getByTestId("attributes-value-list").textContent).not.toContain("роверен");
  });

  it("still prints the owner's OWN value: the axis hides it from a buyer, not from the seller", () => {
    // An owner's read is unredacted — no stub, no markers — so the row is an
    // ordinary one and shows the number.
    render(
      wrap(
        <FeatureValueList
          features={[VIN]}
          values={{ vin: { type: "string", value: "WVWZZZ1JZXW000001" } }}
        />
      )
    );
    expect(screen.getByTestId("attributes-value-list").textContent).toContain(
      "WVWZZZ1JZXW000001"
    );
  });
});

describe("the verification branch — dead code today, and correct", () => {
  it("upgrades to the stronger badge when something actually checked the value", () => {
    render(
      wrap(
        <FeatureValueList
          features={[VIN]}
          values={{
            vin: {
              type: "string",
              value: undefined,
              redacted: true,
              present: true,
              verification: {
                status: "verified",
                verified_at: "2026-09-02T10:00:00Z",
                source: "registry.example",
              },
            },
          }}
        />
      )
    );
    const badge = screen.getByTestId("attributes-value-verified");
    expect(badge.textContent).toBe("Verified");
    // Who checked and when are for support, not for the reader.
    expect(badge.getAttribute("data-attributes-verification-source")).toBe("registry.example");
    expect(badge.textContent).not.toContain("registry.example");
    expect(screen.queryByTestId("attributes-value-provided")).toBeNull();
  });

  it("does NOT claim a check for a status it cannot read — not understood is not verified", () => {
    render(
      wrap(
        <FeatureValueList
          features={[VIN]}
          values={{
            vin: {
              type: "string",
              value: undefined,
              redacted: true,
              present: true,
              verification: { status: "pending" },
            },
          }}
        />
      )
    );
    expect(screen.queryByTestId("attributes-value-verified")).toBeNull();
    expect(screen.getByTestId("attributes-value-provided").textContent).toBe(
      "Provided by the seller"
    );
  });

  it("does not verify a value that was never supplied", () => {
    render(
      wrap(
        <FeatureValueList
          features={[VIN]}
          values={{
            vin: {
              type: "string",
              value: undefined,
              redacted: true,
              present: false,
              verification: { status: "verified" },
            },
          }}
        />
      )
    );
    expect(screen.queryByTestId("attributes-value-verified")).toBeNull();
  });
});

describe("<FeatureBadges/> — a card badge strip is not the place for this", () => {
  it("skips a redacted row entirely", () => {
    render(
      wrap(
        <FeatureBadges
          features={[{ ...VIN, show_as_badge: true }, { ...INT_FEATURE, show_as_badge: true }]}
          values={{ ...STUB, year: { type: "int", value: 2010 } }}
        />
      )
    );
    expect(screen.queryByTestId("attributes-badge-vin")).toBeNull();
    expect(screen.getByTestId("attributes-badge-year").textContent).toBe("2010");
  });

  it("skips a NON-PUBLIC feature even when the row carries a readable value", () => {
    // The owner's own card: the value is right there, unredacted, and it is
    // still not a badge. The engine forces `show_as_badge: false` upstream;
    // this is the belt, because a renderer that can only be correct because
    // of what the server did is how the VIN got out in the first place.
    render(
      wrap(
        <FeatureBadges
          features={[{ ...VIN, show_as_badge: true }]}
          values={{ vin: { type: "string", value: "WVWZZZ1JZXW000001" } }}
        />
      )
    );
    expect(screen.getByTestId("attributes-badges").textContent).toBe("");
  });
});

describe("<FeatureFields/> — the seller is told AT THE FIELD", () => {
  const onChange = (): void => {};

  it("tags a non-public field as not published and names who does see it", () => {
    render(wrap(<FeatureFields features={[VIN]} values={{}} onChange={onChange} />));
    expect(screen.getByTestId(`${featureVisibilityTestId("vin")}-tag`).textContent).toBe(
      "Not published"
    );
    const notice = screen.getByTestId(featureVisibilityTestId("vin"));
    expect(notice.textContent).toBe("You and our moderators can see it; buyers cannot.");
    expect(notice.getAttribute("data-attributes-visibility")).toBe("owner");
  });

  it("says the harder thing for `staff`: it is not shown back to you either", () => {
    render(wrap(<FeatureFields features={[STAFF_ONLY]} values={{}} onChange={onChange} />));
    const notice = screen.getByTestId(featureVisibilityTestId("registry_no"));
    expect(notice.textContent).toContain("not shown back to you");
    expect(notice.getAttribute("data-attributes-visibility")).toBe("staff");
  });

  it("keeps the field REQUIRED — visibility is orthogonal to mandatory", () => {
    const { container } = render(
      wrap(<FeatureFields features={[VIN]} values={{}} onChange={onChange} />)
    );
    expect(container.querySelectorAll(".ant-form-item-required")).toHaveLength(1);
    // And still editable: it is the seller's own field.
    expect(screen.getByLabelText(/VIN/).hasAttribute("disabled")).toBe(false);
  });

  it("says nothing at all on a public field", () => {
    render(
      wrap(
        <FeatureFields
          features={[{ ...STRING_FEATURE, mandatory: true }]}
          values={{}}
          onChange={onChange}
        />
      )
    );
    expect(screen.queryByTestId(featureVisibilityTestId("title"))).toBeNull();
    expect(screen.queryByTestId(`${featureVisibilityTestId("title")}-tag`)).toBeNull();
  });

  it("hands the visibility to a host's own renderRow", () => {
    const seen: Record<string, string> = {};
    render(
      wrap(
        <FeatureFields
          features={[VIN, STRING_FEATURE]}
          values={{}}
          onChange={onChange}
          renderRow={(row) => {
            seen[row.feature.slug] = row.visibility;
            return row.control;
          }}
        />
      )
    );
    expect(seen).toEqual({ vin: "owner", title: "public" });
  });

  it("speaks Russian in the composer too", () => {
    render(wrap(<FeatureFields features={[VIN]} values={{}} onChange={onChange} />, "ru"));
    expect(screen.getByTestId(`${featureVisibilityTestId("vin")}-tag`).textContent).toBe(
      attributesI18nBundleRu["attributes.visibility.not_published"]
    );
    expect(screen.getByTestId(featureVisibilityTestId("vin")).textContent).toContain(
      "покупателям"
    );
  });
});
