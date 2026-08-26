---
"@stapel/cdn-react": patch
---

Visual pass VISUAL3: the attachment card fits the phone, the document arm stops
saying "PDF" twice, and the legacy queue chip-dump demo is gone.

**M-4, the 8-pixel overflow, was a box-sizing bug in the shared frame.** Every
arm of `MediaAttachment` draws inside one `frameStyle` that sets `width: 100%`
plus a `maxWidth`, and the document arm adds padding — measured content-box that
made the card 32px wider than the column it sits in, so the phone shot of the
document variant was a 398px document on a 390px viewport. The frame now
declares `boxSizing: "border-box"`: an element that owns its own width owns its
own padding.

**M-4 again, 664px this time.** The `thumbnail-tier` demo drew three fixed boxes
of 96 / 240 / 640 CSS pixels side by side, and the 640 one alone is wider than a
phone. Each frame is now `min(Npx, 100%)` with the image at `100%` of it. That
is not a compromise on the claim the demo exists to make — it is the claim:
`<Image>` measures THIS element, so on a phone the large frame requests the tier
that fits the width it actually got.

**M-4 copy:** the document badge and its label both spelled the extension, so
every PDF read `PDF  PDF document`. The badge keeps the extension; the label
names the medium (`Document` / `Документ` / `Documento`).

**N-4:** `cdn.gallery` — the headless `MediaUploader` drawn as three `state.step`
chip dumps — is deleted. `cdn.gallery-field` is the same queue with the shipped
skin on it and now carries the `MediaUploader` + `CdnProvider` coverage, so the
completeness gate is unchanged at 3 headless / 5-of-5 skin. That also removes
the one story in this package that rendered a raw i18n key (`cdn.gallery.count`)
as user-facing text.
