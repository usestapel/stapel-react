/**
 * A LONG DISPLAY NAME IS CUT, NOT SPILLED.
 *
 * Owner screenshot from a client storefront's listing page (dark theme,
 * desktop): a shop's long display name ran past the trust panel's right edge
 * and was clipped by the panel's border. No ellipsis, no wrap, and no way to
 * read what had been taken off.
 *
 * The name already asks antd for an ellipsis, and antd's ellipsis span is
 * `max-width: 100%` of its parent. The parent is a flex item — the anchor the
 * row wraps the name in — and a flex item's default `min-width: auto` refuses
 * to shrink below its content. So "100%" was 100% of a box that never gave
 * way, and the ellipsis had nothing to fire against.
 *
 * jsdom lays nothing out, so what this suite pins is the CONTRACT that makes
 * the truncation possible: every element between the flex line and the text
 * may shrink, and the whole name stays readable through `title`.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { PersonRow } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import type { ProfileBatchEntry } from "../src/model/profileBatch.js";

const SHOP = "b3f1c0de-0000-4000-8000-0000000000a2";
const LONG_NAME = "Магазин электроники «Гаджеты и аксессуары»";

const FOUND: ProfileBatchEntry = {
  status: "found",
  profile: {
    user_id: SHOP,
    display_name: LONG_NAME,
    avatar: null,
    location_display_name_narrow: null,
    location_display_name_broad: null,
    relationship_status: "neutral",
  } as ProfileBatchEntry["profile"],
};

/** The host's router seam, as a storefront hands it in. */
const HostLink: LinkComponent = function HostLink({ href, children, ...rest }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
};

function mount(node: ReactElement): ReturnType<typeof render> {
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

/** What the browser would compute for one element's own declarations. */
function styleOf(element: Element): CSSStyleDeclaration {
  return getComputedStyle(element);
}

describe("the name element may give way", () => {
  it("lets the NAME TEXT shrink below its content", () => {
    mount(<PersonRow entry={FOUND} userId={SHOP} testId="row" />);
    const name = screen.getByTestId("row").querySelector(
      "[data-stapel-person-name]"
    );
    expect(name).not.toBeNull();
    const style = styleOf(name as Element);
    expect(Number.parseFloat(style.minInlineSize)).toBe(0);
    expect(style.maxInlineSize).toBe("100%");
  });

  it("lets the LINK around it shrink too — the flex item that refused", () => {
    mount(
      <PersonRow
        entry={FOUND}
        userId={SHOP}
        href={`/u/${SHOP}`}
        linkComponent={HostLink}
        testId="row"
      />
    );
    const link = screen.getByTestId("row").querySelector(
      "[data-stapel-person-link]"
    );
    expect(link).not.toBeNull();
    const style = styleOf(link as Element);
    // Without this the anchor keeps the name's full measure and the row
    // overflows the panel it stands in.
    expect(Number.parseFloat(style.minInlineSize)).toBe(0);
    expect(style.maxInlineSize).toBe("100%");
  });

  it("does the same for the plain antd anchor arm", () => {
    mount(
      <PersonRow entry={FOUND} userId={SHOP} href={`/u/${SHOP}`} testId="row" />
    );
    const link = screen.getByTestId("row").querySelector(
      "[data-stapel-person-link]"
    );
    expect(Number.parseFloat(styleOf(link as Element).minInlineSize)).toBe(0);
  });
});

describe("what is cut stays readable", () => {
  it("keeps the WHOLE name in the DOM, so nothing is lost to the cut", () => {
    // A CSS ellipsis truncates the paint, never the text: the accessibility
    // tree and a selection both still get every character. That is why the
    // row needs no `title` — which the fleet's lint forbids anyway, as a
    // hover-only string some readers announce INSTEAD of the label.
    mount(<PersonRow entry={FOUND} userId={SHOP} testId="row" />);
    const name = screen.getByTestId("row").querySelector(
      "[data-stapel-person-name]"
    );
    expect(name?.textContent).toBe(LONG_NAME);
  });

  it("gives the link the whole name as its accessible text", () => {
    mount(
      <PersonRow
        entry={FOUND}
        userId={SHOP}
        href={`/u/${SHOP}`}
        linkComponent={HostLink}
        testId="row"
      />
    );
    expect(screen.getByRole("link").textContent).toBe(LONG_NAME);
  });

  it("keeps the ellipsis class antd truncates with", () => {
    mount(<PersonRow entry={FOUND} userId={SHOP} testId="row" />);
    const name = screen.getByTestId("row").querySelector(
      "[data-stapel-person-name]"
    );
    expect(name?.className).toContain("ant-typography-ellipsis");
  });
});
