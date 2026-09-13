/**
 * THE DISC A SELLER WITH NO PHOTOGRAPH WEARS.
 *
 * Every avatar on the live stand was a gradient blob with no face and no
 * letters. That turned out NOT to be this component's defect — the stand's
 * seeded profiles each carried a real `avatar_image` pointing at a flat
 * gradient PNG, and a pair drawing the photograph it was given is a pair
 * behaving correctly. The seed is being cleared, which finally makes this
 * component's no-photo arm the one a visitor sees, and the owner's ruling for
 * that arm is: initials on a deterministic brand-tinted disc, no stock faces.
 *
 * WHAT THIS ASSERTS, in terms of what a person sees:
 *
 *  - a person with a photograph still gets the photograph (the rule the seed
 *    clearing must not change);
 *  - a person without one gets their INITIALS, on a coloured disc;
 *  - the colour is the same colour for the same person every time, and it does
 *    not depend on what was rendered before them — the same id in two lists in
 *    two orders is one colour;
 *  - the initials CLEAR 4.5:1 against their own disc, in both themes, with
 *    BOTH OPERANDS READ OFF THE SAME RENDERED NODE. Not a token looked up here
 *    and paired with an assumed partner: `backgroundColor` and `color` are
 *    read from the element's own inline style, which is what the browser
 *    paints, and the ratio is computed between those two strings.
 *
 * WHY BOTH COLOURS ARE WRITTEN INLINE ON ONE ELEMENT, and it is the point:
 * antd's `<Avatar>` paints its own background and its own text colour from its
 * component tokens, so a disc that set only one of the two would be a measured
 * colour against a derived one — the exact arrangement in which a 4.5:1 claim
 * renders at 3.6:1. Setting both on the node makes the pair the thing that is
 * painted, and makes it the thing this test can read.
 *
 * WHAT IT CANNOT SEE: jsdom paints nothing and resolves no cascade, so "the
 * computed colour equals the inline one" — i.e. that no antd class overrides
 * either half on the way to the glass — is a browser fact and is proved in
 * headless Chromium (see the changeset). The disc's contrast against the PAGE
 * is not asserted here or there: it is 1.04:1 at its worst by design, and
 * `identityTint`'s header says why the identity rides on the initials.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { PersonAvatar } from "../src/default/index.js";
import { registerProfilesI18n } from "../src/i18n/keys.js";
import type { PublicProfile } from "../src/index.js";

const ALICE = "57e55075-6b60-4f9a-962e-38d9a6bd8389";
const BOB = "245efbe3-0000-4000-8000-000000000001";

function profileOf(over: Partial<PublicProfile> = {}): PublicProfile {
  return {
    user_id: ALICE,
    display_name: "Alice Nguyen",
    avatar_source: null,
    avatar: null,
    avatar_image: null,
    ...over,
  } as PublicProfile;
}

function mount(node: ReactElement, mode?: "light" | "dark") {
  const i18n = createI18n({ locale: "en" });
  registerProfilesI18n(i18n);
  return render(
    <I18nProvider i18n={i18n}>
      <SkinTheme {...(mode !== undefined ? { mode } : {})}>{node}</SkinTheme>
    </I18nProvider>
  );
}

/** WCAG luminance, over whatever notation the DOM hands back. */
function luminance(value: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  const rgbForm = /rgba?\(([^)]+)\)/i.exec(value);
  const parts: number[] = hex
    ? [0, 2, 4].map((at) => parseInt((hex[1] ?? "").slice(at, at + 2), 16))
    : rgbForm
      ? (rgbForm[1] ?? "").split(",").slice(0, 3).map((one) => Number(one.trim()))
      : [];
  if (parts.length !== 3) throw new Error(`not a colour: ${JSON.stringify(value)}`);
  const [r, g, b] = parts.map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  }) as unknown as readonly [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A colour a ratio may be computed over AT ALL.
 *
 * The arm this replaces painted antd's `colorFillQuaternary`, which is an
 * `rgba()` — a translucent fill has no luminance of its own, it has whatever
 * is behind it, so any ratio computed over one is a number with an invented
 * operand. The disc is opaque by construction (the preset palettes are hex),
 * and this refuses to let that silently stop being true.
 */
function opaque(value: string): string {
  const alpha = /rgba\(([^)]+)\)/i.exec(value);
  if (alpha !== null) {
    const parts = (alpha[1] ?? "").split(",");
    const a = Number((parts[3] ?? "1").trim());
    if (a < 1) {
      throw new Error(
        `a ratio cannot be computed over a translucent colour: ${value} — ` +
          `it has no luminance of its own, only whatever is behind it`
      );
    }
  }
  return value;
}

function contrast(a: string, b: string): number {
  const first = luminance(opaque(a));
  const second = luminance(opaque(b));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** The disc element, and the two colours IT carries. */
function disc(): { node: HTMLElement; background: string; color: string } {
  const node = screen.getByTestId("profiles-person-disc");
  return {
    node,
    // Both off the SAME node, both the values that are painted.
    background: node.style.backgroundColor,
    color: node.style.color,
  };
}

describe("a person without a photograph wears a deterministic disc", () => {
  it("still draws the photograph when there is one", () => {
    const { container } = mount(
      <PersonAvatar
        profile={profileOf({
          avatar_image: {
            source: "cdn",
            url: "/media/x.png",
            mime: "image/png",
            width: 256,
            height: 256,
            aspect: 1,
            square: true,
            preview_b64: null,
            variants: [],
          },
        } as Partial<PublicProfile>)}
        fallbackName="Alice Nguyen"
        side={40}
      />
    );
    expect(screen.queryByTestId("profiles-person-disc")).toBeNull();
    expect(container.querySelector("img, [data-testid='stapel-image-preview']")).not.toBe(
      undefined
    );
  });

  it("draws the initials on a coloured disc when there is none", () => {
    mount(<PersonAvatar profile={profileOf()} fallbackName="Alice Nguyen" side={40} />);
    const { node, background, color } = disc();
    expect(node.textContent).toBe("AN");
    // A colour, not a default grey inherited from antd.
    expect(background).not.toBe("");
    expect(color).not.toBe("");
    expect(background).not.toBe(color);
  });

  for (const mode of ["light", "dark"] as const) {
    it(`keeps the initials at 4.5:1 against their own disc in the ${mode} theme`, () => {
      const ratios: string[] = [];
      // Twenty different people, so the assertion covers the whole palette
      // rather than whichever family the first id happened to land on.
      for (let n = 0; n < 20; n += 1) {
        const { unmount } = mount(
          <PersonAvatar
            profile={profileOf({ user_id: `person-${String(n)}` })}
            fallbackName={`Person ${String(n)}`}
            side={40}
          />,
          mode
        );
        const { background, color } = disc();
        const ratio = contrast(background, color);
        ratios.push(`${String(n)}:${ratio.toFixed(2)}`);
        expect(ratio, `${mode} person-${String(n)} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          4.5
        );
        unmount();
      }
      expect(ratios).toHaveLength(20);
    });
  }

  it("draws the disc an edge, without changing its size", () => {
    mount(<PersonAvatar profile={profileOf()} fallbackName="Alice Nguyen" side={40} />);
    const { node } = disc();
    // A hairline in the family's own palette: the disc is 1.04:1 against a
    // pale page at its worst, and two letters on an invisible ground read as
    // letters floating beside a name rather than as an avatar.
    expect(node.style.borderColor).not.toBe("");
    expect(node.style.borderStyle).toBe("solid");
    expect(node.style.borderWidth).toBe("1px");
    // …and it is NOT the disc's own colour, or there is no edge.
    expect(node.style.borderColor).not.toBe(node.style.backgroundColor);
    // antd already reserves `border: 1px solid transparent` and sizes itself
    // border-box, so colouring it moves nothing. (That the BOX is still 40px
    // is a browser fact and is measured there, not here.)
    expect(node.style.width).toBe("40px");
  });

  it("gives one person one colour, whatever order the list is in", () => {
    const first = (() => {
      const { unmount } = mount(
        <PersonAvatar profile={profileOf({ user_id: ALICE })} fallbackName="A N" side={40} />
      );
      const read = { ...disc() };
      unmount();
      return read;
    })();
    // Somebody else in between: a tint taken from a render counter or an
    // index would move here.
    const { unmount } = mount(
      <PersonAvatar profile={profileOf({ user_id: BOB })} fallbackName="B B" side={40} />
    );
    const other = disc().background;
    unmount();
    const { unmount: u2 } = mount(
      <PersonAvatar profile={profileOf({ user_id: ALICE })} fallbackName="A N" side={40} />
    );
    expect(disc().background).toBe(first.background);
    expect(disc().color).toBe(first.color);
    u2();
    expect(other).not.toBe(first.background);
  });

  it("keys off the id, so a rename does not repaint the person", () => {
    const { unmount } = mount(
      <PersonAvatar profile={profileOf({ user_id: ALICE })} fallbackName="Alice Nguyen" side={40} />
    );
    const before = disc().background;
    unmount();
    const { unmount: u2 } = mount(
      <PersonAvatar
        profile={profileOf({ user_id: ALICE, display_name: "Alice N." })}
        fallbackName="Alice N."
        side={40}
      />
    );
    expect(disc().background).toBe(before);
    u2();
  });

  it("still tints somebody the batch could not name at all", () => {
    // `profile: null` is "nobody was found": there is no id, so the name is
    // the key. A grey disc for everybody unnamed is the thing this replaces.
    mount(<PersonAvatar profile={null} fallbackName="Alice Nguyen" side={40} />);
    const { node, background, color } = disc();
    expect(node.textContent).toBe("AN");
    expect(contrast(background, color)).toBeGreaterThanOrEqual(4.5);
  });
});
