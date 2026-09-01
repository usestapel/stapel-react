/**
 * `<VocabularyTermPicker/>` — one vocabulary level as a FIELD that opens a
 * picker sheet.
 *
 * ## Why this exists BESIDE `VocabularyTermSelect` and does not replace it
 *
 * `<VocabularyTermSelect/>` is embedded: a filter rail, an admin form row, a
 * bulk-edit cell hand it a width and expect an inline control that behaves
 * like the antd `Select` beside it. Its rendered surface and its props are
 * therefore a CONTRACT other pairs already build on, and widening a dropdown
 * into a bottom sheet under those call sites would change a filter rail's
 * layout without any of them asking for it.
 *
 * A FIELD is the other half of the same question. On a phone the dropdown is
 * the wrong shape — a 250px panel floating over the field, with the on-screen
 * keyboard covering half of it — which is the rule
 * `SkinPickerSheet` states once for the fleet. So the sheet treatment ships as
 * its own component: a trigger that reads like a form field and says what is
 * chosen, and a sheet that owns the search box, the recents, and the commit.
 * A surface picks the one it wants; neither has to compromise for the other.
 *
 * Everything BELOW the two surfaces is shared, and deliberately so: the same
 * `useTermSearch` (debounced, superseding, `matched`), the same
 * `useTermLabels` for a code the control already holds, the same seam, the
 * same value shape — always a LIST of codes on the wire, in both components,
 * single-select included.
 *
 * ## Why the sheet COMPOSITION lives here and not in the substrate
 *
 * `@stapel/tokens-antd/skin` owns the design-system rules — a long list is a
 * sheet with a search box; a stale list is not tappable; a multi footer
 * carries its count — and it owns them for every pair. What it deliberately
 * does NOT own is where the rows come from. This component is the part that
 * is about VOCABULARIES: which query layer answers the box, what `matched`
 * means, that a held code needs resolving through a second endpoint, that
 * recents are scoped per (vocabulary, level), that a recent whose label the
 * server no longer knows must disappear rather than show a slug. Pushing any
 * of that into the bridge would put a vocabulary client behind a package that
 * has no business knowing one exists; keeping the sheet's paint out of here is
 * what stops the next pair from re-deriving it.
 *
 * ## The four things this component owes a person
 *
 *  - **The trigger says what is chosen, in words.** One code → its resolved
 *    label; several → the count. A field showing `iphone-15-pro` where the
 *    person chose "iPhone 15 Pro" is the defect the screenshots caught on the
 *    ref editors, and the code is only ever the FALLBACK (an unresolvable
 *    code is still shown — the stored answer is the truth, and an empty field
 *    is a worse lie than a slug).
 *  - **A list that does not answer the box is not tappable** (defect C23).
 *    `useTermSearch.matched === false` becomes the sheet's `listStale`, so
 *    the rows on screen dim and stop responding until they belong to the
 *    query. It applies to the WHOLE list, recents included: reasoning per
 *    group about which rows happen to be safe is how the previous version of
 *    this rule got holes in it.
 *  - **Recents are on top, and they are real words.** `useRecents` from
 *    `@stapel/core` (product logic, not paint — reused by the attributes ref
 *    editors and, later, by search) keyed on {@link termRecentsScope}. The
 *    section is drawn only when the box is EMPTY (once somebody is typing,
 *    the answer is the list, not their history) and only when it has
 *    something in it; a remembered code whose label cannot be resolved is
 *    DROPPED rather than rendered as a slug — an old recent pointing at a
 *    retired term is the one place the code fallback would be noise instead
 *    of honesty, because nobody asked for that row.
 *  - **No client is a LOUD state**, the same notice the select draws: a
 *    control that cannot reach its terms and looks like one that found none
 *    is how a person is left unable to answer a question nobody told them was
 *    broken.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Alert, Button, theme as antdTheme } from "antd";
import { useRecents, useT } from "@stapel/core";
import type { PersistStorage } from "@stapel/core";
import {
  DEFAULT_MAX_ROWS,
  SkinPickerSheet,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import type {
  DialogSurface,
  PickerGroup,
  PickerOption,
} from "@stapel/tokens-antd/skin";
import type { VocabularyClient } from "../client.js";
import { useTermSearch } from "../model/useTermSearch.js";
import { useTermLabels, termLabel } from "../model/useTermLabels.js";
import { VOCABULARIES_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

/** How many codes one level remembers. Shorter than core's default: a sheet's
 * recents section competes with the answer to the search box for the top of a
 * phone screen, and a fifth-most-recent make is not what anybody came for. */
export const TERM_RECENTS_MAX = 5;

/**
 * The `useRecents` scope one level's history is kept under.
 *
 * Exported because it is the key a HOST needs to wipe that history (a "clear
 * my recent choices" setting clears `recentsStorageKey(termRecentsScope(…))`),
 * and the key a test seeds to put rows in the section deterministically. The
 * parent is deliberately NOT part of it: "the models you pick most" is one
 * memory whichever make you came through, and splitting it per parent would
 * empty the section exactly when it is most useful.
 */
export function termRecentsScope(vocabulary: string, level: string): string {
  return `vocabularies.${vocabulary}.${level}`;
}

export interface VocabularyTermPickerProps extends ThemeModeProp {
  /** The seam. `null` draws the unavailable notice — see the module header. */
  readonly client: VocabularyClient | null;
  readonly vocabulary: string;
  readonly level: string;
  /** Code of a term at the level above; narrows the list to its children. */
  readonly parent?: string | undefined;
  /** The codes currently chosen. Always a list, even single-select — a term
   * value is a list on the wire, exactly as in `VocabularyTermSelect`. */
  readonly value?: readonly string[] | undefined;
  readonly onChange?: ((codes: readonly string[]) => void) | undefined;
  /** Several terms at once (a facet filter); default is one. */
  readonly multiple?: boolean | undefined;
  /** The sheet's heading. Defaults to the pair's generic "choose a term";
   * a form passes the FIELD's own label, which is what a person is answering. */
  readonly title?: ReactNode;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly status?: "error" | "warning" | undefined;
  /** How many codes the level remembers. Default {@link TERM_RECENTS_MAX}. */
  readonly recentsMax?: number | undefined;
  /**
   * Where recents are persisted. Defaults to core's storage ladder
   * (IndexedDB → localStorage → memory). A host redirects it; a test or a
   * demo passes `memoryStorage()` to make the section deterministic — the
   * same passthrough `useRecents` documents.
   */
  readonly recentsStorage?: PersistStorage | undefined;
  /** Controlled open state. Omit and the trigger owns it. */
  readonly open?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  /** Force the sheet's surface (a demo photographing the phone shape, a test).
   * Left alone it follows the viewport — sheet on a phone, modal above it. */
  readonly surface?: DialogSurface | undefined;
}

/** Codes in order, without repeats. */
function dedupe(codes: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const code of codes) if (!out.includes(code)) out.push(code);
  return out;
}

export function VocabularyTermPicker(
  props: VocabularyTermPickerProps
): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const { client, vocabulary, level, parent, onChange, onOpenChange } = props;
  const controlledOpen = props.open;
  const multiple = props.multiple === true;
  const disabled = props.disabled === true;

  const codes = useMemo(
    () => dedupe((props.value ?? []).filter((code) => code.length > 0)),
    [props.value]
  );

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const sheetOpen = controlledOpen ?? uncontrolledOpen;
  const [query, setQuery] = useState("");

  const { terms, loading, matched, search, open: openFirstPage } = useTermSearch(
    client,
    { vocabulary, level, parent }
  );
  const { recents, touch } = useRecents(termRecentsScope(vocabulary, level), {
    max: props.recentsMax ?? TERM_RECENTS_MAX,
    ...(props.recentsStorage !== undefined ? { storage: props.recentsStorage } : {}),
  });

  // ONE resolve for both the trigger and the recents section: the codes held
  // and the codes remembered are the same kind of question (words for codes
  // that are not on the current page), and two hooks would be two requests
  // answered by one endpoint.
  const wanted = useMemo(() => dedupe([...codes, ...recents]), [codes, recents]);
  const labels = useTermLabels(client, { vocabulary, level, codes: wanted });
  const resolved = useCallback(
    (code: string): string | undefined =>
      labels.status === "ready" ? labels.data[code] : undefined,
    [labels]
  );

  const setOpen = useCallback(
    (next: boolean): void => {
      if (controlledOpen === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );

  // Opening is a fresh question: the box starts empty, and if it did not the
  // hook is still holding the answer to whatever was typed last time — a list
  // that would contradict the empty box it is drawn under.
  const openSheet = useCallback((): void => {
    if (query.length > 0) {
      setQuery("");
      search("");
    }
    setOpen(true);
  }, [query, search, setOpen]);

  // The first page, fetched as the sheet opens rather than a debounce later.
  // `open()` is a no-op once the hook has asked for this (vocabulary, level,
  // parent) — and it stops being one the moment any of the three changes,
  // which is the case that matters: a parent changed under an OPEN sheet
  // leaves the previous parent's children on screen, and this is what
  // replaces them.
  useEffect(() => {
    if (sheetOpen) openFirstPage();
  }, [sheetOpen, openFirstPage]);

  const groups = useMemo<readonly PickerGroup[]>(() => {
    const results: readonly PickerOption[] = terms.map((term) => ({
      value: term.code,
      label: term.label,
    }));
    // Typing: the answer is the list. History and previous answers are not
    // matches for what is in the box and must not sit above what is.
    if (query.trim().length > 0) {
      return [{ key: "results", label: undefined, options: results }];
    }
    const onPage = (code: string): boolean =>
      terms.some((term) => term.code === code);
    const chosen: readonly PickerOption[] = codes
      .filter((code) => !onPage(code))
      .map((code) => ({ value: code, label: termLabel(labels, code) }));
    const recent: readonly PickerOption[] = recents
      .filter((code) => !codes.includes(code))
      .map((code) => ({ code, label: resolved(code) }))
      .filter(
        (entry): entry is { code: string; label: string } =>
          entry.label !== undefined
      )
      .map((entry) => ({ value: entry.code, label: entry.label }));
    const sectioned = chosen.length > 0 || recent.length > 0;
    return [
      {
        key: "chosen",
        label: t(VOCABULARIES_I18N_KEYS.termPickerChosen),
        options: chosen,
      },
      {
        key: "recent",
        label: t(VOCABULARIES_I18N_KEYS.termPickerRecent),
        options: recent,
      },
      {
        key: "all",
        // A lone "All terms" heading over the only section on screen is noise;
        // it earns its line only once something sits above it.
        label: sectioned ? t(VOCABULARIES_I18N_KEYS.termPickerAll) : undefined,
        options: results,
      },
    ];
  }, [terms, query, codes, recents, labels, resolved, t]);

  const rows = groups.reduce((sum, group) => sum + group.options.length, 0);

  const commit = useCallback(
    (picked: readonly string[]): void => {
      for (const code of picked) if (!codes.includes(code)) touch(code);
      onChange?.(picked.filter((code) => code.length > 0));
    },
    [codes, onChange, touch]
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
          data-testid="vocabulary-term-picker-unavailable"
          title={t(VOCABULARIES_I18N_KEYS.termSelectUnavailableTitle)}
          description={t(VOCABULARIES_I18N_KEYS.termSelectUnavailable)}
        />
      </SkinTheme>
    );
  }

  const current = codes[0];
  const only = codes.length === 1 ? current : undefined;
  const triggerText =
    only !== undefined
      ? termLabel(labels, only)
      : codes.length === 0
        ? t(VOCABULARIES_I18N_KEYS.termPickerEmpty)
        : // Only ever rendered for two or more — see the key's note in i18n.
          t(VOCABULARIES_I18N_KEYS.termPickerCount, { count: codes.length });

  const triggerStyle: CSSProperties = {
    width: "100%",
    textAlign: "left",
    ...(props.status === "error" ? { borderColor: token.colorError } : {}),
    ...(props.status === "warning" ? { borderColor: token.colorWarning } : {}),
    ...(codes.length === 0 ? { color: token.colorTextPlaceholder } : {}),
  };

  const title = props.title ?? t(VOCABULARIES_I18N_KEYS.termPickerTitle);
  const shared = {
    open: sheetOpen,
    onClose: () => {
      setOpen(false);
    },
    title,
    searchValue: query,
    onSearchChange: (next: string) => {
      setQuery(next);
      search(next);
    },
    searchPlaceholder: t(VOCABULARIES_I18N_KEYS.termSelectPlaceholder),
    emptyLabel: t(VOCABULARIES_I18N_KEYS.termSelectNoMatches),
    refineLabel: t(VOCABULARIES_I18N_KEYS.termPickerRefine, {
      count: DEFAULT_MAX_ROWS,
    }),
    groups,
    // The list is dimmed and inert whenever it is not the answer to the box.
    listStale: !matched,
    // The skeleton is for when there is nothing to dim: it REPLACES the list,
    // so handing it the recents section on every keystroke would flash a
    // person's own history away four times a word.
    loading: loading && rows === 0,
    testId: "vocabulary-term-picker-sheet",
    ...(props.surface !== undefined ? { surface: props.surface } : {}),
  } as const;

  return (
    <SkinTheme
      surface="bare"
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Button
        {...(props.id !== undefined ? { id: props.id } : {})}
        data-testid="vocabulary-term-picker"
        // The same two probes the select stamps, so a photograph and a browser
        // check read the state of the list the same way on either control.
        data-vocabulary-matched={matched ? "true" : "false"}
        data-vocabulary-busy={loading ? "true" : "false"}
        data-analytics="none"
        data-analytics-reason="passthrough — opening the sheet decides nothing; the pick is reported through onChange"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        style={triggerStyle}
        onClick={openSheet}
      >
        <span
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {triggerText}
        </span>
      </Button>
      {multiple ? (
        <SkinPickerSheet
          {...shared}
          mode="multi"
          values={codes}
          doneLabel={t(VOCABULARIES_I18N_KEYS.termPickerDone)}
          onChange={commit}
        />
      ) : (
        <SkinPickerSheet
          {...shared}
          mode="single"
          {...(current !== undefined ? { value: current } : {})}
          onChange={(code: string) => {
            commit([code]);
          }}
        />
      )}
    </SkinTheme>
  );
}
