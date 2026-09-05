---
"@stapel/auth-react": patch
---

`refreshHandoffWindowMs` and `readSessionHint` reach core's session manager

Both options existed on `@stapel/core`'s `createSessionManager` and stopped at
this pair's constructor, which is the only thing that builds it — so a host that
had measured its own refresh latency, or that keeps its own non-httponly hint
that a session exists, could only fork the pair. They are now taken by
`createAuthSession` and `createAuthRuntime` and passed straight through; core
still owns both defaults, so a host that says nothing is unchanged.
