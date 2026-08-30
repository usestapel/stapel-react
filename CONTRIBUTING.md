# Contributing to stapel-react

## Workflow

- **Conventional commits** (`feat(core): …`, `fix(tokens): …`, `chore: …`).
- **Changesets** for anything user-visible: run `corepack pnpm changeset`,
  pick the affected packages and semver bump, commit the generated file.
  Releases are `changeset version` + `changeset publish`.
- CI gate: `corepack pnpm run ci` (turbo lint → test → build) must be green.

## Ownership boundary: the package

Per frontend-standard §7, the unit of contribution and ownership is a single
package (`packages/<name>`). A contribution PR must keep its diff strictly
within one package directory; cross-package changes are maintainer work and
land as separate atomic commits.

Two invariants every package must keep (CI-gated):

1. **Standalone-buildable** — no workspace-relative imports, self-contained
   `tsconfig.json`, builds without root tooling (`cd packages/<name> && pnpm
   build`).
2. **Sources in tarball** — `files` includes `src/`, so consumers can eject a
   package into an editable vendor directory from the npm artifact alone.

## Contract pins

CI and the release workflow regenerate this repo's committed projections
(schema types, flow registries, error maps, manifests) from the sibling
backend repos' committed contract artifacts — `docs/schema.json`,
`docs/flows.json`, `docs/errors.json` (+ `pyproject.toml` for the backend
version pin). Those sibling checkouts are **pinned to immutable refs** in
[`contract-pins.json`](./contract-pins.json) at the repo root; both
`ci.yml` and `release.yml` read that file, so it is the single place a pin
lives. Never float a checkout on `main` — a moving contract source makes CI
non-reproducible and lets a backend push silently break this repo's gate.

Bumping a pin is a **deliberate PR**, made after the backend releases a new
contract:

1. In the backend repo, identify the release tag (preferred) or commit sha
   that contains the new committed `docs/{schema,flows,errors}.json`.
2. Update that module's `ref` (and `note`) in `contract-pins.json`.
3. Locally, check the sibling clone out at that ref and run
   `corepack pnpm gen` to regenerate the projections; commit the pin bump
   together with the regenerated files (one atomic PR — `gen:check` gates
   that they match).
4. CI proves the pair regenerates cleanly from exactly the pinned contract.

**Regenerating locally.** `pnpm gen` reads the sibling checkouts as they
are — normally *ahead* of the pins, which silently bakes an unreleased
contract into a committed projection. Commit 3a6211a exists for exactly that
reason: a version bump regenerated `auth-react`'s manifest from an
ahead-of-pin `pyproject.toml` and emitted `contract ">=0.13 <0.14"` where the
pin said `>=0.12 <0.13`, and nothing noticed until CI failed the release. So
use the pinned variants, which materialize each sibling at its pinned ref in
a throwaway git worktree, run the generators against those, and clean up:

```
pnpm gen:pinned              # regenerate from the pins
pnpm gen:pinned:check        # what CI will say, before you push
pnpm run version-packages:local   # changeset version + pinned regen
```

Every generator resolves its sources under `${SIBLING_ROOT:-..}`, so nothing
special happens in CI (the variable is unset there and the checked-out
siblings *are* the pins).

Transitional note: while a backend's contract commits exist only locally
(not yet pushed/tagged), the pin records the sibling's local HEAD sha.
GitHub-side CI can only resolve such a sha after the backend push wave
lands — a checkout failure before that is expected, not a regression.

**Pin freshness.** `pnpm check:gates` compares each pin's `pyproject`
version against the sibling's newest `v*` release tag: one minor behind is
listed (a deliberate hold, or the next bump), two or more fails. It needs the
tag list, and CI builds each sibling with `git init` + `fetch --depth 1 <sha>`,
which brings down no tags at all — so from 2026-08-31 the check falls back to
`git ls-remote --tags` on the checkout's origin when the local list is empty
(ref names only, one round trip, no objects). A sibling with neither local
tags nor a reachable origin now **fails as BLIND** rather than passing: before
the fallback existed, the freshness half of this gate silently reported
nothing on every CI and release run.

## Publishing a pair for the FIRST time

Releases are tokenless: npm **OIDC trusted publishing**, configured per package
against this repo + `release.yml`. A trusted publisher can only be configured
for a package that already exists on the registry, and OIDC cannot create one —
so the very first publish of a NEW package fails, every time, with:

```
error an error occurred while publishing @stapel/<name>: E404 undefined
  "message": "404 Not Found - PUT https://registry.npmjs.org/@stapel%2f<name> - Not found"
```

That is the documented bootstrap case (see the header comment in
`.github/workflows/release.yml`), not a broken pipeline: every already-published
sibling in the same run reports "already published" and only the new package
fails. Confirm with `curl -o /dev/null -w '%{http_code}' https://registry.npmjs.org/@stapel%2f<name>`
— a 404 means the package has never existed.

Closing it takes a person with npm write access on the `@stapel` org, once per
package:

1. `npm login` (the CI has no credentials that can create a package, by design).
2. From the package directory, with the version already bumped and committed:
   ```
   pnpm -r --filter @stapel/<name> publish --access public
   ```
3. On npmjs.com, add a **trusted publisher** for the new package pointing at
   `usestapel/stapel-react` + `release.yml`.
4. Re-run the failed Release workflow, or let the next push to `main` publish
   normally. Every subsequent release is tokenless.

Until step 3 is done the package publishes only by hand, so do not skip it.

## Code rules (short version)

- TS strict + `isolatedDeclarations`; no `any` in public API.
- React 19; hooks discipline enforced by eslint-plugin-react-hooks (strict);
  no index keys; user-facing strings are i18n keys, never literals.
- Tokens, not values: no raw colors/px outside `@stapel/tokens`.
- Tests: vitest + testing-library; API interactions mocked with MSW.

## Mock the wire, not the module

**A test that hand-shapes the value under test cannot disprove the assumption
that produced the bug** — the author of the mock holds the same wrong belief as
the author of the code, so the suite goes green against a shape production
never sends. This is the frontend twin of the backend disease where tests walk
paths that do not exist in prod.

The class this rule comes from: a thrown value reaches a call site in one of
two dialects — `StapelApiError` (`@stapel/core`'s client — has `.status`) or
the RAW envelope `{localizable_error, error, params}` (the parsed response
BODY, rethrown by any second transport — has NO `.status`). A component
discriminated states with `(e as { status?: number })?.status === 404`, which
on dialect 2 is a branch that can never be true; every unit test mocking
`{ status: 404 }` passed, and users were told "the AI found nothing" about a
meeting nobody had analysed.

So, for anything that inspects an error, a response, or any other value that
crosses the network boundary:

- **Do** intercept at the HTTP layer (MSW, or a stubbed `fetch` returning a
  real `Response`) with the **real body the backend sends**, and let the
  **real transport** produce the value the code catches. See
  `packages/core/test/query.test.ts` → "default retry predicate", which drives
  a real 404 envelope through a second-transport `if (!response.ok) throw
  body` and asserts the caught value has no `.status` at all.
- **Don't** `vi.mock` the api module, and don't construct the caught value by
  hand (`{ status: 404 }`, `new StapelApiError({…})`) as the *only* coverage of
  a discrimination. A hand-built value is fine as an EXTRA case; it is never
  the case that proves the branch fires in production.
- Guard/fold helpers (`isStapelApiError`, `hasErrorCode`, `errorCodePredicate`,
  `toStapelApiError` — `@stapel/core`, `errors.ts` "One dialect") may be
  unit-tested against literal envelopes: there the envelope IS the input under
  test, not a stand-in for the wire.

`stapel/no-raw-error-shape` enforces the code side of this; the mocking
discipline above is the part lint cannot see.
