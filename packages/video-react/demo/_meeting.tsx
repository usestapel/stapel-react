/**
 * Fixtures and the provider frame the meeting demos render inside.
 *
 * Real-shaped bodies: the field names, the snake_case and the ISO instants
 * `stapel-video`'s `RoomResponse` / `ParticipantResponse` actually carry, so a
 * demo cannot quietly document a shape the server does not send.
 */
import type { ReactElement, ReactNode } from "react";
import { actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { ParticipantResponse, RoomResponse } from "../src/index.js";
import { VIDEO_I18N_KEYS } from "../src/i18n/keys.js";
import { VideoDemoHarness } from "./_harness.js";

export { VideoDemoHarness } from "./_harness.js";
export { staticLobbyBag, staticMeetingBag } from "../src/index.js";

/** The room every meeting demo is about. */
export const DEMO_ROOM: RoomResponse = {
  id: "b3f1c0de-0000-4000-8000-000000000001",
  join_code: "abc-defg-hij",
  scope_key: "acme-7f0c",
  access_level: "scope_trusted",
  admit_required: true,
  created_by_id: "u-9a1f",
  provider_room_ref: "lk_room_7f0c",
};

export const DEMO_HOST: ParticipantResponse = {
  id: "p-0001",
  user_id: "u-9a1f",
  status: "admitted",
  role: "host",
  joined_at: "2026-08-24T09:12:04Z",
};

export const DEMO_WAITING: ParticipantResponse = {
  id: "p-0002",
  user_id: "u-4c02",
  status: "waiting",
  role: "guest",
  joined_at: "2026-08-24T09:14:41Z",
};

export const DEMO_GUEST: ParticipantResponse = {
  id: "p-0003",
  user_id: "u-b7de",
  status: "admitted",
  role: "guest",
  joined_at: "2026-08-24T09:15:02Z",
};

/**
 * The host seam every skin in this package takes as `nameFor`.
 *
 * stapel-video keeps no FK to a user by design (erasure can pseudonymize the
 * column), so the wire carries `user_id` and nothing else — and a demo that
 * left the seam unfilled photographed a lobby whose one waiting person was
 * called `u-4c02` and a usage report whose rows were titled `u-9a1f` (visual
 * pass M-2). A host resolves these from the roster its page already has; this
 * is that roster.
 */
export const DEMO_USER_NAMES: Readonly<Record<string, string>> = {
  "u-9a1f": "Dana Reyes",
  "u-4c02": "Milo Fischer",
  "u-b7de": "Priya Raman",
};

/** What a host passes as `nameFor`. */
export function demoNameFor(userId: string): string {
  return DEMO_USER_NAMES[userId] ?? userId;
}

/** The gate a viewer who is not the host sees on the two verdicts. */
export function actionBlockedForDemo(): ActionAvailability {
  return actionBlocked(VIDEO_I18N_KEYS.lobbyBlockedNotHost);
}

/** Every meeting demo renders inside the pair's providers (query client, i18n,
 * the video runtime over a canned fetch). No socket: `<RealtimeProvider>` is
 * deliberately absent, so the lobby's "not live" arm is what the showcase
 * photographs — which is the state a host that has not wired the socket
 * actually ships. */
export function MeetingFrame(props: { children: ReactNode }): ReactElement {
  return <VideoDemoHarness>{props.children}</VideoDemoHarness>;
}
