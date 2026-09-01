/**
 * `<EmptyExits>` — the way out of a search that found nothing.
 *
 * ## What it replaces
 *
 * One sentence. "Nothing matches this search." — and then the page stopped:
 * fifteen filter chips above it, a location the person never chose, and no
 * control that widens anything. Measured on a live board where 2924
 * leaves out of 2924 were empty, that sentence was the terminal state of the
 * whole catalogue — and the two constraints most likely to have caused it (a
 * 25 km radius the page applied on its own, and the narrowest segment of the
 * category path) were exactly the two the person had never typed.
 *
 * ## The exits are derived, never invented
 *
 * Every button here is built out of state this pair already owns, and each
 * one removes exactly one constraint:
 *
 *  - **up a level** — drop the last segment of `category=`. The pair holds
 *    the path, so this needs no tree; what it cannot do is NAME the parent,
 *    which is why the label is "the level above" and not a guess.
 *  - **widen the radius** — multiply `geo.radiusKm`. Offered only when a
 *    radius is actually applied, because widening a search that was never
 *    narrowed is a button that changes nothing.
 *  - **search everywhere** — drop the geo constraint entirely. The single
 *    most likely culprit on this board: the SERP applied a default radius
 *    the category page did not, so the same category read 2 from the API and
 *    "0 listings, nothing found" on screen.
 *  - **drop one filter** — one button per applied facet slug and per applied
 *    range, labelled with the filter's own name. "The narrowest filter" is
 *    not a thing this pair can rank, so it does not pretend to: it offers
 *    every constraint separately and lets the person pick.
 *  - **clear everything** — the existing `search.facets.clear_all`, last,
 *    for the person who wants the catalogue back.
 *
 * ## Siblings come from the host
 *
 * "Show me the neighbouring sections, with their counts" is the exit a buyer
 * most wants and the one this package must not build: walking the tree is
 * `categories-react`'s job and the counts are the server's. So it is a SLOT
 * (`renderExtra`), rendered above the derived exits — the host that already
 * draws the category picker has the tree in hand, and a host that fills
 * nothing still gets every exit above.
 *
 * ## Nothing to offer is a valid answer
 *
 * A bare, unfiltered, uncentred search that finds nothing has no exit to
 * offer and this renders the sentence alone. A row of disabled buttons would
 * be worse than the sentence.
 */
import type { ReactElement, ReactNode } from "react";
import { Button, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import { featureName } from "@stapel/attributes-react";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/**
 * How much wider "widen the radius" makes it.
 *
 * Four, not two: doubling a 25 km radius covers four times the area and
 * usually still nothing on a thin board, so the person taps the same button
 * three times. Four times the radius is sixteen times the area — one tap
 * that visibly changes the answer, which is what makes it an exit rather
 * than a nudge.
 */
export const RADIUS_WIDEN_FACTOR = 4;

export interface EmptyExitsProps {
  /** The category schema, for naming an applied filter the way its chip does. */
  readonly categoryFeatures?: readonly FeatureDef[];
  /**
   * The host's own exits — sibling sections with their counts, most usefully.
   * Rendered first, above the derived ones.
   */
  readonly renderExtra?: () => ReactNode;
}

/** One exit, resolved to its label and the state change it performs. */
interface Exit {
  readonly id: string;
  readonly label: string;
  readonly apply: () => void;
}

/** The parent of a `root/leaf` path, or `undefined` at the root. */
export function parentCategory(category: string | undefined): string | undefined {
  if (category === undefined) return undefined;
  const parts = category.split("/").filter((part) => part.length > 0);
  if (parts.length <= 1) return undefined;
  return parts.slice(0, -1).join("/");
}

export function EmptyExits(props: EmptyExitsProps): ReactElement | null {
  const t = useT();
  const { state, setCategory, setGeo, setFilter, setRange, clearAll } =
    useSearchState();

  const bySlug = new Map<string, FeatureDef>();
  for (const feature of props.categoryFeatures ?? []) bySlug.set(feature.slug, feature);
  const nameOf = (slug: string): string => {
    const feature = bySlug.get(slug);
    return feature === undefined ? slug : t(featureName(feature));
  };

  const exits: Exit[] = [];

  const parent = parentCategory(state.category);
  if (parent !== undefined) {
    exits.push({
      id: "up",
      label: t(SEARCH_I18N_KEYS.emptyUpALevel),
      apply: () => {
        setCategory(parent);
      },
    });
  }

  const geo = state.geo;
  if (geo !== undefined && geo.kind === "center" && geo.radiusKm !== undefined) {
    const wider = Math.round(geo.radiusKm * RADIUS_WIDEN_FACTOR);
    exits.push({
      id: "widen",
      label: t(SEARCH_I18N_KEYS.emptyWidenRadius, { km: wider }),
      apply: () => {
        setGeo({ ...geo, radiusKm: wider });
      },
    });
  }
  if (geo !== undefined) {
    exits.push({
      id: "anywhere",
      label: t(SEARCH_I18N_KEYS.emptyAnywhere),
      apply: () => {
        setGeo(null);
      },
    });
  }

  for (const slug of Object.keys(state.filters)) {
    if ((state.filters[slug] ?? []).length === 0) continue;
    exits.push({
      id: `filter:${slug}`,
      label: t(SEARCH_I18N_KEYS.emptyDropFilter, { name: nameOf(slug) }),
      apply: () => {
        setFilter(slug, []);
      },
    });
  }
  for (const slug of Object.keys(state.ranges)) {
    exits.push({
      id: `range:${slug}`,
      label: t(SEARCH_I18N_KEYS.emptyDropFilter, { name: nameOf(slug) }),
      apply: () => {
        setRange(slug, null);
      },
    });
  }

  if (exits.length > 1) {
    exits.push({
      id: "clear",
      label: t(SEARCH_I18N_KEYS.facetsClearAll, { count: exits.length }),
      apply: clearAll,
    });
  }

  const extra = props.renderExtra?.();
  if (exits.length === 0 && extra === undefined) return null;

  return (
    <Flex
      vertical
      gap={spacing[3]}
      data-testid="search-empty-exits"
      style={{ marginBlockStart: spacing[4] }}
    >
      {extra}
      {exits.length > 0 && (
        <Flex vertical gap={spacing[2]}>
          <Typography.Text type="secondary">
            {t(SEARCH_I18N_KEYS.emptyExitsTitle)}
          </Typography.Text>
          <Flex wrap gap={spacing[2]}>
            {exits.map((exit) => (
              <Button
                key={exit.id}
                data-testid={`search-empty-exit-${exit.id}`}
                data-analytics="none"
                data-analytics-reason="widening a search is a read, not a flow step"
                onClick={exit.apply}
              >
                {exit.label}
              </Button>
            ))}
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}
