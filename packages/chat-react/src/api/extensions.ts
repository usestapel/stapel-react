/**
 * Hand-authored API surface the codegen does not (yet) cover. Everything that
 * CAN be derived from schema.json belongs in the generated operations
 * (`api/chatApi.ts`), not here.
 *
 * ── One field the operation surface deliberately does NOT expose ────────────
 *
 * `CreateConversationRequest.scope_key` exists in the schema and its own
 * description says the rest: *"Ignored — the scope is resolved server-side
 * from the request"* (`views.ConversationListCreateView.post` calls
 * `get_scope_provider().resolve(request)` and never reads the field). A client
 * that sends a listing id there would believe it had scoped the thread to a
 * listing; the server would key the direct thread by the participant PAIR, as
 * it always does. Rather than ship a parameter that silently does nothing,
 * `createConversation` has no `scopeKey` argument at all — the listing context
 * belongs in the first MESSAGE, which is durable, visible, and actually read.
 */
export {};
