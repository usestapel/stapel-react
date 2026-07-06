/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "ключи неймспейснуты").
 * Everything under the `"billing"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 */
const ROOT = "billing" as const;

export const billingQueryKeys: {
  readonly all: readonly ["billing"];
  wallet(): readonly ["billing", "wallet"];
  transactions(cursor?: string): readonly ["billing", "transactions", string];
  catalog(): readonly ["billing", "catalog"];
  subscription(): readonly ["billing", "subscription"];
} = {
  all: [ROOT],
  wallet: () => [ROOT, "wallet"],
  transactions: (cursor = "") => [ROOT, "transactions", cursor],
  catalog: () => [ROOT, "catalog"],
  subscription: () => [ROOT, "subscription"],
};
