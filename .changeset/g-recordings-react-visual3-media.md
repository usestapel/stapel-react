---
"@stapel/recordings-react": patch
---

Visual pass VISUAL3: the player actually plays, both brand blues become one, the
detail pane stops reporting a locale code and a model id, and five legacy
chip-dump stories are deleted.

**The five console errors, and the player frozen at `0:00 / 0:00`.** The demo's
minted media URL pointed at `store.demo.stapel.dev`, a host that does not exist:
every shot of the player, the shared playback and the public share page recorded
`net::ERR_CONNECTION_CLOSED` and photographed a dead transport under a heading
saying the recording ran half an hour. The showcase has no CDN and must render
under a strict CSP, so the demo now carries its own audio — a silent WAV
generated from a formula (8 kHz 8-bit mono, so the repository holds the formula
and not a megabyte of base64) whose length IS the duration the fixture reports.
The transport and the metadata can no longer disagree.

**N-8 — two brand blues inside one package.** `ShareUnlockGate` and
`PaymentRequiredNotice` were the two surfaces that never mounted `SkinTheme`.
Both are surfaces with no owner chrome above them — an anonymous share link, a
notice a host drops onto a page of its own — so they fell through to antd's
stock accent, and the one primary button on the link a customer is sent was a
different blue from the rest of the product. Both are themed now; no colour is
named anywhere in this package.

**M-2 — a locale code and a model id printed as metadata.** `Language: en` goes
through a new `format.language` (`Intl.DisplayNames`, same family as every other
formatter in `model/format.ts`), so it reads "English" — or the reader's word
for it. `Transcribed by: whisper-large-v3` is an operator's fact from a
vocabulary that changes with the deployment's pipeline, so it keeps its place
but takes the register `cdn-react` gives a `meta_reason`: muted, monospaced,
where an eye skips it and a support agent finds it.

**A recording still being transcribed now says so from the first frame.** The
transcript pane rendered a skeleton while the read was in flight — a promise of
text that is not on its way, since the pipeline has not written any. It renders
the pending sentence instead, which is also what makes the state photographable:
`recordings.transcript-skin`'s two variants were byte-identical until this.

**N-4.** `recordings.provider`, `recordings.list`, `recordings.composer` and
`recordings.finalize` — four `state.step` chip dumps of the old harness — are
deleted. `recordings.list-skin` and `recordings.uploader-skin` are the same
components with the shipped skin on them and carry the coverage, so the gate
holds at 11 headless / 13-of-13 skin.

`test/demos.test.tsx` now runs `assertVariantsRenderDistinctly` against a jsdom
renderer. It caught the transcript pane on its first run.
