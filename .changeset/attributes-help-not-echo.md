---
"@stapel/attributes-react": patch
---

A field's help line no longer echoes its own label (D54).

An imported catalogue stamps `description == name` on nearly every field, so
`<FeatureFields>` drew a grey restatement of the label under every box
("Producer … Producer", "SIM cards … SIM cards") — on a live classified that
is a third of a phone screen of noise per step, editor included. The
description is compared to the label RESOLVED (both members are
key-or-literal, either may be the catalogue key of the other's text) and is
not drawn when it says nothing new. A genuine sentence is untouched.
