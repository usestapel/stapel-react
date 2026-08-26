/**
 * Hand-authored API surface the codegen does not (and cannot) cover.
 *
 * ── Why the move endpoint needs code here ──────────────────────────────────
 *
 * `POST tasks/{id}/move` answers a `MoveResponse` under THREE statuses:
 * 200 `applied`, 202 `deferred`, **409 `denied`**. The first two are `ok` and
 * reach the caller as a parsed body. The third is not: `createStapelClient`
 * throws `StapelApiError` for every non-2xx, and core's envelope parser finds
 * no `localizable_error` in `{"result":"denied","reason_key":"…"}`, so the
 * refusal would arrive as a generic `stapel.http.409` with the reason the
 * server took the trouble to name buried in `.body`.
 *
 * A denial is not a fault — it is the board's workflow answering. So the api
 * layer unwraps it back into a `MoveResponse` and the move machine branches on
 * one union with three arms instead of a try/catch that has to guess.
 * Everything else about that 409 (an ordinary `error.409.*` envelope, a 403, a
 * network fault) still throws.
 */
import { isStapelApiError } from "@stapel/core";
import { isMoveResult } from "./enums.js";
import type { MoveResponse } from "./types.js";

/** Is this parsed body a `MoveResponse` (and not the error envelope)? */
export function isMoveResponseBody(body: unknown): body is MoveResponse {
  if (typeof body !== "object" || body === null) return false;
  const result = (body as { result?: unknown }).result;
  return typeof result === "string" && isMoveResult(result);
}

/**
 * The `MoveResponse` inside a thrown 409, or `null` when the throw was
 * something else and must keep travelling.
 */
export function deniedMove(thrown: unknown): MoveResponse | null {
  if (!isStapelApiError(thrown)) return null;
  if (thrown.status !== 409) return null;
  return isMoveResponseBody(thrown.body) ? thrown.body : null;
}
