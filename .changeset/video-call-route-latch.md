---
"@stapel/video-react": patch
---

**A live call was hung up by a read that merely failed to confirm it.** `<CallRoute>` mounted the media session off a conjunction re-evaluated every render (`connected && call && grant`), and unmounting the stage disconnects the room — so one `GET /calls/active` answering `{call: null}` between two truths, or a sibling tab's `resolved` landing while this tab still held the pre-accept row, tore the session down mid-call and unrecoverably, because the same frame dropped the grant.

The session is now LATCHED BY `call.id`: it opens the first frame the conjunction holds, keeps the token, the url and the last row it saw for that id, and survives every later frame that does not confirm it. What closes it is an end — `decline`, `hangup`, the server's `call.ended` — or a different call becoming this browser's live one. `<CallsProvider>` binds a grant to the call it was minted for to make that statement true: it is withdrawn by an end, by another call taking over, or by an absence a second read confirms (the repair this provider is built on, so a lost `call.ended` on a best-effort socket still closes the screen).

**`<CallRoute autoPublish>`** is forwarded to the panel it mounts. The prop existed on a component no host renders directly, so a host publishing from its own device picker could not reach the panel that is really on screen.
