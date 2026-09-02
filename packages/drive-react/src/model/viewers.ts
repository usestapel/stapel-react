/**
 * Which viewer a document opens in — the drive's dispatch, decided the way
 * the backend decides it: on the SERVER-SENT mime type of a `type=file`
 * document, never on the filename (the one part of a file a user can lie
 * in; the icon ladder in `default/icons.tsx` states the same rule).
 *
 * `null` means "not ours": an editable document routes to the host's
 * document surface (`onOpenDocument`), a download-only opaque file keeps
 * the row-action download. The viewers are additive — nothing that opened
 * before 0.4.0 stops opening.
 */
import type { DocDocument } from "@stapel/docs-react";

/** The four in-place viewers the drive skin ships. */
export type ViewerKind = "image" | "audio" | "video" | "archive";

/** Container types the archive sheet browses (mirrors the backend's
 * `ARCHIVE_MIME_TYPES`; `x-zip-compressed` is the legacy Windows spelling). */
const ARCHIVE_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
]);

/** The viewer this document opens in, or `null` when it is not a viewable
 * file (folders, editable documents, opaque downloads). */
export function viewerKindFor(document: DocDocument): ViewerKind | null {
  if (document.type !== "file") return null;
  const mime = document.mime_type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (ARCHIVE_MIMES.has(mime)) return "archive";
  return null;
}
