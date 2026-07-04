import { createStapelClient } from "@stapel/core";
import type { StapelClient } from "@stapel/core";
import { createAuthApi } from "../src/api/authApi.js";
import type { AuthApi } from "../src/api/authApi.js";
import type { AuthResponse } from "../src/api/types.js";

/** Base the msw handlers mount on (mirrors auth-sa.md's `/auth/api/`). */
export const BASE = "https://auth.stapel.test/auth/api";

export function makeClient(
  overrides: Partial<Parameters<typeof createStapelClient>[0]> = {}
): StapelClient {
  return createStapelClient({ baseUrl: BASE, ...overrides });
}

export function makeApi(client: StapelClient = makeClient()): AuthApi {
  return createAuthApi(client);
}

/** A canonical AuthResponse the msw handlers return on success. */
export function authResponse(
  status: AuthResponse["status"] = "LOGGED_IN"
): AuthResponse {
  return {
    status,
    user: { id: "u_1", email: "a@b.com", username: "ada" },
    tokens: { access: "acc_1", refresh: "ref_1" },
  };
}
