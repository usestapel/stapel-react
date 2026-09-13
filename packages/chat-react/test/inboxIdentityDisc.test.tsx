/**
 * THE INBOX'S FACES WEAR THE SAME DISC AS EVERY OTHER SURFACE.
 *
 * The gradient blobs on the live stand were the seed's own avatar images, not
 * a defect in any pair — but when that seed is cleared, the no-photo arm is
 * what a visitor sees, and this package draws its OWN avatar. `<PersonAvatar>`
 * in `@stapel/profiles-react` draws the other three surfaces (a result card's
 * seller line, the seller page, the listing page's seller block) and these two
 * components may not import one another. A tint decided in one of them is the
 * same person wearing two colours on one screen — so the decision lives in
 * `@stapel/tokens-antd/skin`, which both already depend on, and this file
 * asserts that the inbox actually reads it.
 *
 * WHAT THIS ASSERTS: the initials on a coloured disc, the same colour for the
 * same person, and the initials at 4.5:1 against their own disc in both
 * themes — with BOTH OPERANDS READ OFF THE SAME RENDERED NODE (its own inline
 * `background-color` and `color`), never a token looked up here and paired
 * with an assumed partner.
 *
 * WHAT IT CANNOT SEE: jsdom resolves no cascade, so "no antd class overrides
 * either half between here and the glass" is a browser fact, proved in
 * headless Chromium (see the changeset).
 */
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { identityTint } from "@stapel/tokens-antd/skin";
import { theme as antdTheme } from "antd";
import { ConversationListPanel } from "../src/default/index.js";
import type { ChatPeopleSlotProps, ChatSlots } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import { BUYER, SELLER, conversation, conversationPage } from "./fixtures.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

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

/** A directory that names people and resolves no photograph — the arm the
 * cleared seed leaves behind. */
function people(names: Readonly<Record<string, string>>): ChatSlots {
  return {
    people: (props: ChatPeopleSlotProps) =>
      props.children({
        pending: false,
        lookup: (id: string) =>
          names[id] === undefined
            ? null
            : { userId: id, displayName: names[id] as string, avatarUrl: null },
      }),
  };
}

/** The mode is the DOCUMENT's, the way a host sets it and the way the skin
 * reads it — there is no theme prop to pass. */
async function inbox(mode?: "light" | "dark"): Promise<HTMLElement> {
  if (mode !== undefined) document.documentElement.setAttribute("data-theme", mode);
  const server = mockServer({
    "GET /conversations": { body: conversationPage([conversation()]) },
  });
  render(
    <TestHarness
      server={server}
      realtime={{ socketUrl: null }}
      slots={people({ [BUYER]: "Svetlana Gushchina" })}
    >
      <ConversationListPanel viewerId={SELLER} />
    </TestHarness>
  );
  return await screen.findByTestId("chat-row-avatar");
}

describe("the inbox draws the fleet's identity disc", () => {
  it("puts the initial on a tinted disc, both colours on the node", async () => {
    const node = await inbox();
    expect(node.textContent).toBe("S");
    expect(node.style.backgroundColor).not.toBe("");
    expect(node.style.color).not.toBe("");
    expect(node.dataset["avatar"]).toBe("initial");
  });

  for (const mode of ["light", "dark"] as const) {
    it(`keeps the initial at 4.5:1 against its disc in the ${mode} theme`, async () => {
      const node = await inbox(mode);
      const ratio = contrast(node.style.backgroundColor, node.style.color);
      expect(ratio, `${mode} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("agrees with the other surfaces about this person's colour", async () => {
    const node = await inbox();
    // The SAME decision, read the same way a profiles surface reads it: if
    // the two packages ever drift, one person wears two colours on one screen.
    const expected = identityTint(BUYER, antdTheme.getDesignToken());
    expect(node.dataset["tint"]).toBe(expected.family);
  });
});
