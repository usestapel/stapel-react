---
"@stapel/image": minor
---

A failed image load is not a successful one: `renderError` and an honest default

`loader.onerror = commit`. One line, and it meant the component treated a load
that never arrived exactly like a load that did: state flipped to "displayed",
an `<img src>` went into the DOM pointed at a url the browser had already
refused, and the page drew the native broken-image rendering — a torn-page
glyph sized to the slot, the alt string in the browser's own font, inside a
container the design system otherwise controls completely. There was no error
arm at all, so a caller could not say anything else either.

A failed variant now lands in an error state:

- **the default** is a neutral placeholder — a sunken box using token roles
  (`--stapel-surface-sunken` / `--stapel-text-muted`, referenced as CSS
  variables so the package keeps its zero runtime dependencies), an inline
  broken-image glyph in `currentColor`, and the `alt` text the caller already
  wrote, announced as `role="img"` with `aria-label={alt}`;
- **`renderError({ alt, meta, url })`** replaces it wholesale for a host with
  its own missing-media treatment.

Two rules the tests pin, because both are ways this could have been wrong:

1. **A failed UPGRADE is not an error.** If a tier is already on screen and a
   bigger one fails, the person keeps looking at the image — the error state is
   only for a slot that has nothing in it.
2. **A later success clears it.** A re-measure that picks a variant which does
   load replaces the placeholder with the image.

`decode()`'s rejection is now treated as the failure it reports (an
`EncodingError`, or the load failure itself) rather than being swallowed into
the success path; the no-`decode` branch uses `onload` / `onerror` the same way.
