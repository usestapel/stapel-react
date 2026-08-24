/** The download-only surface: what a document with no editor degrades to. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FileCard } from "../src/default/index.js";
import { DocsDemoHarness, neverSettles } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DOC_CONTRACT } from "./fixtures.js";

const READY: DemoHandlers = {
  "/documents/d-contract/download": { url: "https://cdn.demo.invalid/signed" },
  "/documents/d-contract": DOC_CONTRACT,
};
const MINT_FAILED: DemoHandlers = {
  "/documents/d-contract/download": [
    503,
    { code: "error.503.docs_download_url_unavailable" },
  ],
  "/documents/d-contract": DOC_CONTRACT,
};
const MINTING: DemoHandlers = {
  "/documents/d-contract/download": neverSettles,
  "/documents/d-contract": DOC_CONTRACT,
};

function Card(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DocsDemoHarness handlers={props.handlers}>
      <FileCard documentId={DOC_CONTRACT.id} />
    </DocsDemoHarness>
  );
}

export default defineDemo({
  id: "docs.file-card",
  title: "File card",
  description:
    "editor_hint '' means download-only by contract, and an unknown hint degrades here too — a file, never a crash. The download button is gated, so a URL that could not be minted greys it out WITH the reason: 'still minting' and 'the mint failed' used to look identical.",
  component: FileCard,
  covers: ["MediaViewer"],
  variants: {
    default: {
      viewport: "phone",
      step: "url-ready",
      description: "The opaque URL minted; the download is live.",
      render: () => <Card handlers={READY} />,
    },
    minting: {
      viewport: "phone",
      step: "url-loading",
      description: "The URL is still being minted — off, and it says so.",
      render: () => <Card handlers={MINTING} />,
    },
    "mint-failed": {
      viewport: "desktop",
      step: "url-failed",
      description: "Storage cannot mint links: the title survives, only the download is blocked.",
      render: () => <Card handlers={MINT_FAILED} />,
    },
  },
});
