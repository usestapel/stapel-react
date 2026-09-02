/**
 * The skin's glyphs, and the mime ladder that picks one.
 *
 * Local SVGs rather than `@ant-design/icons` (the tasks-react precedent): that
 * package is 500+ components behind one barrel and no pair in the fleet
 * carries it, so a handful of inline paths are both smaller and one fewer
 * dependency. Every glyph paints with `currentColor` — the colour is the
 * surrounding text's, which is what makes them correct in both themes without
 * a single colour literal.
 *
 * They are decorative by construction (`aria-hidden`): the accessible name of
 * an icon-only control lives on the BUTTON as `aria-label`
 * (`stapel/icon-button-needs-label`), never on the picture inside it.
 *
 * The mime ladder is deliberately COARSE. A file manager that ships a bespoke
 * icon per extension maintains a mime table forever and still draws a generic
 * sheet for the format it has not heard of. Six families cover what a person
 * needs to tell apart at a glance in a list, and everything else is honestly
 * a file. Matching is on the mime type the SERVER sent, never on the
 * filename — the name is the one part of a file a user can lie in.
 */
import type { ReactElement } from "react";

interface GlyphProps {
  readonly size?: number;
}

function glyph(path: ReactElement, size: number, filled = false): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

/** A folder. */
export function FolderGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    size
  );
}

/** A generic file. */
export function FileGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>,
    size
  );
}

/** A document with text lines. */
export function TextGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>,
    size
  );
}

/** A picture. */
export function ImageGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
      <circle cx="9" cy="9" r="1.5" />
    </>,
    size
  );
}

/** A video. */
export function VideoGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3z" />
    </>,
    size
  );
}

/** A sound file. */
export function AudioGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </>,
    size
  );
}

/** A table / spreadsheet. */
export function TableGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </>,
    size
  );
}

/** A star — outlined when not starred, filled when it is. */
export function StarGlyph({
  size = 20,
  filled = false,
}: GlyphProps & { readonly filled?: boolean }): ReactElement {
  return glyph(
    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />,
    size,
    filled
  );
}

/** The per-row overflow trigger. */
export function MoreGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>,
    size,
    true
  );
}

/** Add / upload. */
export function PlusGlyph({ size = 20 }: GlyphProps): ReactElement {
  return glyph(<path d="M12 5v14M5 12h14" />, size);
}

/** The glyph for a document row, by its mime family. */
export function MimeGlyph(props: {
  readonly mimeType: string;
  readonly size?: number;
}): ReactElement {
  const mime = props.mimeType;
  const size = props.size;
  const sized = size !== undefined ? { size } : {};
  if (mime.startsWith("image/")) return <ImageGlyph {...sized} />;
  if (mime.startsWith("video/")) return <VideoGlyph {...sized} />;
  if (mime.startsWith("audio/")) return <AudioGlyph {...sized} />;
  if (mime === "text/csv" || mime.includes("spreadsheet")) {
    return <TableGlyph {...sized} />;
  }
  if (
    mime.startsWith("text/") ||
    mime.includes("document") ||
    mime === "application/pdf"
  ) {
    return <TextGlyph {...sized} />;
  }
  return <FileGlyph {...sized} />;
}
