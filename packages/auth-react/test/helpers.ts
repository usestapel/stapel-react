import { createStapelClient } from "@stapel/core";
import type { StapelClient } from "@stapel/core";
import { createAuthApi } from "../src/api/authApi.js";
import type { AuthApi } from "../src/api/authApi.js";
import type { AuthResponse, StapelUser } from "../src/api/types.js";

/** Base the msw handlers mount on (mirrors auth-sa.md's `/auth/api/`). */
export const BASE = "https://auth.stapel.test/auth/api/v1";

export function makeClient(
  overrides: Partial<Parameters<typeof createStapelClient>[0]> = {}
): StapelClient {
  return createStapelClient({ baseUrl: BASE, ...overrides });
}

export function makeApi(client: StapelClient = makeClient()): AuthApi {
  return createAuthApi(client);
}

/** A full generated `User` — the schema requires the whole server projection. */
export function testUser(overrides: Partial<StapelUser> = {}): StapelUser {
  return {
    id: "u_1",
    username: "ada",
    email: "a@b.com",
    phone: null,
    auth_type: "email",
    is_email_verified: true,
    is_phone_verified: false,
    is_anonymous: false,
    is_staff: false,
    is_superuser: false,
    oauth_provider: null,
    created_at: "2026-01-01T00:00:00Z",
    last_login: null,
    ...overrides,
  };
}

/** A canonical AuthResponse the msw handlers return on success. */
export function authResponse(
  status: AuthResponse["status"] = "LOGGED_IN"
): AuthResponse {
  return {
    status,
    user: testUser(),
    tokens: { access: "acc_1", refresh: "ref_1" },
  };
}
