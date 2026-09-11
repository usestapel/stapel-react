---
"@stapel/video-react": patch
---

The mute-toggle test waits for the pressed VALUE, not just for the room to
have been called.

`toggleMic` awaits `room.localParticipant.setMicrophoneEnabled`, then calls
`setMicOn` outside `act`, so the pressed state lands one tick behind the call
itself. Two reads in `mutes and unmutes through the room` assumed otherwise:
the wait before the click watched the mount's auto-publish CALL, which fires
synchronously before its own await ever yields and says nothing about whether
`micOn` had actually flipped — clicking before it had made `toggleMic` read
the stale value and call the room with `true` again instead of `false` — and
the final assert read `aria-pressed` with a plain `expect` right after,
racing the click's own resolution. On a loaded CI box either race could lose,
failing `expected 'false' to be 'true'` on a rerun.

Both reads now wait for the value they depend on — the mount's committed
pressed state before clicking, the click's committed pressed state after —
exactly as strict as before. The room double also resolves off a task of its
own now, the way a real device negotiation does, so the race is observable
locally instead of only on CI. Test-only; no behaviour change.
