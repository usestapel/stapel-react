---
"@stapel/shell-react": minor
---

`<PublicShell/>` draws the host's own brand and legal line.

Two new `/default` components, and two defaults that use them:

- `<SiteBrand linkComponent? homeHref?/>` — the logo (`alt=""`, because the
  name is rendered as text beside it) and the name from `useSite()`, wrapped
  in a link home. A brand with no logo is a text wordmark rather than a hole
  in the header. `linkComponent` takes core's router-agnostic `LinkComponent`;
  omitted, the react-router `<Link>` this entry point already depends on is
  used.
- `<SiteLegalFooter>{children}</SiteLegalFooter>` — the operating company, a
  `mailto:` for the support mailbox, and the privacy/terms links THIS host is
  bound by, which on a second domain is a different company from the first.
  It renders the four keys the fleet ships and ignores any others rather than
  guessing a label for a key it has never seen; `children` is where a host
  puts its own footer nodes beside them.

`<PublicShell/>` now fills `brand` with `<SiteBrand/>` and `footer` with
`<SiteLegalFooter/>` when the host passes neither — but ONLY below a
`<SiteProvider>`. It reads the seam through core's `useOptionalSite()`, so a
host that mounts no provider gets exactly the previous behaviour instead of a
crash: a brand slot is the last thing that should be able to take a storefront
down.

Three new chrome strings in en/ru/es: `shell.legal.privacy`,
`shell.legal.terms`, `shell.legal.support`. The sentences on that line are the
deployment's and arrive on the wire; only the link words are the shell's.

The `@stapel/core` peer floor rises to `>=0.20.0` — `useOptionalSite` ships
there.
