/**
 * `<VocabularyTermSelect/>` — one vocabulary level as a typeahead.
 *
 * The SAME control `@stapel/attributes-react`'s `ref_select` editor draws,
 * shipped on its own so the places a composer is not — a facet filter, an
 * admin form, a bulk-edit row — do not each grow their own. The two are
 * deliberately separate components rather than one imported across the seam:
 * the editor's props are the attributes value-editor contract (a `FeatureDef`,
 * `siblings`, a rule-narrowed config) and this one's are a vocabulary pointer,
 * and collapsing them would make the two L2 pairs depend on each other for a
 * hundred lines of antd.
 *
 * What it owes a person, and where each part lives:
 *
 *  - the options ARE the answer to the current query, so `filterOption={false}`
 *    — letting antd filter them again would hide rows the server deliberately
 *    ranked (a prefix match first, a label matched in another language);
 *  - typing is debounced and superseding (`useTermSearch`), and the list is
 *    BLANK rather than stale while a newer query is in flight — a dropdown
 *    still listing the previous query's terms is a dropdown a fast tap writes
 *    the wrong code from (defect C23, measured at 400–640 ms per field);
 *  - a code the control already HOLDS is resolved to its label
 *    (`useTermLabels`) and kept in the option list even when the current page
 *    does not contain it — otherwise reopening a saved filter would silently
 *    empty the control;
 *  - no client is a LOUD state, not an empty dropdown: a control that cannot
 *    reach its terms and looks like one that found none is how a person ends
 *    up unable to answer a question nobody told them was broken.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";
import { Alert, Select } from "antd";
import { useT } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import type { VocabularyClient } from "../client.js";
import { useTermSearch } from "../model/useTermSearch.js";
import { useTermLabels, termLabel } from "../model/useTermLabels.js";
import { VOCABULARIES_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

export interface VocabularyTermSelectProps extends ThemeModeProp {
  /** The seam. `null` draws the unavailable notice — see the module header. */
  readonly client: VocabularyClient | null;
  readonly vocabulary: string;
  readonly level: string;
  /** Code of a term at the level above; narrows the list to its children. */
  readonly parent?: string | undefined;
  /** The codes currently chosen. Always a list, even single-select — a term
   * value is a list on the wire. */
  readonly value?: readonly string[] | undefined;
  readonly onChange?: ((codes: readonly string[]) => void) | undefined;
  /** Several terms at once (a facet filter); default is one. */
  readonly multiple?: boolean | undefined;
  /** Upper bound for a multiple select. */
  readonly maxCount?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly status?: "error" | "warning" | undefined;
}

export function VocabularyTermSelect(
  props: VocabularyTermSelectProps
): ReactElement {
  const t = useT();
  const { client, vocabulary, level, parent } = props;
  const codes = useMemo(
    () => (props.value ?? []).filter((code) => code.length > 0),
    [props.value]
  );

  const { terms, loading, matched, search, open } = useTermSearch(client, {
    vocabulary,
    level,
    parent,
  });
  const labels = useTermLabels(client, { vocabulary, level, codes });

  // A held code the current page does not contain still has to be visible and
  // pickable, so it is prepended rather than looked up in `terms` — but not
  // while the list fails to answer the box: `terms` is empty there, so this is
  // the whole dropdown, and a row left live during that window is one more
  // thing a fast tap can land on.
  const options = useMemo(
    () => [
      ...codes
        .filter((code) => !terms.some((term) => term.code === code))
        .map((code) => ({
          value: code,
          label: termLabel(labels, code),
          ...(matched ? {} : { disabled: true }),
        })),
      ...terms.map((term) => ({ value: term.code, label: term.label })),
    ],
    [codes, terms, labels, matched]
  );

  if (client === null || vocabulary.length === 0 || level.length === 0) {
    return (
      <SkinTheme
        surface="bare"
        {...(props.mode !== undefined ? { mode: props.mode } : {})}
      >
        <Alert
          type="warning"
          showIcon
          data-testid="vocabulary-term-select-unavailable"
          title={t(VOCABULARIES_I18N_KEYS.termSelectUnavailableTitle)}
          description={t(VOCABULARIES_I18N_KEYS.termSelectUnavailable)}
        />
      </SkinTheme>
    );
  }

  const multiple = props.multiple === true;
  const onChange = props.onChange;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Select
        {...(props.id !== undefined ? { id: props.id } : {})}
        data-testid="vocabulary-term-select"
        // The one fact a photograph and a browser probe can both read: whether
        // what is listed answers what is typed. `data-*` rather than
        // `aria-busy` because antd forwards the former to the control's root
        // and drops the latter.
        data-vocabulary-matched={matched ? "true" : "false"}
        data-vocabulary-busy={loading ? "true" : "false"}
        style={{ width: "100%" }}
        showSearch
        filterOption={false}
        options={options}
        loading={loading}
        disabled={props.disabled === true}
        {...(props.status !== undefined ? { status: props.status } : {})}
        {...(multiple ? { mode: "multiple" as const } : {})}
        {...(multiple && props.maxCount !== undefined
          ? { maxCount: props.maxCount }
          : {})}
        placeholder={t(VOCABULARIES_I18N_KEYS.termSelectPlaceholder)}
        // `null` while loading, so antd draws its own spinner instead of
        // saying "no matches" about a question that has not been answered yet.
        notFoundContent={loading ? null : t(VOCABULARIES_I18N_KEYS.termSelectNoMatches)}
        value={multiple ? codes : (codes[0] ?? null)}
        onDropdownVisibleChange={(visible: boolean) => {
          if (visible) open();
        }}
        onSearch={search}
        onChange={(next: string | readonly string[] | null) => {
          const picked =
            next === null || next === undefined
              ? []
              : Array.isArray(next)
                ? [...(next as readonly string[])]
                : [next as string];
          onChange?.(picked.filter((code) => code.length > 0));
        }}
      />
    </SkinTheme>
  );
}
