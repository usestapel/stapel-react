/**
 * `<ViewSwitch>` — how the results are ARRANGED: a list, a grid, or something
 * the deployment brought with it.
 *
 * ## Why two of the three views ship and the third is a slot
 *
 * A list and a grid are the SAME data in two arrangements: one column of wide
 * rows, or as many card columns as fit. That is a layout decision and a search
 * pair can take it. A MAP is not — it needs a tile source, a projection, a
 * marker layer and a geocoder, all of which live in `geo-react` and none of
 * which a search package may depend on. So the third view arrives as a
 * {@link SearchView} the host declares, with its own `render`, and this
 * component treats it exactly like the two it ships. A pair that hardcoded a
 * "map" button and then had nothing to draw would be offering a control that
 * cannot work — the defect class the fleet calls a silent slot.
 *
 * ## The view is not URL state, and that is deliberate
 *
 * `sort`, `page size`, every filter and the cursor are in the query string,
 * because they change WHAT the answer is and a shared link has to carry them.
 * The view changes only how the same answer is drawn. Putting it in the URL
 * would make every arrangement flip a new history entry and would rewrite the
 * meaning of a link somebody sent. The page holds it in component state and
 * offers `defaultView`/`onViewChange` so a host that wants it remembered can
 * persist it wherever it keeps preferences.
 */
import type { ReactElement, ReactNode } from "react";
import { Segmented } from "antd";
import { useT } from "@stapel/core";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import type { SearchResultsRenderer } from "./SearchResultsPane.js";

/** How the pane's own arrangements lay a page of results out. */
export type SearchResultsLayout = "grid" | "list";

/** One arrangement offered by the switch. */
export interface SearchView {
  /** Stable id — what `defaultView`/`onViewChange` speak in. */
  readonly id: string;
  /** i18n KEY for the view's name (never a literal: the switch is chrome). */
  readonly labelKey: string;
  /** The glyph beside the name. Omitted, the name stands alone. */
  readonly icon?: ReactNode;
  /**
   * One of the pane's own arrangements. Ignored when {@link SearchView.render}
   * is present, which replaces the arrangement entirely.
   */
  readonly layout?: SearchResultsLayout;
  /**
   * The whole result surface, for a view the pair cannot draw — a map, a
   * comparison table. It receives the loaded rows; the pane keeps its four
   * load arms around it, so "nothing found" and "we could not run this search"
   * stay the pane's sentences rather than the slot's problem.
   */
  readonly render?: SearchResultsRenderer;
}

/** Rows — one wide row per result, the arrangement a scan reads fastest. */
function ListGlyph(): ReactElement {
  return (
    <ViewGlyph>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </ViewGlyph>
  );
}

/** Cards — as many columns as fit. */
function GridGlyph(): ReactElement {
  return (
    <ViewGlyph>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </ViewGlyph>
  );
}

function ViewGlyph(props: { readonly children: ReactNode }): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      role="img"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

/** The two arrangements the pair itself can draw. */
export const SEARCH_BUILTIN_VIEWS: readonly SearchView[] = [
  {
    id: "list",
    labelKey: SEARCH_I18N_KEYS.viewList,
    icon: <ListGlyph />,
    layout: "list",
  },
  {
    id: "grid",
    labelKey: SEARCH_I18N_KEYS.viewGrid,
    icon: <GridGlyph />,
    layout: "grid",
  },
];

/** The view `id` currently in force, or the first offered one. */
export function resolveView(
  views: readonly SearchView[],
  id: string | undefined
): SearchView | undefined {
  return views.find((view) => view.id === id) ?? views[0];
}

export interface ViewSwitchProps {
  readonly views: readonly SearchView[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  /**
   * THE GLYPHS ALONE — the phone form, and it is a different control rather
   * than the same one at a smaller type step.
   *
   * Named + glyph is two labels wide, and on a 390px toolbar it shares a line
   * with the sort select. The select has a floor (the width of its own longest
   * option — see `SortSelect`), so the switch is what gave: it was CUT by the
   * select's leading edge mid-word, and the last arrangement on offer read as
   * a truncated word with no indication there was a control there at all. A
   * segmented control cut in half is worse than one with no words: the first
   * looks broken, the second looks deliberate.
   *
   * So below the pane's phone breakpoint each option is its glyph and nothing
   * else, and the NAME moves to where a name belongs — `aria-label`, off the
   * same i18n key the wide form prints, so nothing is lost to a screen reader
   * or to a locale. A view with no `icon` keeps its name: an option drawn as
   * an empty box is not a smaller control, it is an unreachable one.
   */
  readonly compact?: boolean;
}

/**
 * One option's face. Compact, that is the glyph carrying the view's NAME:
 * `role="img"` is what makes an `aria-label` computable here — the glyph
 * inside is `aria-hidden`, and a bare `<span>` has no role for a name to
 * attach to, so the radio the browser builds around it would be nameless.
 */
function ViewOptionLabel(props: {
  readonly name: string;
  readonly icon: ReactNode;
}): ReactElement {
  return (
    <span role="img" aria-label={props.name} data-testid="search-view-option-icon">
      {props.icon}
    </span>
  );
}

/**
 * The switch itself. Renders nothing for a single view: a control offering one
 * choice is not a control, it is a label that can be clicked.
 */
export function ViewSwitch(props: ViewSwitchProps): ReactElement | null {
  const t = useT();
  if (props.views.length < 2) return null;
  const compact = props.compact === true;
  return (
    <Segmented<string>
      aria-label={t(SEARCH_I18N_KEYS.viewLabel)}
      value={props.value}
      data-testid="search-view-switch"
      data-view-switch={compact ? "compact" : "named"}
      onChange={props.onChange}
      // It keeps the width its glyphs need and no more: the group it sits in
      // wraps as a unit when the line is short, and a switch that shrank
      // instead would be the cut control this form exists to end.
      style={{ flex: "0 0 auto" }}
      options={props.views.map((view) => {
        const name = t(view.labelKey);
        if (compact && view.icon !== undefined) {
          return { value: view.id, label: <ViewOptionLabel name={name} icon={view.icon} /> };
        }
        return {
          value: view.id,
          label: name,
          ...(view.icon !== undefined ? { icon: view.icon } : {}),
        };
      })}
    />
  );
}
