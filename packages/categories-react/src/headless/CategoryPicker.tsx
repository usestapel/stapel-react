import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  categoryBreadcrumbs,
  flattenCategoryNodes,
} from "../catalog/tree.js";
import type { CategoryNode } from "../catalog/tree.js";
import { categoryLabel, renderCategoryLabel } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
import { useCategoryCatalog } from "../model/queries.js";
import type { UseCategoryCatalogOptions } from "../model/queries.js";

/** One selectable option in the picker. */
export interface CategoryOption {
  readonly node: CategoryNode;
  readonly label: CategoryLabel;
  /** Root → this node, for a skin that shows the full path in the option. */
  readonly path: readonly CategoryLabel[];
  /** `true` when this node has no children — usually the only kind a listing
   * may be filed under. See `leavesOnly`. */
  readonly isLeaf: boolean;
}

export interface CategoryPickerBag {
  /**
   * The options at the current drill level, or the search matches while a
   * query is typed. `empty` is a real answer here — a leaf category has no
   * children, and a search can match nothing.
   */
  readonly state: LoadState<readonly CategoryOption[]>;
  /** Where the drill-down currently is: root → open node. */
  readonly path: readonly CategoryNode[];
  /** The selected node, or `null`. */
  readonly selected: CategoryNode | null;
  /** Blocked when nothing is selected, or when the selection is not a leaf
   * and `leavesOnly` is on. Carries the REASON — a disabled control that does
   * not say why is the thing `ActionAvailability` exists to prevent. */
  readonly submitBlockedReason: CategoryPickerBlockedReason | null;
  readonly query: string;
  setQuery(value: string): void;
  /** Descend into a node. A leaf selects instead of descending. */
  open(node: CategoryNode): void;
  /** Back up one level. */
  up(): void;
  select(node: CategoryNode | null): void;
  refetch(): void;
}

/** Why the picker will not hand a value back yet. */
export type CategoryPickerBlockedReason = "nothing_selected" | "not_a_leaf";

export interface CategoryPickerProps extends UseCategoryCatalogOptions {
  /** Controlled selection. */
  value?: number | null;
  onChange?: (id: number | null, node: CategoryNode | null) => void;
  /**
   * Only leaf categories are a valid answer. Default `true`: a listing filed
   * under "Electronics" instead of "Electronics › Phones › Used" inherits the
   * wrong feature set, and the compose form then asks the wrong questions.
   */
  leavesOnly?: boolean;
  /** Resolve a translation key to a caption, so SEARCH matches what the
   * person can read. Without it, search matches the key. */
  translate?: (key: string) => string;
  children: (bag: CategoryPickerBag) => ReactNode;
}

/**
 * The category chooser of the compose form, headless.
 *
 * Two modes over the SAME synced tree: drill-down (roots → children → …) and
 * a flat search. The search matches the RENDERED caption when a `translate` is
 * supplied and the raw key otherwise, which is the only honest behaviour for a
 * catalogue whose names are translation keys (`catalog/labels.ts`): a person
 * typing "phones" is typing what they see, not `category.phones`.
 *
 * Nothing here requests anything — the catalogue is already in memory.
 */
export function CategoryPicker(props: CategoryPickerProps): ReactNode {
  const {
    value,
    onChange,
    leavesOnly,
    translate,
    children,
    ...catalogOptions
  } = props;
  const requireLeaf = leavesOnly ?? true;

  const query = useCategoryCatalog(catalogOptions);
  const catalog = loadStateFromQuery(query);
  const index = catalog.status === "ready" ? catalog.data.index : null;

  const [openId, setOpenId] = useState<number | null>(null);
  const [text, setText] = useState("");

  const selected =
    index !== null && value !== null && value !== undefined
      ? (index.byId.get(value) ?? null)
      : null;

  const toOption = useMemo(
    () =>
      (node: CategoryNode): CategoryOption => ({
        node,
        label: categoryLabel(node.category),
        path: (index === null ? [] : categoryBreadcrumbs(index, node.id)).map(
          (crumb) => categoryLabel(crumb.category)
        ),
        isLeaf: node.children.length === 0,
      }),
    [index]
  );

  const options = useMemo<readonly CategoryOption[]>(() => {
    if (index === null) return [];
    const needle = text.trim().toLocaleLowerCase();
    if (needle !== "") {
      const caption = (node: CategoryNode): string => {
        const label = categoryLabel(node.category);
        return translate === undefined
          ? label.value
          : renderCategoryLabel(label, translate);
      };
      return flattenCategoryNodes(index.roots)
        .filter(
          (node) =>
            caption(node).toLocaleLowerCase().includes(needle) ||
            node.category.slug.toLocaleLowerCase().includes(needle)
        )
        .filter((node) => !requireLeaf || node.children.length === 0)
        .map(toOption);
    }
    const level =
      openId === null ? index.roots : (index.byId.get(openId)?.children ?? []);
    return level.map(toOption);
  }, [index, text, openId, requireLeaf, translate, toOption]);

  const blocked: CategoryPickerBlockedReason | null =
    selected === null
      ? "nothing_selected"
      : requireLeaf && selected.children.length > 0
        ? "not_a_leaf"
        : null;

  return children({
    state: mapLoad(catalog, () => options),
    path: index === null ? [] : categoryBreadcrumbs(index, openId),
    selected,
    submitBlockedReason: blocked,
    query: text,
    setQuery: setText,
    open: (node) => {
      if (node.children.length === 0) {
        onChange?.(node.id, node);
        return;
      }
      setOpenId(node.id);
    },
    up: () => {
      if (index === null || openId === null) return;
      setOpenId(index.byId.get(openId)?.category.tn_parent ?? null);
    },
    select: (node) => {
      onChange?.(node?.id ?? null, node);
    },
    refetch: () => {
      void query.refetch();
    },
  });
}
