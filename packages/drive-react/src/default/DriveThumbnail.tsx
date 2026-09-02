/**
 * `<DriveThumbnail/>` — a document's picture, or the honest glyph instead.
 *
 * ── The fallback is the feature ───────────────────────────────────────────
 *
 * `GET /documents/:id/thumbnail?tier=` can decline in three different ways
 * and a file list must survive all of them without a broken-image icon:
 *
 *   · the document is not an image (400) — never asked, `hasImagePreview`
 *     decides before a request exists;
 *   · Pillow is not installed on the backend (503) — the whole deployment has
 *     no previews, and every row falls back at once;
 *   · the cache entry is missing or the read failed (404 / anything else).
 *
 * All three land on the same answer — the mime glyph — because to a person
 * looking at a list they mean one thing: there is no picture for this. The
 * distinction matters to an operator, not to a thumb, and the operator has
 * the network tab. What must NOT happen is the browser's own broken-image
 * placeholder, which is what an `<img>` with no `onError` draws.
 *
 * The image is a plain `<img src>` at the authorized URL: same cookie, same
 * `authorize()` gate and same storage seam as the content endpoint (see
 * `model/thumbnails.ts`), so the browser's cache and the response `ETag`
 * (`"<head_seq>-<tier>"`) do the work a blob round trip would undo.
 *
 * Replaceable without a fork:
 * `registerDriveSkinComponent("thumbnail", …)` — the seam a header-token host
 * uses to swap in its own fetching image.
 */
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Flex, theme as antdTheme } from "antd";
import { radii } from "@stapel/tokens-antd";
import { useT } from "@stapel/core";
import type { DocDocument } from "@stapel/docs-react";
import { hasImagePreview, thumbnailTierFor, useThumbnailUrl } from "../model/thumbnails.js";
import { DRIVE_I18N_KEYS } from "../i18n/keys.js";
import { MimeGlyph } from "./icons.js";

export interface DriveThumbnailProps {
  readonly document: DocDocument;
  /** The box's side in px — also what picks the tier (nearest rung up). */
  readonly size: number;
}

export function DriveThumbnail(props: DriveThumbnailProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const buildUrl = useThumbnailUrl();
  const [failed, setFailed] = useState(false);
  const documentId = props.document.id;
  // A row recycled onto a different document must forget the previous one's
  // failure, or one missing preview would grey out every row after it.
  useEffect(() => {
    setFailed(false);
  }, [documentId]);

  const box: CSSProperties = {
    width: props.size,
    height: props.size,
    borderRadius: radii.sm,
    overflow: "hidden",
    flex: "none",
    background: token.colorFillTertiary,
    color: token.colorTextSecondary,
  };

  const previewable = hasImagePreview(props.document) && !failed;

  if (!previewable) {
    return (
      <Flex
        align="center"
        justify="center"
        style={box}
        data-testid="drive-thumbnail-fallback"
        data-drive-thumbnail="glyph"
      >
        <MimeGlyph mimeType={props.document.mime_type} />
      </Flex>
    );
  }

  return (
    <img
      src={buildUrl(documentId, thumbnailTierFor(props.size))}
      // The picture adds nothing a screen reader needs beyond the file name,
      // which is the row's title right beside it — so the alt names the ROLE
      // of the image rather than repeating the name a second time.
      alt={t(DRIVE_I18N_KEYS.previewAlt)}
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed(true);
      }}
      style={{ ...box, objectFit: "cover" }}
      data-testid="drive-thumbnail-image"
      data-drive-thumbnail="image"
    />
  );
}
