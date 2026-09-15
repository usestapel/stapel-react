---
"@stapel/video-react": patch
---

`NARROW_LIMIT` reads the `tablet` token instead of restating it.

It was the literal `768` under a comment promising it "matches the tablet edge
of `@stapel/tokens`' three breakpoints" — a claim that was true the day it was
written and unchecked every day after, the same class as a schema that says it
matches the wire. It is now `breakpoints.tablet`, so a token move carries it.

The value does not change (`breakpoints.tablet` is 768), and `useNarrow` still
measures the ELEMENT and only falls back to the viewport where there is nothing
to measure. Found by the sweep that fixed the shell's chrome edge
(`@stapel/shell-react` 0.19.0), where the same hard-coded width had collapsed
three breakpoints to two.
