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
import type { ReactElement } from "react";
import { AutoComplete, Button, Flex, Input } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { useSearchBox } from "../headless/useSearchBox.js";
import type { UseSearchBoxOptions } from "../headless/useSearchBox.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

export interface SearchBoxProps extends ThemeModeProp, UseSearchBoxOptions {
  /** Override the placeholder — a category page says what it searches. */
  readonly placeholder?: string;
  /** Render the submit button beside the field. Default `true`: on a phone
   * keyboard "search" is not always offered, and a visible button is. */
  readonly submitButton?: boolean;
  readonly autoFocus?: boolean;
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

  const options = box.suggestions.map((value) => ({ value }));

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
          open={open && options.length > 0}
          style={{ flex: 1, minWidth: 0 }}
          onSelect={(value: string) => {
            setOpen(false);
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
