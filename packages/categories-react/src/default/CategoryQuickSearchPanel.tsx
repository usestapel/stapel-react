/**
 * `<CategoryQuickSearchPanel>` — the category landing's quick-search panel: a
 * brand-tinted block with a heading, one or two field slots the host composes,
 * and a full-width button whose label carries the live result count.
 *
 * ── Why this package, and why it knows nothing about search ────────────────
 *
 * The panel belongs to a CATEGORY landing — it is the thing a category page
 * puts under its subcategory tiles — so it lives with the category chrome. But
 * a category package that imported a search package to draw two selects would
 * make every host of the catalogue carry the search client, and would decide,
 * for every deployment, which facets a category's quick search asks about.
 * Neither is this package's call. So the fields are a SLOT (`fields`) and the
 * count is a VALUE (`count`), both supplied by the container that already owns
 * both halves.
 *
 * ── The count is a load state, not a number ────────────────────────────────
 *
 * `count` is core's `LoadState`, the fleet's one shape for "we are asking /
 * we could not ask / here it is", and its ready value is the pair of fields
 * `@stapel/search-react`'s `useSearchCount()` returns — deliberately the same
 * field names, so a host wires the two together with no adapter and no import
 * edge between the packages:
 *
 * ```tsx
 * <CategoryQuickSearchPanel heading={…} count={useSearchCount(state)} … />
 * ```
 *
 * Three of the four arms say the same thing, and they say it by SUBTRACTION:
 * loading, failed, and a ready count the engine declined to give a number for
 * all render the plain "Show listings". A button that guesses at a total, or
 * that says "0" because a count was `null`, is the defect the count contract
 * exists to prevent — and a person can press "Show listings" perfectly well
 * without knowing the number first. A LOWER BOUND gets its own sentence
 * ("Show {n}+ listings"), because a floor rendered as a total is the same lie
 * in a shorter form.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Button, Typography } from "antd";
import { cssVar, radii, spacing } from "@stapel/tokens-antd";
import { useT, useTPlural } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { CATEGORIES_I18N_KEYS } from "../i18n/keys.js";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { ThemeModeProp } from "./types.js";

/**
 * How a count may be spoken. The same three words `@stapel/search-react`'s
 * `SearchCountKind` uses — restated rather than imported, because a category
 * package must not depend on a search package (see this file's header), and
 * spelled identically so the two values are interchangeable.
 */
export type QuickSearchCountKind = "exact" | "at_least" | "unknown";

/** The ready value of {@link CategoryQuickSearchPanelProps.count}. */
export interface QuickSearchCount {
  /** `null` is "the engine cannot say" — never rendered, and never as `0`. */
  readonly count: number | null;
  readonly kind: QuickSearchCountKind;
}

interface CategoryQuickSearchPanelBaseProps extends ThemeModeProp {
  /** The panel's own line — "Find a car". Copy belongs to the deployment, so
   * it arrives already translated. */
  readonly heading: ReactNode;
  /**
   * The one or two controls this quick search asks about, composed by the
   * host out of the category's own facets. Absent is legitimate: a category
   * whose quick search is just "show me everything under here" is a heading
   * and a button.
   */
  readonly fields?: ReactNode;
  /** The live result count for whatever the fields currently say. Absent, or
   * any arm but a ready countable number, renders the uncounted label. */
  readonly count?: LoadState<QuickSearchCount>;
  readonly testId?: string;
}

/**
 * The call to action needs somewhere to go: a href, a handler, or both (a
 * router host passes both — the href is what a middle-click and a crawler
 * read, the handler is what keeps the click inside the app). A panel with a
 * button that does nothing is not a state this component can be put into.
 */
export type CategoryQuickSearchPanelProps = CategoryQuickSearchPanelBaseProps &
  (
    | { readonly ctaHref: string; readonly onSubmit?: () => void }
    | { readonly ctaHref?: string; readonly onSubmit: () => void }
  );

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[3],
  padding: spacing[4],
  borderRadius: radii.lg,
  background: cssVar("brand-subtle"),
};

const fieldsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[2],
};

export function CategoryQuickSearchPanel(
  props: CategoryQuickSearchPanelProps
): ReactElement {
  const t = useT();
  const tPlural = useTPlural();
  const count = props.count;

  // Only a READY, countable answer earns a number in the label — see the
  // header. Everything else is the plain sentence, which is true under every
  // arm rather than approximately true under one.
  const label =
    count === undefined ||
    count.status !== "ready" ||
    count.data.count === null ||
    count.data.kind === "unknown"
      ? t(CATEGORIES_I18N_KEYS.quickSearchCta)
      : count.data.kind === "at_least"
        ? tPlural(CATEGORIES_I18N_KEYS.quickSearchCtaAtLeast, {
            count: count.data.count,
          })
        : tPlural(CATEGORIES_I18N_KEYS.quickSearchCtaCount, {
            count: count.data.count,
          });

  return (
    <SkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <section
        style={panelStyle}
        data-testid={props.testId ?? "categories-quick-search"}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          {props.heading}
        </Typography.Title>

        {props.fields !== undefined ? (
          <div style={fieldsStyle} data-testid="categories-quick-search-fields">
            {props.fields}
          </div>
        ) : null}

        <Button
          type="primary"
          size="large"
          block
          {...(props.ctaHref !== undefined ? { href: props.ctaHref } : {})}
          {...(props.onSubmit !== undefined ? { onClick: props.onSubmit } : {})}
          data-testid="categories-quick-search-cta"
          data-analytics="none"
          data-analytics-reason="hands the composed state to the host's search route; the search page reports the query it actually ran"
        >
          {label}
        </Button>
      </section>
    </SkinTheme>
  );
}
