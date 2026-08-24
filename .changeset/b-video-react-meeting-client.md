---
"@stapel/video-react": minor
---

The meeting client, not just the report about it.

Six browser-callable operations had no frontend at all: `POST /rooms`,
`GET /rooms/{join_code}`, `POST …/join`, `POST …/lobby/{admit,deny}` and
`GET …/participants`. The pair shipped the workspace-admin usage table and
nothing else — a package named `@stapel/video-react` that could not join a call.

**Added.** `useMeeting` (open a room / ask to join, holding the three-armed
outcome), `useLobby` (the queue, the two verdicts, and the live overlay merged
onto the REST page), `useRoom`, the lobby's frame vocabulary
(`decodeLobbyEvent`, `lobbyStreamKey`, `lobbySocketPath`, `lobbyLiveness`) and
the model that folds a `200 {status}` body and a `403 video_join_denied` throw
into ONE `JoinOutcome` — so a host's sticky refusal never renders as a generic
failure with a retry beside it. Default skins for all of it: `<RoomsPane>` (new
top-level nav entry `video.rooms`), `<MeetingPane>`, `<JoinGate>`,
`<LobbyPanel>`, `<ParticipantsList>`, `<CallStage>`.

The lobby socket is consumed through `@stapel/realtime` (new OPTIONAL peer), so
the 4401/4403 close-code table is the fleet's one reviewed copy. With no
provider or no `wsOrigin` the lobby renders a visible `offline` state and a
"Check again" — never the silent poll §83.1 records. `livekit-client` is a new
OPTIONAL peer loaded by `import()`; its absence is a designed screen naming the
package, and `<MeetingPane renderCallStage>` replaces the surface outright.

**Breaking (pre-1.0 ⇒ minor).** `src/default/theme.tsx` and
`src/default/ErrorAlert.tsx` are deleted: `VideoSkinTheme` and the pair's local
`ErrorAlert` are no longer exported from `/default`. Use `SkinTheme` /
`ErrorAlert` from `@stapel/tokens-antd/skin`. Peer floors raised to
`@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

**Fixed.** The `attendances` explanation is visible text instead of a `<Tooltip>`
(keyboard- and touch-unreachable); the four-column usage table becomes one card
per person below the tablet edge, measured on the pane's own box rather than the
viewport, so a narrow sidebar on a desktop is handled too; `months` is clamped to
the 1..36 the view accepts and the clamp is stated, with an `invalid period` arm
on the table — both predicates existed since 0.1.0 and reached no screen; counted
copy goes through `useTPlural` (`{count} people` was not a plural); `src/i18n/es.ts`
and the `./i18n/es` subpath ship, and the eight `video_*` error codes are authored
in all three locales instead of only ru, closing the locale-parity gap.
