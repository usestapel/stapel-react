---
"@stapel/video-react": patch
---

Visual pass VISUAL3: the call stage stops handing an end user an npm install
command, the lobby says its one sentence once, and nothing on the usage screen
is a raw wire value.

**M-7 — the empty call stage was written for the integrator.** "Install
livekit-client, or fill the callStage slot with your own" is advice a person in
a meeting cannot act on. The screen now says what is true for them and what to
do about it: "Video is not available on this device — you are in the room and
everyone can see you here, but the picture and sound cannot start." In `en`,
`ru` and `es`; the test asserts the package name is NOT on screen.

**N-3 + M-4, one cause.** The lobby's liveness tag held a whole sentence, and
the same string was printed again as muted text under the button — so "Not live
— this list updates when you press Check again" appeared twice on five stories,
and, because an antd tag is one unbreakable line with a trailing margin, it also
made the document 392px wide on a 390px viewport. The tag now carries the STATE
("Not live"); the advice is a separate hint key rendered once.

**M-2 — ids and a month key as user-facing text.** stapel-video stores no name
for a user by design, and each skin takes a `nameFor` seam for it, but the demos
left it unfilled: the lobby's waiting person was `u-4c02` and every row of the
usage report was titled `u-9a1f`. The seam is wired in the demos. The month
selector offered the wire's `2026-08`; `usageMonthLabel` puts it through `Intl`
against `useFormat()`'s locale, so it reads "August 2026" beside the formatted
dates it sits next to.

**M-6.** `the-meeting-client` and `scope-usage` each declared a `phone` variant
that rendered the identical tree as `default` — the responsive switch here is
measured on the pane's own box, and the shot runner already shoots every story
at 390 and 1280. Dropped, with `viewport: "phone"` moved onto the surviving
variant, and `assertVariantsRenderDistinctly` added to `test/demos.test.tsx`
(jsdom renderer: the "turn away" question is a portal-rendered confirm).
