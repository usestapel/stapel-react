---
"@stapel/recordings-react": patch
---

`/upload` on a slow link: a part attempt that moved real bytes before the store or a proxy gave up no longer spends the retry budget (a part still stops after `attempts × 4` tries); a part that runs out of retries stops new parts but lets the ones already on the wire finish, so a resume sends fewer; and after a transient part failure the upload continues one part at a time.
