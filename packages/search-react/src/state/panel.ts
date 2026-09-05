/**
 * ONE panel, not two halves of one — the order a filter rail draws its facet
 * groups and its numeric axes in.
 *
 * ── The defect this closes ────────────────────────────────────────────────
 *
 * The rail drew three blocks in a fixed sequence: the CORE ranges (price),
 * then every facet group, then every attribute range. That sequence is a
 * client's opinion about a catalogue it has never read, and on a live cars
 * leaf it put "Year" — a measurement the category authors second,
 * right after the make — below forty checkbox groups, while "Price" sat above
 * a make picker the schema puts first. A host asking for
 * `partition → make → price → year` could pin the two GROUPS and had no way
 * to say where the two RANGES went, because the two halves were ordered by
 * different code and never compared.
 *
 * stapel-search 0.16.0 ends the argument by numbering both halves in ONE
 * sequence: `facet_labels[<slug>].order` and `facet_meta.ranges[<slug>].order`
 * are the same integer scale, assigned by the plan — core ranges first (they
 * address a column every document in every corpus has), then the category's
 * own schema order, mandatory first. Sorting both halves by that one key is
 * all this module does.
 *
 * ── What happens when nobody numbered anything ────────────────────────────
 *
 * An older server states no `order` at all, and a row built from the CATEGORY
 * SCHEMA alone never has one however new the server is. Those items keep the
 * band order this pair has always used — core ranges, then the groups in the
 * order the caller handed them (which is `orderFacetGroupsBySchema`'s), then
 * the remaining measurements — and sit AFTER everything the plan did number,
 * because a stated position is evidence and an assumed one is not.
 *
 * `pinned` outranks both. It is the host saying "this page is about make",
 * and a page that has decided what it is about is not overruled by the
 * category's own idea of a reading order.
 */
import type { FacetGroup } from "./facets.js";
import type { RangeGroup } from "./ranges.js";

/** One row of the panel: a bucket list, or a from/to picker. */
export type PanelItem =
  | { readonly kind: "group"; readonly slug: string; readonly group: FacetGroup }
  | { readonly kind: "range"; readonly slug: string; readonly range: RangeGroup };

export interface OrderPanelItemsInput {
  /**
   * The facet groups, already filtered to what is drawable and ordered the
   * way the rail wants them — `orderFacetGroupsBySchema`'s output. Their
   * relative order is preserved for every group the plan did not number.
   */
  readonly groups: readonly FacetGroup[];
  /** The range rows, `buildRangeGroups`' output. */
  readonly ranges: readonly RangeGroup[];
  /**
   * Slugs pinned above everything, in the order given — the axis a page has
   * already decided is its subject. A slug matches whichever half carries it,
   * so `["make", "price", "year"]` is one sequence over both.
   */
  readonly pinned?: readonly string[];
}

/**
 * The panel's rows, in the one order they are read in.
 *
 * Three bands, and every one of them is stable — equal-ranked items keep the
 * order they arrived in, so nothing reshuffles under a click:
 *
 *  1. `pinned`, in the order given.
 *  2. everything the ANSWER numbered (`order`), ascending. Both halves share
 *     the scale, so a group and a range can interleave inside it.
 *  3. everything nobody numbered: core ranges, then groups, then attribute
 *     ranges — the band order the rail shipped with, kept for exactly the case
 *     it was invented for (a server or a row with no stated position).
 */
export function orderPanelItems(
  input: OrderPanelItemsInput
): readonly PanelItem[] {
  const items: PanelItem[] = [
    ...input.groups.map(
      (group): PanelItem => ({ kind: "group", slug: group.slug, group })
    ),
    ...input.ranges.map(
      (range): PanelItem => ({ kind: "range", slug: range.slug, range })
    ),
  ];

  const pinnedIndex = new Map<string, number>();
  (input.pinned ?? []).forEach((slug, index) => {
    if (!pinnedIndex.has(slug)) pinnedIndex.set(slug, index);
  });

  const stated = (item: PanelItem): number | undefined =>
    item.kind === "range" ? item.range.order : orderOf(item.group);

  // The fallback band's own three tiers. A core axis first for the reason it
  // has always been first: on a phones leaf every attribute range is parcel
  // logistics and the one number a buyer narrows by is the price.
  const fallbackTier = (item: PanelItem): number => {
    if (item.kind === "range") return item.range.core ? 0 : 2;
    return 1;
  };

  const decorated = items.map((item, index) => ({ item, index }));
  decorated.sort((a, b) => {
    const pinA = pinnedIndex.get(a.item.slug);
    const pinB = pinnedIndex.get(b.item.slug);
    if (pinA !== undefined || pinB !== undefined) {
      if (pinA === undefined) return 1;
      if (pinB === undefined) return -1;
      if (pinA !== pinB) return pinA - pinB;
      return a.index - b.index;
    }
    const orderA = stated(a.item);
    const orderB = stated(b.item);
    if (orderA !== undefined || orderB !== undefined) {
      // A stated position beats an assumed one, so the unnumbered tail follows
      // the plan rather than being interleaved into it by a guess.
      if (orderA === undefined) return 1;
      if (orderB === undefined) return -1;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    }
    const tier = fallbackTier(a.item) - fallbackTier(b.item);
    if (tier !== 0) return tier;
    return a.index - b.index;
  });
  return decorated.map((entry) => entry.item);
}

/**
 * A group's stated position, or `undefined`.
 *
 * `null` is the server's own "the plan has no place for this group" and reads
 * exactly like an absent field — both mean "sort me with the rest".
 */
function orderOf(group: FacetGroup): number | undefined {
  return typeof group.order === "number" ? group.order : undefined;
}
