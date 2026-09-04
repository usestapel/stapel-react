---
"@stapel/attributes-react": minor
---

`ref_select` carries `prefix`/`postfix` display affixes now (stapel-attributes 0.9.1), same semantics and translation convention as `int`/`float`: `formatFeatureValue` wraps the resolved term label(s) in them exactly like the numeric path, so a vocabulary-backed `Floor` level (`"3"`, `"9"`) reads "3 эт." instead of a bare "3". Both keys are translation keys, resolved through the host's catalogue. The `RefSelectEditor` shows the same wrapped string beside the picker's chosen value. `RefSelectConfig` gains a hand-declared `RefSelectAffixConfig` extension ahead of the next contract-pins regen.

`@stapel/listings-react` needs no change: its spec/card formatter (`model/featureText.ts`) only intercepts `int`/`float` and delegates everything else — `ref_select` included — to `formatFeatureValue`, so this lands there automatically on the next bump.
