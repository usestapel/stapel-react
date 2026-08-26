/**
 * The avatar/cover slot, as it actually ships.
 *
 * Photographed because the visual pass photographed the OLD one and found "an
 * image-upload widget with no visible way to give it an image": a bare button
 * over a hidden input. Both variants below are states a STATIC shot can prove —
 * an empty slot that looks like a slot, and a filled one — because a state
 * reached only by a click is never photographed, which is what the seeded-step
 * rule exists to stop.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ImageUploadField } from "../src/default/index.js";
import { CdnDemoHarness, DEMO_MISS, demoImage } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

/** A stored avatar, drawn as a `data:` SVG so the shot needs no network. */
const STORED_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
      `<rect width="96" height="96" fill="#8aa1c1"/>` +
      `<circle cx="48" cy="38" r="16" fill="#f2f5f9"/>` +
      `<path d="M16 96c8-20 20-28 32-28s24 8 32 28z" fill="#f2f5f9"/>` +
      `</svg>`
  );

const STORING: DemoHandlers = {
  "/file/exists/": DEMO_MISS,
  "/upload/avatar/": { image: demoImage(), message: "ok" },
};

function Slot(props: { currentUrl?: string }): ReactElement {
  return (
    <CdnDemoHarness handlers={STORING}>
      <ImageUploadField
        target={{ kind: "avatar" }}
        {...(props.currentUrl === undefined ? {} : { currentUrl: props.currentUrl })}
      />
    </CdnDemoHarness>
  );
}

export default defineDemo({
  id: "cdn.image-field",
  title: "Image slot (default skin)",
  description:
    "One image, skinned: a bordered region that takes a drop, a label that makes the whole rectangle open the picker, and a focusable button beside it for the keyboard. The picked or stored image is drawn INSIDE the frame, so an empty slot still looks like a slot — the affordance the shipped control did not have at all.",
  component: ImageUploadField,
  covers: ["ImageUpload"],
  tokens: ["border-subtle", "surface-sunken"],
  variants: {
    empty: {
      description: "Nothing chosen yet: the drop target IS the affordance.",
      viewport: "phone",
      step: "idle",
      render: () => <Slot />,
    },
    stored: {
      description:
        "A reference already stored, drawn inside the frame it will be replaced in — and the button now says Replace.",
      viewport: "desktop",
      step: "stored",
      render: () => <Slot currentUrl={STORED_URL} />,
    },
  },
});
