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

Transitional note: while a backend's contract commits exist only locally
(not yet pushed/tagged), the pin records the sibling's local HEAD sha.
GitHub-side CI can only resolve such a sha after the backend push wave
lands — a checkout failure before that is expected, not a regression.

## Code rules (short version)

- TS strict + `isolatedDeclarations`; no `any` in public API.
- React 19; hooks discipline enforced by eslint-plugin-react-hooks (strict);
  no index keys; user-facing strings are i18n keys, never literals.
- Tokens, not values: no raw colors/px outside `@stapel/tokens`.
- Tests: vitest + testing-library; API interactions mocked with MSW.
