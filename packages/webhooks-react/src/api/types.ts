/**
 * Wire types for the stapel-webhooks HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-webhooks's OWN `docs/schema.json` — the §17-native
 * per-module contract). Alias the schemas this pair uses under local names
 * here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction (see auth-react `api/types.ts` for the three canonical patterns).
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// Alias the stapel-webhooks schemas the pair uses, e.g.:
//   export type Device = Schemas["Device"];
//   export type NotificationFeedPage = Schemas["PaginatedNotificationList"];
