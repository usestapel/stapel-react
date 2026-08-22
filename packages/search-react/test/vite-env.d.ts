/**
 * `import.meta.glob` — the Vite feature `test/demos.test.tsx` uses to
 * discover demos, declared narrowly here.
 *
 * The alternative is `"types": ["vite/client"]`, which needs `vite` as a
 * direct devDependency of this package; vite arrives only transitively
 * through vitest, so TS cannot resolve it. Sibling pairs sidestep the whole
 * question by type-checking `demo/` WITHOUT `test/` — which leaves their demo
 * suite unchecked. This declares exactly the one member we call and nothing
 * else, so it cannot drift into a stale copy of Vite's ambient types.
 */
interface ImportMeta {
  glob(
    pattern: string,
    options?: { eager?: boolean }
  ): Record<string, unknown>;
}
