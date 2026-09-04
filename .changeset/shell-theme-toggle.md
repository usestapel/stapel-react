---
"@stapel/shell-react": minor
---

shell: the theme switch's DEFAULT is now a compact icon toggle — `variant="settings"` brings the three-label control back

**This changes a default look.** `<ThemeModeControl/>` and `<ShellThemeControl/>`
render one 36px icon button by default, cycling light → dark → system on click.
The three-label segmented control they used to render is now
`variant="settings"` — pass it wherever you want the old control, on your own
appearance screen or anywhere else you had it. Nothing else moved: `<AppShell/>`
and `<PublicShell/>` mount the switch in exactly the slots they always did (foot
of the `Sider` and end of the header's account area on a desktop, foot of the
nav sheet on a phone), and `themeControl={false}` still opts out entirely.

The old default was a settings control mounted as chrome. The shells put the
switch in their header, and a ~310px track spelling out "Light / Dark / Match
system" in words stood in the first row of every desktop page — an appearance
SETTING wearing navigation's clothes. Hosts answered the only way they could:
switch the chrome's switch off and rebuild a home for it (the fleet's storefront
moved it to its footer and its account page). A default that every serious host
turns off is not a default, it is a shape nobody wanted, and the fix belongs in
the library rather than in each host's workaround.

What one icon button has to carry, it carries in its accessible name, which is
now its whole readout: both where the choice stands and where the next press
lands — `"Appearance: Dark. Switch to Match system"`. That sentence is a new
key, `shell.theme.cycle`, shipped in all three catalogues (`en`/`ru`/`es`) as a
TEMPLATE over `{current}` and `{next}`, so a translator keeps their own word
order instead of receiving two nouns glued to an English frame. `system` stays
tellable apart from the colour it resolves to, exactly as in the settings
variant: the name appends the resolution (`"Match system (Dark)"`). It is a
plain `<button>`, not `role="switch"` — a switch promises two states and this
cycles three — so Enter and Space work with no key handling of ours.

Also: `tooltip` (off by default, both variants) mirrors the accessible name into
a `title` for a pointer-only host; `ThemeModeLabels.cycle` is optional, so labels
written before this variant existed keep type-checking and fall back to the
English sentence. Both variants stay plain DOM and inline `currentColor` SVG
through `--stapel-*` custom properties with fallbacks — no CSS file, no antd,
and the `/theme` entry point is still under its 4 KB budget (2.24 KB).
