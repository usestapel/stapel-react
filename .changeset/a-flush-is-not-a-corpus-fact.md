---
"@stapel/eslint-plugin": patch
---

`stapel/no-pinned-corpus-fact`: a flush buffer is not a corpus fact.

0.15.0's sweep reported five `pinnedCount` hits across a client fleet's walkers, and all five were the same false positive:

```js
let chunk = [];
for (const y of offsets) {
  chunk.push({ at: y, b64: await band() });
  if (chunk.length === 24) { foreign.push(...(await scanFrames(chunk))); chunk = []; }
}
```

24 is the batch size this code chose. Nothing reseeds it, and it cannot go stale — the shape is "send every N and start again", and the buffer is emptied in the branch the comparison guards. Telling its author to "resolve it from the corpus at run time" is nonsense, and a rule whose entire live output on its first run is nonsense is a rule that gets switched off before it ever catches the thing it was written for.

The rule now stays silent when the counted binding is emptied — `name = []` or `name.splice(0)` — inside the branch its own comparison guards, searched no further than the enclosing function. A count compared against a literal and then *not* reset is still reported, which is the `finalCount === 390` shape the rule exists for.

The corrected sweep over the same 799 files: **211 hits, 181 pinned ids and 30 pinned env defaults, and zero pinned counts.** Zero is the honest number rather than a weak one — the count defect was repaired in the probe that had it before this rule existed, so the rule stands as the net under that repair rather than as a finding about today.

Two tests pin the carve-out (the `= []` form and the `splice(0)` form) and the rule header and docs page carry the reasoning.
