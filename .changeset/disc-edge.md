---
"@stapel/tokens-antd": minor
"@stapel/profiles-react": patch
"@stapel/chat-react": patch
---

The identity disc gets an edge, so it reads as a disc rather than as two letters floating beside a name.

The disc is 1.04:1 against a pale page at its worst — a pale tint on a pale
ground has almost no luminance contrast, which the module said out loud when it
shipped and declined to paper over. The initials carry the identity at 8.4:1;
what was missing is the boundary that makes the thing an avatar.

`IdentityTint` now carries a third colour, `border` — the family's own
{@link IDENTITY_TINT_EDGE_SHADE} (shade 4), between the disc (2) and the ink
(10): a border darker than the letters reads as a ring somebody drew on
purpose, and one lighter than the disc is invisible by construction.

**It is a hairline, not a ring, and the measurement says why.** Against the
page, worst family of thirteen, both algorithms: shade 4 is 1.13:1 light /
1.42:1 dark, shade 5 is 1.21 / 1.76, shade 6 is 1.38 / 2.23, shade 7 is 2.08 /
3.46. None is a 3:1 boundary — and that is the wrong bar rather than a failure
here, because the design system's OWN hairlines measure 1.14 / 1.40
(`colorBorderSecondary`) and 1.41 / 1.83 (`colorBorder`) against the same
ground. Shade 4 is exactly the weight of a normal border in this system. Shade
7 would clear 3:1 in the dark algorithm only, and draws an outlined badge.

**It costs no geometry**, which is the other reason it is safe to add
everywhere at once: antd's `<Avatar>` already reserves `border: 1px solid
transparent` and sizes itself `box-sizing: border-box`. Measured in headless
Chromium over 26 rendered discs in both themes, every box is still exactly
40x40 or 72x72, the border computes to 1px, and the initials still fit and sit
centred on both axes in all 26 — with the ink-on-disc ratio unchanged at 9.27:1
light and 10.44:1 dark for those keys.

Both surfaces that draw a person read the same third colour, so the seller
line, the seller page, the listing page's seller block and the chat inbox grow
the same edge in one release.
