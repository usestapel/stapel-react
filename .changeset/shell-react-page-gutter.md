---
"@stapel/shell-react": patch
---

One left edge. The header, the content and the footer each hardcoded
`spacing[4]` for their side padding, so a page mounted inside the shell added
its own on top and a composed screen had a header at 16px, a page body at 40
and a footer at 16 — three left edges down one window. All three now read
`var(--stapel-page-gutter, 16px)`, the responsive token role
(`@stapel/tokens`): 4px on a phone, 8px on a tablet, 24px on a desktop, with
its own media arms, so it also reflows on resize instead of being recomputed
at the shell's next render. The fallback is the value the three boxes used
before, so a host that loads no stylesheet does not move. Block padding is
unchanged — how tall the chrome is remains the chrome's business.
