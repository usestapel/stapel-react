import { describe, expect, it } from "vitest";
import { createVideoRuntime } from "../src/index.js";
import { BASE, SCOPE, mockServer } from "./harness.js";

/**
 * `POST …/lobby/deny` answers the denied participant NESTED, since
 * stapel-video 0.13.0 — the symmetric twin of `admit`, minus the token.
 *
 * Before that the route was declared as answering the request body back, so
 * a host screen that read `body.status` or `body.participant_id` read
 * `undefined` off the real wire and re-rendered the row it had just acted on
 * as if nothing had happened.
 */
const DENIED = {
  id: "p-2",
  display_name: "Guest",
  status: "denied",
  role: "guest",
  joined_at: "2026-09-18T10:00:00Z",
};

describe("the deny verdict answers a participant", () => {
  it("nests the row under `participant`, with the flat reads gone", async () => {
    const server = mockServer({
      "POST /lobby/deny": { body: { participant: DENIED } },
    });
    const runtime = createVideoRuntime({
      baseUrl: BASE,
      scopeKey: SCOPE,
      fetch: server.fetch,
    });
    const body = await runtime.api.denyParticipant("join-code", {
      participant_id: "p-2",
    });
    expect(body.participant.id).toBe("p-2");
    expect(body.participant.status).toBe("denied");
    // The two reads a pre-0.13.0 host made, and what they would find now.
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("participant_id");
    expect(server.calls[0]?.method).toBe("POST");
  });
});
