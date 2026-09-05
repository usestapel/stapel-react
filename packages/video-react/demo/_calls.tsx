/**
 * Fixtures for the call demos.
 *
 * Real-shaped bodies, the way `_meeting.tsx` does it: the field names, the
 * snake_case and the ISO instants `CallResponse` actually carries, so a demo
 * cannot quietly document a shape the server does not send. In particular
 * `duration_seconds` and `expires_at` are the SERVER's — a demo that computed
 * either locally would be showing a number this pair is careful never to
 * derive.
 */
import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import { VideoProvider, callQueryKeys, createVideoRuntime, registerVideoI18n } from "../src/index.js";
import type { CallResponse } from "../src/index.js";
import type { CallMediaRoom } from "../src/default/CallPanel.js";
import { DEMO_BASE, VideoDemoHarness, mockFetch } from "./_harness.js";

export { VideoDemoHarness } from "./_harness.js";

/** The providers a call demo renders inside. */
export function CallDemoFrame(props: { children: ReactNode }): ReactElement {
  return <VideoDemoHarness>{props.children}</VideoDemoHarness>;
}

/**
 * The same frame, with a call ALREADY IN THE CACHE.
 *
 * `<VideoDemoHarness>` answers `/calls/active` over a canned fetch, which is
 * right for a Ladle session and useless for a photograph: the request resolves
 * a tick after the static render, so a screenshot of the ring catches an empty
 * page — and four variants of an empty page are byte-identical, which is
 * exactly what the demo distinctness gate exists to refuse.
 *
 * So the state is SEEDED rather than fetched. `callQueryKeys.active` is the
 * pair's own key, `{ call }` is the body the endpoint actually answers with,
 * and the overlay reads it through the ordinary hook — nothing here is a
 * shortcut around the component's real data path, only around the round trip.
 */
export function RingDemoFrame(props: {
  call: CallResponse;
  children: ReactNode;
}): ReactElement {
  const { call } = props;
  const { runtime, i18n, queryClient } = useMemo(() => {
    const engine = createI18n({ locale: "en" });
    registerVideoI18n(engine);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(callQueryKeys.active, { call });
    return {
      runtime: createVideoRuntime({ baseUrl: DEMO_BASE, fetch: mockFetch({}) }),
      i18n: engine,
      queryClient: client,
    };
  }, [call]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <VideoProvider runtime={runtime}>{props.children}</VideoProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** A ringing call between two people who are not named after anybody. */
export function ringingDemoCall(
  overrides: Partial<CallResponse> = {}
): CallResponse {
  return {
    id: "c0ffee00-0000-4000-8000-000000000001",
    thread_key: "3d2b7c10-0000-4000-8000-000000000002",
    caller_id: "u-9a1f",
    callee_id: "u-4c02",
    room_name: "call-c0ffee00-0000-4000-8000-000000000001",
    media: "video",
    state: "ringing",
    end_reason: "",
    started_at: "2026-09-06T09:59:55+00:00",
    answered_at: null,
    ended_at: null,
    duration_seconds: 0,
    expires_at: "2026-09-06T10:00:40+00:00",
    ...overrides,
  } as CallResponse;
}

/**
 * A room object that answers the four methods `<CallPanel>` touches.
 *
 * Not a mock LiveKit: the panel declares its slice of the SDK structurally for
 * exactly this reason, and a demo that stood one up would be documenting the
 * mock. Every method resolves, so the controls in the demo behave the way they
 * do on a working connection.
 */
export const DEMO_ROOM_MEDIA: CallMediaRoom = {
  localParticipant: {
    setMicrophoneEnabled: () => Promise.resolve(undefined),
    setCameraEnabled: () => Promise.resolve(undefined),
  },
  switchActiveDevice: () => Promise.resolve(undefined),
};
