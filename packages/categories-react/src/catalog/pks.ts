/**
 * django-treenode's ancestry columns, parsed.
 *
 * `tn_ancestors_pks`, `tn_children_pks`, `tn_descendants_pks` and
 * `tn_siblings_pks` are `TextField`s holding a COMMA-JOINED list of primary
 * keys (`treenode/utils.py`: `PKS_SEPARATOR = ","`, `join_pks`, `split_pks`),
 * and drf-spectacular therefore types them `string` in the schema. The spec
 * (§4.3) describes them as if they were arrays; on the wire they are `"1,7,12"`
 * and `""`.
 *
 * Root-first ordering is a property of how treenode writes the column
 * (`update_tree` walks down from the root), and the whole breadcrumb depends
 * on it — so it is asserted in `test/tree.test.ts` against a real fixture
 * rather than assumed here.
 */

/**
 * Parse a treenode pks column into numeric ids, root-first.
 *
 * Empty string → `[]` (a root has no ancestors; a leaf has no children).
 * Non-numeric fragments are dropped rather than turned into `NaN`: a `NaN`
 * silently fails every `===` against a real id, which reads as "the parent is
 * missing" — the same wrong answer, two hours later.
 */
export function parseTreenodePks(column: string | null | undefined): readonly number[] {
  if (column === null || column === undefined || column === "") return [];
  const out: number[] = [];
  for (const part of column.split(",")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const value = Number(trimmed);
    if (Number.isInteger(value)) out.push(value);
  }
  return out;
}
