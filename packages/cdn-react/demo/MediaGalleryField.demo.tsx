/**
 * The listing composer's photo grid, skinned — and the three states that are
 * worth photographing rather than the one that was.
 *
 * The visual pass found this surface saying "1 of 1 photos" and "at most 1
 * photos" in the same card, and an empty gallery drawn as two lines of grey
 * text. Both are here on purpose: `full` is the shot that used to be wrong
 * twice, and `empty` is the state a person meets first.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MediaGalleryField } from "../src/default/index.js";
import { CdnDemoHarness, DEMO_MISS, demoImage } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

const STORING: DemoHandlers = {
  "/file/exists/": DEMO_MISS,
  "/upload/image/": { image: demoImage(), message: "ok" },
};

function Gallery(props: {
  max: number;
  refs?: readonly string[];
}): ReactElement {
  return (
    <CdnDemoHarness handlers={STORING}>
      <MediaGalleryField
        max={props.max}
        {...(props.refs === undefined ? {} : { initialRefs: props.refs })}
      />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.gallery-field",
  title: "Photo gallery (default skin)",
  description:
    "Up to ten photos, each with its own step, its own refusal and its own controls, inside one drop target. The order IS the meaning — the first reference is what a search card shows — so reordering is drag-and-drop AND a pair of move buttons, because drag is unreachable by keyboard and unusable on a touch screen.",
  component: MediaGalleryField,
  covers: ["MediaUploader", "CdnProvider"],
  tokens: ["border-subtle", "surface-sunken"],
  variants: {
    empty: {
      description:
        "Nothing added yet: a designed empty state inside the target, not two lines of grey text.",
      viewport: "phone",
      step: "empty",
      render: () => <Gallery max={10} />,
    },
    "three photos": {
      description:
        "A reopened draft. The first tile is labelled as the cover, and only it has no 'move earlier'.",
      viewport: "desktop",
      step: "restored",
      render: () => (
        <Gallery
          max={10}
          refs={[`product/${HASH_A}`, `product/${HASH_B}`, `product/${HASH_C}`]}
        />
      ),
    },
    full: {
      description:
        "The shot that used to read '1 of 1 photos' and 'at most 1 photos'. The count is a plural family now, and the blocked reason names the ceiling without a counted noun — the gate resolves a code with `t`, which cannot select a form.",
      viewport: "desktop",
      step: "blocked-full",
      render: () => <Gallery max={1} refs={[`product/${HASH_A}`]} />,
    },
  },
});
