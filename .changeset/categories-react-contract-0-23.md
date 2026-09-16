---
"@stapel/categories-react": patch
---

Regenerated against **stapel-categories 0.23.1**: drf-spectacular's
enum-collision resolver merged `AxisRoleEnum` and `AxisRoleAuthoredE96Enum`
back into one `AxisRoleDerivedEnum` (identical five values — `make`,
`model`, `generation`, `year`, `mileage` — no behaviour change on the wire's
data). The declared backend contract moves to `>=0.23 <0.24` in
`manifest.json` and `llms.txt`.

Mechanical: no hand-written source in this package referenced either
removed enum name by value, so the rename reaches only the generated
`schema.ts`. One real type change rides along — `axis_role_derived` itself
moves from bare `string` to the enum ref, a genuine tightening (a value
outside the five now fails at the type level, where before any string
passed). `docs/errors.json` and `docs/flows.json` are byte-identical.
