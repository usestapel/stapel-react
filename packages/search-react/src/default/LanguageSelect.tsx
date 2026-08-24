/**
 * The query's LANGUAGE — `lang`, and the reason it is a filter rather than a
 * display preference.
 *
 * `lang` does two things server-side (`query.py`): it picks the ANALYZER (so a
 * Russian word stems as Russian rather than as an unknown token) and it
 * NARROWS the corpus to documents indexed in that language. Getting it wrong therefore changes
 * which results exist, not how they are written — which is why the control
 * lives in the filter panel beside the facets and not in a settings menu.
 *
 * ── Which languages a deployment has is not this pair's fact ───────────────
 *
 * The index's languages come from what has been indexed; there is no endpoint
 * that lists them. So the host names them (`languages`), and the labels come
 * from `Intl.DisplayNames` in the reader's own locale — each language named
 * the way THIS reader would name it — rather than from a translation table this
 * pair would have to carry for every language a deployment might index.
 *
 * With no `languages` prop the control renders only when the URL already
 * carries one, and then only to REMOVE it: a constraint that arrived in a
 * shared link must always have a control that widens it again.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";
import { Flex, Select, Typography } from "antd";
import { useOptionalI18n, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { useSearchState } from "../headless/SearchStateProvider.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** Width of the language select — a language name plus room for a long one. */
export const LANGUAGE_SELECT_MIN_WIDTH = 176;

export interface LanguageSelectProps {
  /** BCP-47 tags the deployment indexes (e.g. `["ru", "en"]`). */
  readonly languages?: readonly string[];
}

/**
 * A language tag as a person reads it, in THEIR locale. Falls back to the tag
 * itself where the runtime has no name for it — a tag is at least honest,
 * where a blank option is unclickable.
 */
function languageName(tag: string, locale: string): string {
  try {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    return names.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

export function LanguageSelect(props: LanguageSelectProps): ReactElement | null {
  const t = useT();
  // The reader's locale names the languages. Optional on purpose: every other
  // control in this skin renders outside a provider (English floor) rather
  // than throwing, and a language list is not the place to break that.
  const locale = useOptionalI18n()?.locale ?? "en";
  const { state, setLanguage } = useSearchState();
  const active = state.lang;
  const languages = props.languages;

  const options = useMemo(() => {
    const tags = [...(languages ?? [])];
    if (active !== undefined && !tags.includes(active)) tags.push(active);
    return [
      { value: "", label: t(SEARCH_I18N_KEYS.languageAny) },
      ...tags.map((tag) => ({ value: tag, label: languageName(tag, locale) })),
    ];
  }, [languages, active, locale, t]);

  // Nothing offered and nothing applied: a select with one option ("any") is a
  // control that cannot do anything, which §83 calls a dead control.
  if ((languages ?? []).length === 0 && active === undefined) return null;

  return (
    <Flex gap={spacing[2]} align="center" wrap>
      <Typography.Text type="secondary" aria-hidden="true">
        {t(SEARCH_I18N_KEYS.languageLabel)}
      </Typography.Text>
      <Select<string>
        data-testid="search-language"
        aria-label={t(SEARCH_I18N_KEYS.languageLabel)}
        style={{ minWidth: LANGUAGE_SELECT_MIN_WIDTH }}
        value={active ?? ""}
        onChange={(next) => {
          setLanguage(next === "" ? null : next);
        }}
        options={options}
      />
    </Flex>
  );
}
