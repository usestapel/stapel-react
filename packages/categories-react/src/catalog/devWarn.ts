/**
 * ONE dev-only warning for a call site that fell back from a PREFERRED field
 * to a legacy one — shared so the message and the environment check cannot
 * drift between the readers that share the fallback (`hasChildren`,
 * `categoryLiveChildCount`, `categoryChildIds`, `isWrapperAncestor`).
 *
 * Asked as "is it dev", never as "is it not production" — the second form
 * fails open: a browser bundle with no `process` shim leaves `NODE_ENV`
 * undefined, `undefined !== "production"` is true, and every production
 * console gets the warning. Same rule as `catalog/wrapper.ts`'s own
 * `inDevelopment` and `search-react/src/state/facets.ts`'s.
 */
declare const process: { readonly env: { readonly NODE_ENV?: string } };

function inDevelopment(): boolean {
  const env = typeof process === "undefined" ? undefined : process.env;
  return env?.NODE_ENV === "development" || env?.NODE_ENV === "test";
}

/**
 * Warn, in development only, that a row carried neither of a preferred pair
 * of fields and a reader fell back to a legacy one.
 */
export function warnLegacyFallback(preferred: string, legacy: string): void {
  if (!inDevelopment()) return;
  console.warn(
    `[@stapel/categories-react] falling back to "${legacy}": this row has no "${preferred}" (server predates stapel-categories 0.20.5). "${legacy}" counts soft-deleted/retired rows too and may overstate this row's real children.`
  );
}
