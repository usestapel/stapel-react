---
"@stapel/chat-react": minor
---

Stop showing the degradation sentence on healthy screens, and theme the default skin.

**"Refreshing every few seconds" was a standing banner, and that is a
regression of the defect it was written for.** `TransportTag` renders the named
degradation when there is one and falls back to a TRANSPORT label when there is
not. `transport` reads `"polling"` for every state that is not live — including
the three healthy ones: a socket still connecting, a socket deliberately held
back until the thread window loads (`socketEnabled: loaded`), and a `resync`
catching up. The label for `"polling"` was "Refreshing every few seconds", so a
perfectly healthy thread printed the pair's own complaint copy from its first
frame until the socket opened, and a thread whose window was still loading
printed it for as long as the read took. `chatDegradation` was right the whole
time; the sentence was keyed on the polling timer being armed rather than on
anything the seam could prove.

The original defect was a true sentence nobody could act on. This was the same
sentence shown when it was false, which leaves a person no way to tell a fixed
chat from a broken one and teaches them to skip the one message that matters.

`chat.transport.polling` is DELETED in all three locales rather than left
unused — an unreachable key is a sentence waiting to be wired back up by the
next person who needs "a polling label". The healthy fallback now says the true
thing: `chat.transport.connecting` ("Connecting…"), and
`chat.transport.catching_up` for a `resync`, which the tag can now tell apart
because it takes the stream `status` the bag already carried. Every sentence
about refreshing on a timer belongs to a named degradation — the only place the
seam can prove it. `test/degradation.test.tsx` asserts a live socket renders
the live label with no `data-degraded` and nothing matching /refreshing/, that a
still-connecting socket says nothing about refreshing either, that a socket
which really never connects still SAYS SO, and that no healthy-path label in
en/ru/es mentions refreshing.

**The default skin had no theme root.** `src/default/**` rendered antd
`Card`/`Typography`/`Tag` with no `ConfigProvider` of its own, so in a dark
document with none above it antd fell back to its LIGHT algorithm — tracker
\#26's failure, and how six of this pair's stories were photographed as white
text on a black field. New `ChatSkinTheme` delegates to
`@stapel/tokens-antd/skin`'s `SkinTheme` (reactive `useThemeMode()`, painted
surface, 44px phone control height) and every shipped surface wraps itself in
it. A hand-painted background would not have fixed it: the Card, the tag's
semantic colours and every border come from the algorithm.

**The demos photographed the broken deployment as the normal one.** The harness
turned the socket off for every variant, so every frame of the catalogue wore
"Live messages are off here — refreshing every few seconds instead". It also
meant the freshness seam POLLED, and a poll refetches with `type: "active"`,
which walks straight through `staleTime` and replaces a seeded variant three
seconds after anyone opens it. The harness now mounts a realtime client that is
already live on its first synchronous read (`useStream` seeds its state from
`client.streamStatus` during render, which is the only way a static shot can
show a live chat at all), and `socket: "off"` is opt-in — used by one variant,
`no-live-socket`, which is where the named degradation is photographed. A `dark`
variant photographs the theme root.
