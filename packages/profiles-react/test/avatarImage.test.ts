// @vitest-environment node
/**
 * THE WIRE'S AVATAR DESCRIPTOR IS NOT `<Image>`'s.
 *
 * `avatar_image` comes off the generated schema as `StapelImageDTO`, and three
 * things about it are wider than `@stapel/image`'s `StapelImage`: `source` is a
 * bare `string`, `variants` is OPTIONAL, and `variants[].branch` is a bare
 * `string` too. Every call site that wanted to draw a face wrote
 * `avatar_image as StapelImage` — an assertion that checks none of the three,
 * and the reason a storefront could not type an avatar at all without copying
 * the same cast into its own code.
 *
 * `profileAvatarImage` is where those three are repaired, so this suite pins
 * the repairs rather than the shape: the optional ladder becomes an array, an
 * unreadable branch becomes `null` (the contract's own word for "no branch"),
 * and an unknown source lands on `"link"` instead of a word this package made
 * up.
 */
import { describe, expect, it } from "vitest";
import { profileAvatarImage } from "../src/index.js";
import type { ProfileWithAvatarImage } from "../src/index.js";

const DESCRIPTOR = {
  source: "cdn",
  url: "https://cdn.example.test/avatar/original.jpg",
  mime: "image/jpeg",
  width: 800,
  height: 800,
  aspect: 1,
  square: true,
  preview_b64: "data:image/png;base64,AAAA",
};

function profile(
  avatar_image: Record<string, unknown> | null
): ProfileWithAvatarImage {
  return { avatar_image } as ProfileWithAvatarImage;
}

describe("profileAvatarImage", () => {
  it("says null for every way a profile can have no avatar", () => {
    expect(profileAvatarImage(profile(null))).toBeNull();
    expect(profileAvatarImage({})).toBeNull();
    expect(profileAvatarImage(null)).toBeNull();
    expect(profileAvatarImage(undefined)).toBeNull();
  });

  it("carries the descriptor through unchanged where the wire already agrees", () => {
    const image = profileAvatarImage(profile(DESCRIPTOR));
    expect(image).not.toBeNull();
    expect(image?.source).toBe("cdn");
    expect(image?.url).toBe(DESCRIPTOR.url);
    expect(image?.mime).toBe("image/jpeg");
    expect(image?.width).toBe(800);
    expect(image?.height).toBe(800);
    expect(image?.aspect).toBe(1);
    expect(image?.square).toBe(true);
    expect(image?.preview_b64).toBe(DESCRIPTOR.preview_b64);
  });

  it("gives an ABSENT ladder as an empty array — `undefined.length` is one render away", () => {
    const image = profileAvatarImage(profile(DESCRIPTOR));
    expect(image?.variants).toEqual([]);
  });

  it("keeps the rungs, and narrows a branch it cannot read to null", () => {
    const image = profileAvatarImage(
      profile({
        ...DESCRIPTOR,
        variants: [
          { tier: "320", branch: "w", url: "/320.jpg", width: 320, height: 320 },
          { tier: "640", branch: "h", url: "/640.jpg", width: 640, height: 640 },
          // The two the tier math has no branch for: the thumbnail class says
          // so with `null`, and a future/foreign word degrades to the same.
          { tier: "original", branch: null, url: "/o.jpg", width: 2000, height: 2000 },
          { tier: "160", branch: "diagonal", url: "/160.jpg", width: 160, height: 160 },
        ],
      })
    );
    expect(image?.variants.map((v) => v.branch)).toEqual(["w", "h", null, null]);
    expect(image?.variants.map((v) => v.tier)).toEqual([
      "320",
      "640",
      "original",
      "160",
    ]);
    expect(image?.variants[0]?.url).toBe("/320.jpg");
  });

  it("keeps the three sources stapel_core.media declares", () => {
    for (const source of ["cdn", "file", "link"]) {
      expect(profileAvatarImage(profile({ ...DESCRIPTOR, source }))?.source).toBe(
        source
      );
    }
  });

  it("reads an unknown source as `link` — the weakest TRUE statement, not an invented word", () => {
    const image = profileAvatarImage(profile({ ...DESCRIPTOR, source: "s3" }));
    // Still drawable: `<Image>` picks a rung out of `variants` and never reads
    // this field, so refusing the descriptor would lose a picture that works.
    expect(image?.source).toBe("link");
    expect(image?.url).toBe(DESCRIPTOR.url);
  });
});
