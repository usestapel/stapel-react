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
