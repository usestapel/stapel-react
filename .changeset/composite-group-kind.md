---
"@stapel/attributes-react": minor
"@stapel/listings-react": patch
---

The composite `group` kind — a bordered, repeatable subform.

stapel-attributes 0.6.0 registers a thirteenth builtin type: one feature
holding a small TABLE. Its value is a list of rows keyed by child slug, and its
`config.fields` are full feature definitions of the ordinary kinds — which is
the shape 2 468 fields of the Avito autoload corpus carry (a discount ladder is
"from N units, M % off", up to five steps) and that no other kind could hold.

**attributes-react**

- `GroupEditor` in `BUILTIN_VALUE_EDITORS`: one bordered box per row, the
  children as cells, add and remove controls honouring `repeat.min`/`max`. A
  cell is drawn by its child's OWN editor through the same resolution ladder a
  top-level row uses, so a host's registered editor is used inside a group too,
  and a kind that reaches the loud notice at the top level reaches it in a cell.
  `repeat: null` is a single-row group: no add, no remove, no row numbers.
  Phone and desktop come from the column's measured width (`useTouchFloor`),
  not a viewport query — the add/remove controls take the 44px floor in a
  narrow composer column on a full desktop.
- `props.id` lands on the CONTAINER, as `role="group"`. A composite has no
  primary control, and putting the row's id on the first cell would give that
  one `int` two labels and make the row's label read as a question about it.
- The mirror (`validateFeatureValue`) judges the row count against `repeat` and
  then every cell through its child's own rule. The refusal that comes back is
  the CHILD's own code — `above_maximum` for a discount over 30 % — because the
  engine adds no error vocabulary for a group and neither does the mirror.
- `formatFeatureValue` reads a stored table: each cell through its child's type,
  cells joined by `", "` and rows by `"; "`, with the stored `name` winning over
  the config's and a cell the config no longer declares keeping its raw value.
- `GroupConfig` / `GroupRepeat` are generated from the §68 canon
  (`docs/feature-def.schema.json`), not hand-written, and re-exported from the
  main entry. Three i18n keys (`attributes.group.row` / `.add_row` /
  `.remove_row`) in en, ru and es.
- Nothing here recurses: a child of type `group` is a refused config upstream
  (nesting depth is 1) and simply resolves to the notice here, and a child
  carrying `rules` is refused upstream too — so there is no per-row rule pre-pass
  and no `narrowConfig` inside a cell.

**listings-react**

No composer code changed, which is the claim: the bag holds a value keyed by
slug whatever its shape, `<FeatureFields>` resolves the editor, and the mirror
judges the rows. `test/composerRules.test.tsx` now pins that — a composite draws
with the builtins, an empty mandatory one blocks the publish, a cell outside its
child's bounds blocks it, and the table reaches the wire under the group's own
slug. The `@stapel/attributes-react` peer floor moves to `>=0.5.0`, the release
that can draw one.
