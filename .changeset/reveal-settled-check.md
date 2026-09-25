---
"@stapel/core": patch
---

`reveal` re-checks the landing after the page settles, whether or not it scrolled: a row the form pushed under a bar after it was measured (a dependent row filling in) is corrected. A person who scrolled away in the meantime is never fought.
