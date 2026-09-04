---
"@stapel/attributes-react": minor
---

`ref_select` carries `prefix`/`postfix` display affixes now (stapel-attributes 0.9.1), same semantics and translation convention as `int`/`float`: `formatFeatureValue` wraps the resolved term label(s) in them exactly like the numeric path, so a vocabulary-backed `Floor` level (`"3"`, `"9"`) reads "3 эт." instead of a bare "3". Both keys are translation keys, resolved through the host's catalogue. The `RefSelectEditor` shows the same wrapped string beside the picker's chosen value. The contract pin moves to stapel-attributes v0.9.1 in the same train, so `RefSelectConfig` carries `prefix`/`postfix` in the GENERATED `featureDef.ts` — the hand-declared `RefSelectAffixConfig` extension that stood in ahead of the regen is removed, and the type is no longer exported (it never reached npm).

`@stapel/listings-react` needs no change: its spec/card formatter (`model/featureText.ts`) only intercepts `int`/`float` and delegates everything else — `ref_select` included — to `formatFeatureValue`, so this lands there automatically on the next bump.
