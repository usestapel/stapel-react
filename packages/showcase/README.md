# @stapel/showcase

The design-system **demo format** for Stapel (frontend-guardrails §4). Ships
`defineDemo` — a literal, statically-extractable registration — plus the render
helper the generated stories and smoke tests share.

The viewer is a commodity; the **format is ours**. One `defineDemo` feeds four
projections that can't drift from the component:

- `manifest.demos` + canonical `llms.txt` snippets (`gen:manifest`)
- generated CSF stories for the viewer (`gen:demos`, rendered by Ladle)
- the **completeness gate**: every exported headless component must have ≥1 demo
  or CI is red (`gen:demos`)
- smoke render tests (demos are first-class code: compiled, linted, rendered)

```tsx
// packages/auth-react/demo/PasswordlessLogin.demo.tsx
import { defineDemo } from "@stapel/showcase";
import { PasswordlessLogin } from "../src/index.js";

export default defineDemo({
  id: "auth.passwordless-login",
  title: "Passwordless login (OTP)",
  description: "Headless email → code → session; render-prop bag per step.",
  component: PasswordlessLogin,
  flow: "auth.otp",
  tokens: ["background-primary", "accent"],
  decorator: (children) => <AuthDemoHarness>{children}</AuthDemoHarness>,
  variants: {
    default: { render: () => <OtpDemo /> },
  },
});
```

Per-repo showcases and the future aggregate site (`design.stapel.dev`) both read
`manifest.demos`, so demos aggregate across packages without a second format.

Run the workspace showcase: `pnpm showcase` (from the stapel-react root).

## Introspection gating (§5)

The showcase is an **introspection surface**, not a product surface. It stays out
of every production bundle *by construction* — a separate entry point
(`@stapel/showcase-viewer`), never imported by a pair; `@stapel/showcase` is a
**devDependency only** and `demo/` is excluded from a pair's published tarball
(enforced by `packages/auth-react/test/prodBundlePurity.test.ts`).

Whether the showcase artifact is **built and deployed** for an environment is
gated by `STAPEL_INTROSPECTION` — the frontend mirror of the backend's
`get_dev_urls()`: explicit `STAPEL_INTROSPECTION=1|0` wins, else it follows
`DJANGO_ENV` (on for `local`/`dev`, off otherwise), else off. `pnpm showcase:build`
runs through this gate (`scripts/introspection-gate.mjs`) and, when on, minifies
(Vite) and Brotli/gzip-precompresses the output for `nginx brotli_static`.

Deploy recipe (nginx basic-auth + `brotli_static`, CI wiring, full convention
table): [`docs/deploy-introspection.md`](../../docs/deploy-introspection.md).

## The distinctness guards (§4.2)

A demo declares variants because the **states** differ. Two guards check that
claim by rendering, because the closures that collide differ textually
(`<D deduped={false}/>` vs `<D deduped/>`) and a static check passes them.

**`assertVariantsRenderDistinctly(demo, render)`** — the FIRST frame. Renders
every variant to markup (`renderToStaticMarkup`) and fails when two are
byte-identical: a variant that was never seeded at all. Variants with a `play`
step are skipped (their first frame is legitimately a sibling's).

**`assertVariantsSettleDistinctly(demo, { render, settle })`** — the frame a
person actually sees. Mounts each variant in a live DOM, waits for the mount's
async work, then asks what the static pass cannot: (a) no variant landed on an
**error or empty arm** it never declared, (b) the variants are still pairwise
**distinct**, (c) nothing reached **`console.error`** while it settled.

It exists because a screen can mount correctly and then erase itself: React runs
the effects, the query client refetches a seed it considers stale
(`staleTime: 0`, `refetchQueries`), the demo's catch-all mock answers `200 {}`,
and every variant collapses onto the same error or empty card — with the static
guard green the whole time. Both `chat-react` (three thread variants on the
error card, three inbox variants on the empty card) and `forms-react`
(`forms-list`, `responses`, `public-form` photographing a blank page) hit this
independently before the check was shared.

```tsx
import { render } from "@testing-library/react";
import { assertVariantsSettleDistinctly } from "@stapel/showcase";

it(`every variant of ${demo.id} is still itself once mounted`, async () => {
  const mount = (el) => { const v = render(el); return { container: v.container, unmount: () => v.unmount() }; };
  await assertVariantsSettleDistinctly(demo, { render: mount });
});
```

- `render` (required) mounts one variant and hands back `{ container, unmount }`
  — the package owns no renderer, so it still pulls in no react-dom.
- `settle` (optional) defaults to two macrotask turns inside React's `act`: one
  for the refetch a mount effect starts, one for the render its answer causes.
  Pass a poll-until-quiescent settler for a mock with a deliberate delay
  (wrap the wait in `act`, or React's own act warning becomes finding (c)).
- A variant with a `play` step gets **settle → play → settle** and IS compared,
  so the state the step reaches has to be its own screen.
- An arm is recognised from the substrate's stamps (`data-stapel-error`,
  `data-stapel-empty`, `role="alert"`) or an empty container; it is *declared*
  by the variant's `step` (or its id) naming it — `step: "error"`,
  `step: "empty"`, a variant id of `no-results`. A demo OF the error state is
  legitimate; a demo that fell into it is the defect.
- `settleVariants(demo, options)` returns the raw per-variant record
  (`markup`, `arms`, `declaredArms`, `consoleErrors`) for a custom report.
