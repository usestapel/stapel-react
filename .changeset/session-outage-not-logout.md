---
"@stapel/core": patch
"@stapel/auth-react": patch
---

An unreachable backend no longer logs the user out.

Owner-reported live incident (2026-07-26, app.ironmemo.com mid-redeploy):
"сервак явно не отвечал, но фронт меня выкинул на sign-in page. Ну да, не
получилось отрефрешиться или auth/me вызвать, но это же не повод сессию
терминейтить, юзера не разлогинило, бэк прилёг."

A refresh had two outcomes — success, or "session lost" — so every way of
*not* getting an answer (fetch threw, DNS/TLS failed, the request timed out,
nginx answered 502/503/504 because the upstream was restarting, the service
5xx'd on its own crash) was filed under the same verdict as a clean 401, tore
the session down, ran the logout hooks, purged user-scoped storage and fired
the host's redirect-to-login policy. On a signed-in user whose credential was
perfectly valid.

Only the auth service can retire a credential, and only by answering. So
there is now a third outcome, `REFRESH_UNAVAILABLE`: no verdict was obtained,
the session is left exactly as it was, `refresh()` still resolves `false` (the
caller's request genuinely got no token and should surface its own error), and
`session:refresh-unavailable` is emitted for hosts that want an "offline /
reconnecting" affordance. The next attempt, once the backend is back, simply
succeeds. A `doRefresh` that *throws* is treated the same way — an exception is
not evidence a credential is dead, and the old behavior turned any bug in the
refresh path into a forced logout.

`@stapel/auth-react` classifies: 401/403 (and other 4xx that are genuine
rejections) are verdicts; transport failures, 5xx, 408 and 429 are not. 429
especially — being rate-limited is a "come back later", and logging the user
out over it is exactly backwards. The same rule now governs the token-adoption
path: a `me()` that never reached the server keeps the tokens instead of
discarding them. A COLD start against a dead backend still settles (quietly,
no banner) so nothing gated on `whenReady()` hangs.
