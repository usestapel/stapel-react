/** A zip browsed like a folder: the listing, the lock, a named refusal. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ArchiveSheetPanel } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const ZIP_ID = "d-zip";

const LISTING = {
  entry_count: 5,
  total_uncompressed_bytes: 18_400_000,
  archive_encrypted: false,
  entries: [
    { path: "site-report.pdf", size_bytes: 2_100_000, compressed_bytes: 1_900_000, is_dir: false, encrypted: false, mime_type: "application/pdf", modified_at: "2026-08-30T10:00:00" },
    { path: "photos/", size_bytes: 0, compressed_bytes: 0, is_dir: true, encrypted: false, mime_type: "", modified_at: null },
    { path: "photos/facade.jpg", size_bytes: 8_400_000, compressed_bytes: 8_300_000, is_dir: false, encrypted: false, mime_type: "image/jpeg", modified_at: "2026-08-30T10:02:00" },
    { path: "photos/yard.jpg", size_bytes: 7_600_000, compressed_bytes: 7_500_000, is_dir: false, encrypted: false, mime_type: "image/jpeg", modified_at: "2026-08-30T10:03:00" },
    { path: "measurements/plan.csv", size_bytes: 300_000, compressed_bytes: 90_000, is_dir: false, encrypted: false, mime_type: "text/csv", modified_at: null },
  ],
};

const ENCRYPTED = {
  ...LISTING,
  archive_encrypted: true,
  entries: LISTING.entries.map((entry) => ({ ...entry, encrypted: !entry.is_dir })),
};

const BROWSE: DemoHandlers = { [`/documents/${ZIP_ID}/archive`]: LISTING };
const LOCKED: DemoHandlers = { [`/documents/${ZIP_ID}/archive`]: ENCRYPTED };
const REFUSED: DemoHandlers = {
  [`/documents/${ZIP_ID}/archive`]: [
    413,
    {
      localizable_error: "error.413.docs_archive_too_many_entries",
      error: "The archive holds too many entries to browse",
      params: { limit: 10000, entries: 48211 },
    },
  ],
};

function Sheet(props: { readonly handlers: DemoHandlers }): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <ArchiveSheetPanel
        documentId={ZIP_ID}
        title="site-photos.zip"
        onClose={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.archiveSheet",
  title: "Archive sheet",
  description:
    "A zip document browsed as a compressed folder (viewing wave, stapel-docs 0.8.0). ONE listing request — the server reads the central directory by ranged storage reads, never the whole object — and the sheet does the folder illusion locally: descending a directory is a prefix filter over the array the first request already paid for. Members extract one at a time under the server's twice-checked ceilings; a viewable member previews inline, everything else downloads. Encryption is a STATE (the lock banner and a per-request password header), and every refusal is the backend's own named sentence.",
  component: ArchiveSheetPanel,
  variants: {
    default: {
      viewport: "phone",
      step: "browse",
      description:
        "The root rung of a real archive: a file, two directories (one explicit, one implied by a deeper path — zips are not required to carry directory rows), sizes from the central directory without inflating anything.",
      render: () => <Sheet handlers={BROWSE} />,
    },
    locked: {
      viewport: "phone",
      step: "encrypted",
      description:
        "A password-protected archive. The names are readable (ZipCrypto encrypts data, not the directory), so the sheet lists them with a Locked tag; the password field feeds the X-Docs-Archive-Password header per extraction and is stored nowhere — a wrong one renders the server's own refusal.",
      render: () => <Sheet handlers={LOCKED} />,
    },
    refused: {
      viewport: "phone",
      step: "refused",
      description:
        "A bomb-shaped archive refused whole (413, too many entries) — complete or refused, never truncated, because a truncated folder looks complete to everyone who renders it.",
      render: () => <Sheet handlers={REFUSED} />,
    },
  },
});
