---
"@stapel/tokens-antd": patch
---

A carousel's height stops depending on how many slides it has

Two rules, one defect measured on a live card grid: a 4:3 tile with ONE photo
drew a 200px picture and the same tile with TWO drew 184, and the row of tiles
had a ragged bottom edge decided by how many photographs each seller had
uploaded.

- **`aspect-ratio` moves from the slide to the STRIP.** A peeking slide is
  `100% - peek` wide, so a ratio on the slide made the strip
  `(100% - peek) / ratio` tall. The strip's box does not move with the peek.
- **The indicator rides ON the picture when the shape is declared.** Below the
  strip the dots add their own row, so the same grid went ragged again from
  underneath — 16px taller wherever there was more than one photo. With a
  ratio there is a promise about the height to keep, so the dots are absolutely
  positioned over the last of it, on a pill mixed from the surface role. With
  no ratio the strip is as tall as its content, there is no promise, and they
  stay in the flow.
