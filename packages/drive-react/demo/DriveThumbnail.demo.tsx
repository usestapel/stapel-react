/** A picture when there is one, an honest glyph when there is not. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { DriveThumbnail, ROW_THUMBNAIL, TILE_THUMBNAIL } from "../src/default/index.js";
import type { DocDocument } from "@stapel/docs-react";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_BUDGET, DOC_CONTRACT, DOC_PHOTO } from "./fixtures.js";

// A demo has no object store, so the preview route answers 404 — which is
// precisely the branch worth photographing: what a list looks like when the
// picture is not there.
const NO_PREVIEW: DemoHandlers = { "/thumbnail": [404, {}] };

function Thumb(props: {
  document: DocDocument;
  size: number;
}): ReactElement {
  return (
    <DriveDemoHarness handlers={NO_PREVIEW}>
      <DriveThumbnail document={props.document} size={props.size} />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.thumbnail",
  title: "Thumbnail",
  description:
    "An <img> at the authorized thumbnail URL — same cookie, same authorize() gate and same storage seam as the content endpoint, so the browser's cache and the ETag do the work a blob round trip would undo. Three different refusals (not an image, no Pillow, no cached entry) land on one answer, because to a thumb they mean one thing: there is no picture for this.",
  component: DriveThumbnail,
  variants: {
    default: {
      viewport: "phone",
      step: "fallback-image",
      description:
        "An image document whose preview 404s: the picture glyph, never the browser's broken-image icon.",
      render: () => <Thumb document={DOC_PHOTO} size={TILE_THUMBNAIL} />,
    },
    pdf: {
      viewport: "phone",
      step: "fallback-mime",
      description:
        "A PDF: no request is made at all — the mime says there is no image preview, so the glyph is drawn without asking.",
      render: () => <Thumb document={DOC_CONTRACT} size={ROW_THUMBNAIL} />,
    },
    sheet: {
      viewport: "desktop",
      step: "fallback-table",
      description: "A CSV gets the table glyph — six families, matched on the server's mime.",
      render: () => <Thumb document={DOC_BUDGET} size={TILE_THUMBNAIL} />,
    },
  },
});
