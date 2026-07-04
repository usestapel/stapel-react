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

## Code rules (short version)

- TS strict + `isolatedDeclarations`; no `any` in public API.
- React 19; hooks discipline enforced by eslint-plugin-react-hooks (strict);
  no index keys; user-facing strings are i18n keys, never literals.
- Tokens, not values: no raw colors/px outside `@stapel/tokens`.
- Tests: vitest + testing-library; API interactions mocked with MSW.
