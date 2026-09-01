/**
 * "Is this thrown value 'the optional peer is not installed'?" — shared by the
 * two lazy editor engines (`./codemirror`, `./milkdown`).
 *
 * An OPTIONAL peer that is absent must produce a designed screen, not a stack
 * trace: the fleet precedent is `@stapel/video-react`'s `CallStage`, which
 * loads `livekit-client` with `import()` and renders a sentence naming the
 * package when the import fails. The same discipline, one copy, because two
 * engines now need it.
 *
 * Bundlers and runtimes each phrase the failure differently (Node's
 * `ERR_MODULE_NOT_FOUND`, Vite's "Failed to resolve import", webpack's "Cannot
 * find module"); all of them name the specifier, so the match is
 * "mentions one of ours" AND "reads like a resolution failure". Anything else
 * is a REAL error from inside the package and must not be swallowed as
 * "not installed" — a package that is present and broken is a different fact
 * with a different remedy.
 */

/** Does `thrown` say that one of `specifiers` could not be resolved? */
export function isOptionalPeerMissing(
  thrown: unknown,
  specifiers: readonly string[]
): boolean {
  const code = (thrown as { code?: unknown } | null)?.code;
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true;
  const message = thrown instanceof Error ? thrown.message : String(thrown ?? "");
  if (!specifiers.some((specifier) => message.includes(specifier))) return false;
  return /cannot find|not resolve|failed to resolve|not found|does not provide/i.test(
    message
  );
}

/**
 * Import a specifier held in a `string`-typed binding.
 *
 * The indirection is load-bearing, not style: with a LITERAL specifier
 * TypeScript resolves the module at compile time, and an optional peer is
 * exactly the package that may not be installed — `tsc -p tsconfig.json` would
 * fail on a build machine that never installed it, which is the opposite of
 * "optional". Typed as `string`, the import stays dynamic to the compiler and
 * to every bundler, so nothing lands in the importing chunk either.
 */
export function importOptionalPeer(specifier: string): Promise<unknown> {
  return import(specifier);
}
