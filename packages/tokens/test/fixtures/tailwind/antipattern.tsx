// ANTI-PATTERN (frontend-guardrails §1.5, legacy-port failure): a Tailwind
// arbitrary value built by interpolation. The JIT scanner sees the LITERAL
// source text `bg-[${accent}]` — not a resolved colour — so no utility is
// emitted for it: "works in dev, breaks in prod". Contrast with the static
// `good` class, which the JIT DOES see. This file is a fixture, not shipped.
const accent = "var(--stapel-color-accent)";

export const bad = `bg-[${accent}]`; // JIT-invisible — proven absent in the test

export const good = "bg-upperground-primary"; // static — proven present
