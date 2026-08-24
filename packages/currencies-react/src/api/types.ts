/**
 * Wire types for the stapel-currencies HTTP contract — **derived from the
 * generated OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 * The single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-currencies's OWN `docs/schema.json`, which the
 * backend has emitted from its own codegen triad since 0.1.9).
 *
 * ── Two things the wire says that a reader must not smooth over ────────────
 *
 * `display_name` is NOT a name. It is a TRANSLATION KEY — `"currency.usd"` —
 * and rendering it verbatim puts `currency.usd` on a price tag. It is resolved
 * through this pair's own i18n bundle (the same 16 keys stapel-translate
 * serves), which is why `CURRENCIES_I18N_KEYS` carries a `currency.<code>`
 * entry per seeded code in en/ru/es.
 *
 * `value` is a DECIMAL STRING, `Decimal(20, 8)` on the server: the exchange
 * rate relative to the deployment's base currency, where 1 base = `value`
 * units of this currency. It never becomes a `number` in this package —
 * `model/money.ts` does scaled-integer arithmetic on the string, because
 * `0.1 + 0.2` is the reason money libraries exist.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

/**
 * One row of the public currency catalogue.
 *
 * `value`, `symbol` and `is_active` are optional in the schema because the
 * serializer's model fields carry defaults; in practice the list route only
 * ever returns `is_active: true` rows (the queryset filters), so the flag is a
 * constant on this surface rather than a state a skin branches on.
 */
export type Currency = Schemas["Currency"];
