/**
 * `<SearchBox>` — the control this pair shipped a search page without.
 *
 * `setText` existed from the first release and had ZERO callers in the whole
 * repository: the URL codec could carry `q`, the state machine could set it,
 * the request sent it — and nothing on any screen could type one. A results
 * page reachable only by editing the address bar is not a search feature, so
 * this is the blocker of the pair's audit (S-1) and the reason the page is now
 * a screen rather than a viewer.
 *
 * ── What it does, and what it refuses to do ───────────────────────────────
 *
 *  - **Types into a draft, searches after a pause.** `useSearchBox` owns the
 *    debounce and the URL round-trip; this file is the antd shape of it.
 *  - **Suggests from the INDEX.** `GET /suggest` returns title prefixes out of
 *    the catalogue — never a query log, because stapel-search keeps none — so
 *    every suggestion is a search that has results. The endpoint was typed and
 *    unreachable for three releases (S-8).
 *  - **Reaches the CATALOGUE, not only the titles.** stapel-search 0.7.0
 *    answers with CATEGORIES too, and they render as their own group above the
 *    terms: on a live classified deployment, typing a word that names a
 *    section answered listing titles and nothing else, so the search field
 *    could not reach a category at all. Each row prints the ancestor path
 *    (three catalogues have a "Shorts"; only the path tells them apart) and
 *    the live listing count, and follows the server's own `category` string.
 *    See
 *    `useSearchBox` for why the group is absent rather than empty when the
 *    server says it had no provider.
 *  - **Never grows a "no results" dropdown.** With nothing to suggest the menu
 *    stays shut: an empty popover under a half-typed word says "there is
 *    nothing" about a search that has not run.
 *  - **Caps the input at the server's own limit** (200 chars), so
 *    `error.400.search_query_too_long` is a refusal this control cannot cause.
 *
 * Exported from `/default` so a container can mount it in the header —
 * `nav/manifest.ts` calls `/s` "a navigation TARGET reached from the header's
 * search box", and this is that box. It needs the same `<SearchStateProvider>`
 * as everything else; a header outside one renders `<SearchPage>`'s copy.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { AutoComplete, Button, Flex, Input, Typography } from "antd";
import { useT, useTPlural } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { useSearchBox } from "../headless/useSearchBox.js";
import type { UseSearchBoxOptions } from "../headless/useSearchBox.js";
import type { SuggestCategory } from "../api/types.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

/**
 * The separator between the ancestor names of a category row.
 *
 * The same one the vocabulary and hierarchical formatters use fleet-wide, so a
 * path reads identically in the box, on a card and in the composer.
 */
const PATH_SEPARATOR = " / ";

/** Marks a menu row as a DESTINATION rather than a search term.
 *
 * The kind travels on the option OBJECT and never inside its `value`: a
 * category's `category` string and a title prefix are both strings, and
 * telling them apart by sniffing the text is how a term that happens to look
 * like a path silently navigates somewhere. */
interface BoxOption {
  readonly value: string;
  readonly label?: ReactNode;
  readonly stapelCategory?: SuggestCategory;
}

/** A labelled group of rows — antd renders the label as a group heading. */
interface BoxOptionGroup {
  readonly label: ReactNode;
  readonly options: BoxOption[];
}

export interface SearchBoxProps extends ThemeModeProp, UseSearchBoxOptions {
  /** Override the placeholder — a category page says what it searches. */
  readonly placeholder?: string;
  /** Render the submit button beside the field. Default `true`: on a phone
   * keyboard "search" is not always offered, and a visible button is. */
  readonly submitButton?: boolean;
  readonly autoFocus?: boolean;
}

/** One destination row: the ancestor path, and how many live listings are
 * behind it. */
function CategoryRow(props: {
  readonly category: SuggestCategory;
  readonly showCount: boolean;
}): ReactElement {
  const tPlural = useTPlural();
  const { category } = props;
  return (
    <Flex
      justify="space-between"
      align="center"
      gap={spacing[2]}
      data-testid={`search-box-category-${category.category}`}
    >
      {/* The whole path, not the leaf: three catalogues have a "Shorts", and
          the path is the only thing that says which one this is. */}
      <span>{category.path.join(PATH_SEPARATOR)}</span>
      {props.showCount && (
        <Typography.Text type="secondary">
          {tPlural(SEARCH_I18N_KEYS.boxCategoryCount, { count: category.count })}
        </Typography.Text>
      )}
    </Flex>
  );
}

export function SearchBox(props: SearchBoxProps): ReactElement {
  const t = useT();
  const {
    mode,
    placeholder,
    submitButton,
    autoFocus,
    ...boxOptions
  } = props;
  const box = useSearchBox(boxOptions);
  const [open, setOpen] = useState(false);

  const categoryOptions: BoxOption[] = box.categories.map(
    (category) => ({
      // The server's own string, verbatim — it is unique per row and it is
      // exactly what the SERP's `category` parameter takes.
      value: category.category,
      label: (
        <CategoryRow
          category={category}
          showCount={!box.categoryCountsUnknown}
        />
      ),
      stapelCategory: category,
    })
  );
  const termOptions: BoxOption[] = box.suggestions.map((value) => ({ value }));

  /*
   * Destinations FIRST, then terms.
   *
   * A classified's box is a navigation control before it is a text filter:
   * the person who typed a section's name wants the section, and the titles
   * that happen to contain the word are the fallback, not the answer. The
   * server ranks the destinations by live listing count and this list keeps
   * that order.
   *
   * The group is absent — not empty — when the server had no category
   * provider, which falls out of `box.categories` being empty: a heading over
   * nothing would be the box claiming the catalogue has no such section, a
   * claim the answer never made. See `useSearchBox`.
   */
  const options: (BoxOption | BoxOptionGroup)[] =
    categoryOptions.length > 0
      ? [
          {
            label: (
              <span data-testid="search-box-categories-heading">
                {t(SEARCH_I18N_KEYS.boxCategories)}
              </span>
            ),
            options: categoryOptions,
          },
          ...(termOptions.length > 0
            ? [
                {
                  label: (
                    <span data-testid="search-box-terms-heading">
                      {t(SEARCH_I18N_KEYS.boxSuggestions)}
                    </span>
                  ),
                  options: termOptions,
                },
              ]
            : []),
        ]
      : termOptions;
  const hasOptions = categoryOptions.length > 0 || termOptions.length > 0;

  return (
    <SkinTheme
      surface="bare"
      {...(mode !== undefined ? { mode } : {})}
      data-testid="search-box"
    >
      <Flex gap={spacing[2]} align="center" wrap={false}>
        <AutoComplete
          value={box.draft}
          options={options}
          // Shut whenever there is nothing to say — see the header. The
          // open state is the skin's, not antd's: the prop that reports the
          // menu opening was renamed between antd 5 and 6 and this package
          // supports both, so nothing here asks antd when to open.
          open={open && hasOptions}
          style={{ flex: 1, minWidth: 0 }}
          onSelect={(value: string, option: BoxOption | BoxOptionGroup) => {
            setOpen(false);
            // A destination navigates; a term searches. The kind is read off
            // the option OBJECT, never sniffed out of the text — see
            // `BoxOption`.
            const category =
              "stapelCategory" in option ? option.stapelCategory : undefined;
            if (category !== undefined) {
              box.chooseCategory(category);
              return;
            }
            box.submit(value);
          }}
          onChange={(value: string) => {
            setOpen(true);
            box.setDraft(value);
          }}
        >
          <Input
            allowClear={{
              clearIcon: (
                <span aria-label={t(SEARCH_I18N_KEYS.boxClear)} role="img">
                  {"×"}
                </span>
              ),
            }}
            autoFocus={autoFocus === true}
            maxLength={box.maxLength}
            aria-label={t(SEARCH_I18N_KEYS.boxLabel)}
            placeholder={placeholder ?? t(SEARCH_I18N_KEYS.boxPlaceholder)}
            data-testid="search-box-input"
            data-analytics="none"
            data-analytics-reason="typing a query is a read, not a flow step"
            onPressEnter={() => {
              setOpen(false);
              box.submit();
            }}
            onBlur={() => {
              setOpen(false);
            }}
          />
        </AutoComplete>
        {submitButton !== false && (
          <Button
            type="primary"
            data-testid="search-box-submit"
            data-analytics="none"
            data-analytics-reason="running a search is a read, not a flow step"
            onClick={() => {
              setOpen(false);
              box.submit();
            }}
          >
            {t(SEARCH_I18N_KEYS.boxSubmit)}
          </Button>
        )}
      </Flex>
    </SkinTheme>
  );
}
