/**
 * The two VOCABULARY-backed editors: `ref_select` and
 * `ref_hierarchical_select`.
 *
 * ── The rule this file states ──────────────────────────────────────────────
 *
 * **A list that does not answer the box is never pickable, and a rung whose
 * parent is unanswered says so in words.**
 *
 * The first half is defect C23, measured on the live stand on every reference
 * field of a phone category: `Vendor` 621/635 ms, `Model` 416/421 ms, `RAM`
 * 631/639 ms during which the dropdown showed the PREVIOUS query's terms,
 * every one of them pickable. A person who types three letters and taps the
 * first row — which is what people do — wrote somebody else's code into the
 * attribute, silently. {@link useTermSearch} holds the query the list ANSWERS
 * beside the terms and reports them only while the two are equal; the picker
 * sheet takes that as `listStale` and dims the rows AND stops them
 * responding, which is the substrate's first-class version of what these
 * editors used to improvise with `disabled` flags.
 *
 * The second half is the chain. Make → Model → Generation →
 * Modification → Complectation over an 812k-term vocabulary cannot be a
 * `Cascader`: its columns are a desktop shape, a phone gets a two-inch
 * scrolling well per level, and a column that is empty because its PARENT is
 * unanswered looks exactly like a column that is empty because the vocabulary
 * is. So the chain is one trigger per rung, each gated with the sentence
 * naming the rung that has to be answered first — visible text, never a
 * tooltip (`stapel/no-tooltip-in-skin`) — and the chosen path echoed above
 * them in one line.
 *
 * ── Recents ────────────────────────────────────────────────────────────────
 *
 * `useRecents` (`@stapel/core`) remembers the codes this person actually
 * picks, per scope, and the sheet draws them as its first section. The scope
 * carries the PARENT when the level is narrowed by one
 * ({@link recentsScope}): the last three models of another make are not
 * recent answers to this rung, they are three wrong codes at the top of the
 * list. The section is drawn only while the search box is empty — a "recent"
 * heading over rows that do not answer the query is the stale-list defect
 * wearing a hat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Flex, Typography } from "antd";
import { actionBlocked, useRecents, useT } from "@stapel/core";
import { GatedControl, SkinPickerSheet } from "@stapel/tokens-antd/skin";
import type { PickerGroup, PickerOption } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { ValueEditor, ValueEditorProps } from "../registry.js";
import { featureName } from "../types.js";
import {
  firstCode,
  optionsRefOf,
  partitionRecommended,
  useVocabularyClient,
} from "../vocabulary.js";
import type { VocabularyClient, VocabularyTerm } from "../vocabulary.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { UnsupportedValueEditor } from "./notice.js";
import { useTouchFloor } from "./touchFloor.js";
import {
  HintLine,
  PickerTrigger,
  configOf,
  numberish,
  str,
  useDisclosure,
} from "./editorKit.js";

/** How long a person may keep typing before a search leaves. 250 ms is the
 * fleet's typeahead debounce; below it a 14 962-row level is searched on every
 * keystroke, above it the list feels stuck. */
const VOCABULARY_DEBOUNCE_MS = 250;

/** How many terms a level's first page offers when nothing has been typed —
 * the endpoint's own default `limit`. */
const VOCABULARY_PAGE = 50;

/** How many recent codes a level's sheet offers. Five is a section a thumb
 * reaches without scrolling; `useRecents` keeps more than that, and the rest
 * are found the way everything else is — by typing. */
const RECENTS_SHOWN = 5;

/** The list a control shows when it has no answer to the question in its box.
 * One frozen instance, so "no answer" is a stable identity across renders. */
const EMPTY_TERMS: readonly VocabularyTerm[] = Object.freeze([]);

/** What separates two rungs in the path echo. A chevron, not a slash: a slash
 * reads as "or" in half the catalogues this ships to. */
const PATH_SEPARATOR = " › ";

/** Beyond this many rungs the echo elides its middle — see
 * {@link pathEcho}. */
const PATH_ECHO_MAX_RUNGS = 3;

/** The rule between the recommended band and the rest of the level. The skin's
 * own neutral border variable — the one every bordered surface in this package
 * takes — so it follows the host's light and dark palettes. */
const BAND_SEPARATOR = "var(--stapel-border-subtle, rgba(128,128,128,0.35))";

/**
 * Where a level's recents live.
 *
 * The parent is part of the scope whenever the level is narrowed by one. The
 * brief's scope is `attributes.<vocabulary>.<level>`, which is right for a
 * root level and wrong for a child: "the models you picked last" is only an
 * answer while the make is the same one, and a code from another make is a
 * refusal the server will issue at publish time.
 */
export function recentsScope(
  vocabulary: string,
  level: string,
  parent: string | undefined
): string {
  const base = `attributes.${vocabulary}.${level}`;
  return parent === undefined ? base : `${base}.${parent}`;
}

/**
 * The chosen path, in one line, with the MIDDLE elided when it is long.
 *
 * Elided by rung rather than by character: "Volkswagen › … › Mk7" tells a
 * person what they answered at both ends, while a character truncation
 * ("Volkswage…") tells them nothing about either. The ends are what identify
 * a path — the make and the trim — and the rungs between them are still one
 * tap away on their own triggers.
 */
export function pathEcho(labels: readonly string[]): string {
  if (labels.length <= PATH_ECHO_MAX_RUNGS) return labels.join(PATH_SEPARATOR);
  const first = labels[0] ?? "";
  const last = labels[labels.length - 1] ?? "";
  return [first, "…", last].join(PATH_SEPARATOR);
}

/**
 * A debounced, superseding search against the {@link VocabularyClient}, whose
 * ONE invariant is that the list on screen answers the query in the box.
 *
 *  - **a keystroke blanks the list immediately.** Not on the response, not
 *    when the debounce fires — on the keystroke, because that is the instant
 *    the list stopped being the answer.
 *  - **every request carries its query, and a response is dropped unless its
 *    query is still the current one.** The abort is kept as well, but it is a
 *    courtesy to the network; correctness may not rest on a client honouring
 *    `signal`, and an implementation that ignores it resolves stale results
 *    over fresh ones exactly as before.
 *  - **`matched` is false while a newer query is in flight**, which the sheet
 *    renders as a dimmed, inert list.
 *  - **a failure ANSWERS with an empty list** rather than freezing the last
 *    one. Stale options next to a fresh query are worse than none: they are
 *    pickable, and the code that gets picked may not be in the level at all.
 */
function useTermSearch(
  client: VocabularyClient | null,
  vocabulary: string,
  level: string,
  parent: string | undefined
): {
  readonly terms: readonly VocabularyTerm[];
  readonly loading: boolean;
  /** Does {@link terms} answer the query the box holds? While this is false
   * the list is not an answer and nothing in it may be picked. */
  readonly matched: boolean;
  /** What the box holds — the sheet's controlled search value. */
  readonly query: string;
  search(query: string): void;
  open(): void;
  /** Fetch the NEXT page of the current answer and append it — what the
   * sheet's end-of-list scroll asks for. A no-op while unanswered, while a
   * page is already in flight, and once the level is exhausted. */
  more(): void;
} {
  // The answer AND the question it answers, as one value — two states could
  // be written in either order and the pair would be briefly inconsistent,
  // which is the whole defect in miniature.
  const [answer, setAnswer] = useState<{
    readonly query: string;
    readonly terms: readonly VocabularyTerm[];
    /** No further pages: the last one came back short, or added nothing new
     * (an un-paged client returning page one again reads as exhausted). */
    readonly exhausted: boolean;
  } | null>(null);
  // What the box holds right now. `null` is "nothing has been asked for yet",
  // which is neither loading nor answered.
  const [wanted, setWanted] = useState<string | null>(null);
  // The same value, readable from a promise callback. A response is accepted
  // only while this still equals the query it was made for.
  const current = useRef<string | null>(null);
  const inFlight = useRef<AbortController | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Has this (vocabulary, level, parent) been asked for yet? A sheet reports
  // itself as opening on more than one render, so without this the "first
  // page" fetch fires more than once per opening.
  const asked = useRef(false);

  const run = useCallback(
    (query: string): void => {
      if (client === null || vocabulary.length === 0 || level.length === 0) return;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      client
        .search(vocabulary, level, query, parent, controller.signal)
        .then((found) => {
          if (controller.signal.aborted || current.current !== query) return;
          setAnswer({
            query,
            terms: found.slice(0, VOCABULARY_PAGE),
            exhausted: found.length < VOCABULARY_PAGE,
          });
        })
        .catch(() => {
          if (controller.signal.aborted || current.current !== query) return;
          setAnswer({ query, terms: [], exhausted: true });
        });
    },
    [client, vocabulary, level, parent]
  );

  // The parent moved (or the pointer did): whatever is listed belongs to the
  // old parent's children and must not stay pickable — nor may an answer for
  // the old parent, still in flight, land on the new one.
  //
  // The CLIENT is deliberately not a dependency. It arrives from context and a
  // host is expected to build it once at its composition root; a host that
  // builds one inline hands this a new identity every render, and aborting the
  // in-flight search on every render would be a control that can never finish
  // loading. A swapped client is covered anyway: `current` is what admits an
  // answer, and `run` is rebuilt on the new one.
  useEffect(() => {
    asked.current = false;
    current.current = null;
    inFlight.current?.abort();
    setAnswer(null);
    setWanted(null);
  }, [vocabulary, level, parent]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    []
  );

  const search = useCallback(
    (query: string): void => {
      asked.current = true;
      // BEFORE the debounce, not after it: the list stopped being the answer
      // the moment the query changed, and the 250 ms it would otherwise stay
      // on screen is most of the measured stale window.
      current.current = query;
      setWanted(query);
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        run(query);
      }, VOCABULARY_DEBOUNCE_MS);
    },
    [run]
  );

  // Opening is not typing: the first page is fetched immediately, because a
  // spinner that starts a quarter of a second after the tap reads as a control
  // that did not respond.
  //
  // It also RESETS the box. A sheet is a transaction — it opens showing the
  // level, not the query somebody abandoned three fields ago — and with a
  // controlled search the query outlives the sheet unless this says
  // otherwise. The guard is on the query rather than on "has been opened":
  // reopening while the first page is already the answer costs nothing and
  // fetches nothing.
  const open = useCallback((): void => {
    if (asked.current && current.current === "") return;
    asked.current = true;
    current.current = "";
    setWanted("");
    if (timer.current !== undefined) clearTimeout(timer.current);
    run("");
  }, [run]);

  // One next-page fetch at a time, and never against a superseded answer.
  // Not an AbortController: a page landing late for a query that still
  // stands is worth keeping, and the `current` check drops the rest.
  const pendingMore = useRef(false);
  const more = useCallback((): void => {
    if (client === null || vocabulary.length === 0 || level.length === 0) return;
    const settled = answer;
    if (
      settled === null ||
      settled.exhausted ||
      pendingMore.current ||
      current.current !== settled.query
    ) {
      return;
    }
    pendingMore.current = true;
    client
      .search(vocabulary, level, settled.query, parent, undefined, settled.terms.length)
      .then((found) => {
        pendingMore.current = false;
        if (current.current !== settled.query) return;
        const known = new Set(settled.terms.map((term) => term.code));
        const fresh = found.filter((term) => !known.has(term.code));
        setAnswer((latest) => {
          if (latest === null || latest.query !== settled.query) return latest;
          return {
            query: latest.query,
            terms: [...latest.terms, ...fresh],
            exhausted: fresh.length === 0 || found.length < VOCABULARY_PAGE,
          };
        });
      })
      .catch(() => {
        pendingMore.current = false;
      });
  }, [client, vocabulary, level, parent, answer]);

  const matched = wanted !== null && answer !== null && answer.query === wanted;
  return {
    terms: matched && answer !== null ? answer.terms : EMPTY_TERMS,
    loading: wanted !== null && !matched,
    matched,
    query: wanted ?? "",
    search,
    open,
    more,
  };
}

/**
 * Labels for codes the form already HOLDS — a reopened draft, a seeded value,
 * a recent pick.
 *
 * Without it the control shows the stored CODES (`iphone-15-pro`), which is
 * the fallback and not the answer: a person reopening their listing would be
 * looking at slugs out of an importer. `resolve` exists for exactly this, and
 * it is asked once per code — a code the vocabulary does not know stays itself
 * rather than being asked for again on every render.
 */
function useStoredLabels(
  client: VocabularyClient | null,
  vocabulary: string,
  level: string,
  codes: readonly string[]
): Readonly<Record<string, string>> {
  const [labels, setLabels] = useState<Readonly<Record<string, string>>>({});
  const asked = useRef(new Set<string>());
  const key = codes.join(" ");
  useEffect(() => {
    asked.current = new Set<string>();
    setLabels({});
  }, [vocabulary, level, client]);
  useEffect(() => {
    if (client === null || vocabulary.length === 0 || level.length === 0) return;
    const wanted = codes.filter((code) => !asked.current.has(code));
    if (wanted.length === 0) return;
    for (const code of wanted) asked.current.add(code);
    let live = true;
    void client
      .resolve(vocabulary, level, wanted)
      .then((found) => {
        if (live) setLabels((previous) => ({ ...previous, ...found }));
      })
      .catch(() => {
        // An unresolvable code keeps showing itself — the stored answer is the
        // truth, and a blank control would be a worse lie than a slug.
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the codes, joined: the array identity changes every render
  }, [client, vocabulary, level, key]);
  return labels;
}

/**
 * The heading of a term band, and — for the second one — the RULE between the
 * two. The line is part of the heading rather than a row of its own because
 * the sheet draws sections and not separators: a separator that could outlive
 * the band under it is exactly the "rule with nothing after it" this must
 * never draw.
 */
function BandHeading(props: {
  readonly band: "recommended" | "rest";
  readonly separated: boolean;
  readonly children: string;
}): ReactElement {
  return (
    <span
      data-attributes-band={props.band}
      style={{
        display: "block",
        // Longhands, not the `border-top` shorthand: a shorthand carrying a
        // `var()` is dropped whole by strict CSS parsers.
        ...(props.separated
          ? {
              borderTopWidth: 1,
              borderTopStyle: "solid" as const,
              borderTopColor: BAND_SEPARATOR,
              paddingTop: spacing[2],
              marginTop: spacing[1],
            }
          : {}),
      }}
    >
      {props.children}
    </span>
  );
}

/**
 * The sections one level's sheet draws, in the order a thumb meets them.
 *
 * The terms arrive as ONE list in the server's order and are drawn as one
 * unless some of them are flagged {@link VocabularyTerm.recommended} — no
 * endpoint sends the flag yet, so the unflagged shape is the one on screen
 * today and it must stay a plain, headingless list. Flagged, the level splits
 * into two bands with the recommended few on top, and:
 *
 *  - the second band's heading is drawn ONLY beside a first one. A search that
 *    matches nothing recommended collapses back to the plain list rather than
 *    putting "All options" and a rule above the whole thing;
 *  - a band with no surviving match is not emitted at all, so filtering can
 *    never leave a heading over nothing;
 *  - the order INSIDE each band is untouched — which terms lead is the
 *    server's answer, not this file's.
 */
function buildGroups(input: {
  readonly recentLabel: string;
  readonly recommendedLabel: string;
  readonly allOptionsLabel: string;
  readonly recents: readonly string[];
  readonly held: readonly string[];
  readonly terms: readonly VocabularyTerm[];
  readonly labelOf: (code: string) => string;
  readonly query: string;
}): readonly PickerGroup[] {
  const listed = new Set(input.terms.map((term) => term.code));
  const row = (code: string): PickerOption => ({ value: code, label: input.labelOf(code) });
  const termRow = (term: VocabularyTerm): PickerOption => ({
    value: term.code,
    label: term.label,
  });
  const groups: PickerGroup[] = [];
  // The current answer, kept on screen whatever is typed: a person must be
  // able to see what the field holds while they look for its replacement.
  const held = input.held.filter((code) => !listed.has(code));
  if (held.length > 0) groups.push({ key: "held", label: undefined, options: held.map(row) });
  if (input.query.trim().length === 0) {
    const recents = input.recents.filter(
      (code) => !listed.has(code) && !held.includes(code)
    );
    if (recents.length > 0) {
      groups.push({ key: "recent", label: input.recentLabel, options: recents.map(row) });
    }
  }
  const { recommended, rest } = partitionRecommended(input.terms);
  if (recommended.length === 0) {
    groups.push({ key: "terms", label: undefined, options: rest.map(termRow) });
    return groups;
  }
  groups.push({
    key: "terms-recommended",
    label: (
      <BandHeading band="recommended" separated={false}>
        {input.recommendedLabel}
      </BandHeading>
    ),
    options: recommended.map(termRow),
  });
  if (rest.length > 0) {
    groups.push({
      key: "terms",
      label: (
        <BandHeading band="rest" separated>
          {input.allOptionsLabel}
        </BandHeading>
      ),
      options: rest.map(termRow),
    });
  }
  return groups;
}

/**
 * `ref_select` → a field that says what is chosen, over a sheet that searches
 * a vocabulary LEVEL.
 *
 * `optionsRef.parentFeature` is read off {@link ValueEditorProps.siblings} —
 * the form's other answers. When it holds a code the level is narrowed to that
 * term's children; when it is empty the whole level is offered, so a form need
 * not be filled in order. And when it CHANGES, this feature's own value is
 * cleared: a model that belonged to the previous vendor is not an answer, it
 * is a refusal waiting to happen at publish time.
 */
const RefSelectEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const client = useVocabularyClient();
  const pointer = optionsRefOf(cfg);
  const vocabulary = pointer?.vocabulary ?? "";
  const level = pointer?.level ?? "";
  const parentFeature = pointer?.parentFeature;
  const parent =
    parentFeature === undefined ? undefined : firstCode(props.siblings?.[parentFeature]);

  const declaredMax = cfg["maxSelected"];
  // ABSENT means 1 for this type (`RefSelectConfig.maxSelected = 1`), the
  // opposite of `select`. An explicit null is the unlimited one.
  const maxSelected = declaredMax === null ? undefined : (numberish(declaredMax) ?? 1);
  const minSelected = numberish(cfg["minSelected"]) ?? 0;
  const multiple = maxSelected === undefined || maxSelected > 1;
  const codes = useMemo(
    () => (Array.isArray(props.value) ? props.value.map(str).filter((one) => one.length > 0) : []),
    [props.value]
  );

  const sheet = useDisclosure();
  const { terms, loading, matched, query, search, open, more } = useTermSearch(
    client,
    vocabulary,
    level,
    parent
  );
  const { recents, touch } = useRecents(recentsScope(vocabulary, level, parent), {
    max: RECENTS_SHOWN,
  });
  // The codes that need a label: what the field holds, plus what the recents
  // section is about to offer. One resolve per code, whichever list it is in.
  const needLabels = useMemo(() => [...new Set([...codes, ...recents])], [codes, recents]);
  const labels = useStoredLabels(client, vocabulary, level, needLabels);

  // Reset on a parent CHANGE, not on the first render: seeding a saved draft
  // must not wipe the answer it was seeded with. The ref holds the parent this
  // value was chosen under.
  const seenParent = useRef<string | undefined>(parent);
  const onChange = props.onChange;
  useEffect(() => {
    if (seenParent.current === parent) return;
    seenParent.current = parent;
    onChange(undefined);
  }, [parent, onChange]);

  // Auto-bake (the bake rule): once the parent is answered, probe the rung — a
  // chained level with exactly ONE child is not a question, so the form
  // commits the answer and the trigger greys out. Single-choice rungs only:
  // one available option on a multi-select is not one answer. The probe is
  // one page-sized fetch per parent landing; only this editor holds the
  // terms, which is why the collapse cannot be read off the config the way
  // the synchronous ones are (see disclosure.ts).
  const single = !multiple;
  const [soleTerm, setSoleTerm] = useState<VocabularyTerm | undefined>(undefined);
  useEffect(() => {
    setSoleTerm(undefined);
    if (client === null || parentFeature === undefined || parent === undefined || !single) {
      return;
    }
    let stale = false;
    client
      .search(vocabulary, level, "", parent)
      .then((found) => {
        if (!stale && found.length === 1) setSoleTerm(found[0]);
      })
      // A failed probe bakes nothing — the picker stays live and the server
      // still enforces the edge.
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [client, vocabulary, level, parent, parentFeature, single]);
  useEffect(() => {
    if (soleTerm === undefined) return;
    if (codes.length === 1 && codes[0] === soleTerm.code) return;
    onChange([soleTerm.code]);
  }, [soleTerm, codes, onChange]);
  const bakedNow = soleTerm !== undefined;

  if (client === null || pointer === undefined) {
    return (
      <UnsupportedValueEditor
        feature={props.feature}
        reason={ATTRIBUTES_I18N_KEYS.vocabularyUnavailable}
      />
    );
  }

  const labelOf = (code: string): string => labels[code] ?? code;
  const groups = buildGroups({
    recentLabel: t(ATTRIBUTES_I18N_KEYS.pickerRecent),
    recommendedLabel: t(ATTRIBUTES_I18N_KEYS.pickerRecommended),
    allOptionsLabel: t(ATTRIBUTES_I18N_KEYS.pickerAllOptions),
    recents,
    held: codes,
    terms,
    labelOf,
    query,
  });
  const hasRows = groups.some((group) => group.options.length > 0);
  const chosen = codes.map(labelOf).join(", ");

  const pick = (picked: readonly string[]): void => {
    for (const code of picked) if (!codes.includes(code)) touch(code);
    props.onChange(picked.length > 0 ? [...picked] : undefined);
  };

  const shared = {
    open: sheet.open,
    onClose: sheet.hide,
    title: featureName(props.feature),
    groups,
    searchValue: query,
    onSearchChange: search,
    searchPlaceholder: t(ATTRIBUTES_I18N_KEYS.pickerSearch),
    emptyLabel: t(ATTRIBUTES_I18N_KEYS.vocabularyNoMatches),
    refineLabel: t(ATTRIBUTES_I18N_KEYS.pickerRefine),
    // The rows on screen do not answer the box — dimmed and inert until they
    // do. The skeleton takes over only when there is nothing on screen at
    // all, because "still loading" and "this list is not the answer" are two
    // different sentences and the second one has rows to say it about.
    listStale: !matched,
    loading: loading && !hasRows,
    onEndReached: more,
    testId: "attributes-ref-sheet",
  };

  return (
    <Flex vertical gap={spacing[1]}>
      <div
        // The one fact a photograph and a browser probe can both read: whether
        // what is listed answers what is typed. `false` is the state the live
        // measure caught for 400–640 ms per field with a pickable list on
        // screen.
        data-testid="attributes-ref-select"
        data-vocabulary-matched={matched ? "true" : "false"}
        data-vocabulary-busy={loading ? "true" : "false"}
      >
        <PickerTrigger
          id={props.id}
          expanded={sheet.open}
          disabled={props.disabled === true || bakedNow}
          placeholder={t(ATTRIBUTES_I18N_KEYS.selectPlaceholder)}
          testId="attributes-ref-trigger"
          touchFloor={touchFloor}
          {...(chosen.length > 0 ? { value: chosen } : {})}
          {...(multiple ? { count: codes.length } : {})}
          {...(props.required === true ? { required: true } : {})}
          {...(props.error ? { invalid: true } : {})}
          onOpen={() => {
            open();
            sheet.show();
          }}
        />
        {bakedNow && (
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginTop: spacing[1] }}
            data-testid={`attributes-baked-${props.feature.slug}`}
          >
            {t(ATTRIBUTES_I18N_KEYS.bakedByConstraint)}
          </Typography.Text>
        )}
        {multiple ? (
          <SkinPickerSheet
            {...shared}
            mode="multi"
            values={codes}
            doneLabel={t(ATTRIBUTES_I18N_KEYS.pickerDone)}
            onChange={pick}
          />
        ) : (
          <SkinPickerSheet
            {...shared}
            mode="single"
            {...(codes[0] !== undefined ? { value: codes[0] } : {})}
            onChange={(next) => {
              pick([next]);
            }}
          />
        )}
      </div>
      {minSelected > 1 && (
        <HintLine>
          {t(ATTRIBUTES_I18N_KEYS.selectMinSelected, { count: minSelected })}
        </HintLine>
      )}
      {/* The cap, said before it is reached. A sheet holds its own draft and
          reports it once, so this is the one control in the set that cannot
          switch the surplus off as it is being chosen — the mirror refuses an
          over-long answer with the engine's own sentence, and this line is
          what keeps that from being a surprise. */}
      {maxSelected !== undefined && maxSelected > 1 && (
        <HintLine testId="attributes-max-selected">
          {t(ATTRIBUTES_I18N_KEYS.selectMaxSelected, { count: maxSelected })}
        </HintLine>
      )}
    </Flex>
  );
};

/**
 * One rung of a chain: a trigger, its sheet, and the sentence that explains it
 * while its parent is unanswered.
 *
 * It is a COMPONENT and not a loop body because every rung owns a search of
 * its own — `useTermSearch` and `useRecents` are hooks, and hooks in a loop
 * are the one thing React actually forbids. That is also why a rung is
 * cheap to reason about: it knows its level and its parent code, and nothing
 * else about the chain.
 */
function RefRung(props: {
  readonly id?: string | undefined;
  readonly client: VocabularyClient;
  readonly vocabulary: string;
  readonly level: string;
  readonly levelLabel: string;
  readonly parent?: string | undefined;
  /** The rung above, named — for the sentence that gates this one. */
  readonly parentLabel?: string | undefined;
  readonly value?: string | undefined;
  readonly disabled: boolean;
  readonly touchFloor: boolean;
  readonly depth: number;
  readonly onPick: (code: string) => void;
}): ReactElement {
  const t = useT();
  const sheet = useDisclosure();
  const { terms, loading, matched, query, search, open, more } = useTermSearch(
    props.client,
    props.vocabulary,
    props.level,
    props.parent
  );
  const { recents, touch } = useRecents(
    recentsScope(props.vocabulary, props.level, props.parent),
    { max: RECENTS_SHOWN }
  );
  const held = useMemo(
    () => (props.value === undefined ? [] : [props.value]),
    [props.value]
  );
  const needLabels = useMemo(() => [...new Set([...held, ...recents])], [held, recents]);
  const labels = useStoredLabels(props.client, props.vocabulary, props.level, needLabels);
  const labelOf = (code: string): string => labels[code] ?? code;

  // A rung whose parent is unanswered is not "off": it is waiting for an
  // answer, and the sentence says which one. `GatedControl` renders that
  // beside the control and points `aria-describedby` at it — never a tooltip,
  // which a disabled control cannot show anyway.
  const waiting = props.parentLabel !== undefined && props.parent === undefined;

  const groups = buildGroups({
    recentLabel: t(ATTRIBUTES_I18N_KEYS.pickerRecent),
    recommendedLabel: t(ATTRIBUTES_I18N_KEYS.pickerRecommended),
    allOptionsLabel: t(ATTRIBUTES_I18N_KEYS.pickerAllOptions),
    recents,
    held,
    terms,
    labelOf,
    query,
  });
  const hasRows = groups.some((group) => group.options.length > 0);

  const trigger = (bind: {
    readonly disabled: boolean;
    readonly "aria-describedby": string | undefined;
  }): ReactElement => (
    <div
      data-testid={`attributes-ref-rung-${String(props.depth)}`}
      data-vocabulary-matched={matched ? "true" : "false"}
      data-vocabulary-busy={loading ? "true" : "false"}
    >
      <PickerTrigger
        {...(props.id !== undefined ? { id: props.id } : {})}
        expanded={sheet.open}
        disabled={bind.disabled}
        ariaLabel={props.levelLabel}
        placeholder={props.levelLabel}
        testId={`attributes-ref-rung-trigger-${String(props.depth)}`}
        touchFloor={props.touchFloor}
        {...(props.value !== undefined ? { value: labelOf(props.value) } : {})}
        {...(bind["aria-describedby"] !== undefined
          ? { describedBy: bind["aria-describedby"] }
          : {})}
        onOpen={() => {
          open();
          sheet.show();
        }}
      />
      <SkinPickerSheet
        mode="single"
        open={sheet.open}
        onClose={sheet.hide}
        title={props.levelLabel}
        groups={groups}
        searchValue={query}
        onSearchChange={search}
        searchPlaceholder={t(ATTRIBUTES_I18N_KEYS.pickerSearch)}
        emptyLabel={t(ATTRIBUTES_I18N_KEYS.vocabularyNoMatches)}
        refineLabel={t(ATTRIBUTES_I18N_KEYS.pickerRefine)}
        listStale={!matched}
        loading={loading && !hasRows}
        onEndReached={more}
        testId={`attributes-ref-rung-sheet-${String(props.depth)}`}
        {...(props.value !== undefined ? { value: props.value } : {})}
        onChange={(next) => {
          touch(next);
          props.onPick(next);
        }}
      />
    </div>
  );

  if (!waiting) {
    return trigger({ disabled: props.disabled, "aria-describedby": undefined });
  }
  return (
    <GatedControl
      gate={actionBlocked(ATTRIBUTES_I18N_KEYS.refParentFirst, { parent: props.parentLabel })}
      testId={`attributes-ref-rung-gate-${String(props.depth)}`}
    >
      {(bind) => trigger({ disabled: true, "aria-describedby": bind["aria-describedby"] })}
    </GatedControl>
  );
}

/**
 * `ref_hierarchical_select` → one rung per vocabulary LEVEL, each searched on
 * its own and each gated until the rung above it is answered.
 *
 * The answer is still the path array of codes the engine stores and validates
 * level by level; `minDepth` decides when that path is an ANSWER. Below it the
 * path is held here as a draft and reported as `undefined` — a half-chosen
 * chain is not an answer, and emitting one would have the mirror refuse
 * (`below_minimum`) a field the person is still filling in. Above it, every
 * pick emits, which is what `changeOnSelect` used to mean on the Cascader.
 *
 * `maxDepth` stops the rungs, so a level the engine would refuse is never
 * drawn.
 */
const RefHierarchicalSelectEditor: ValueEditor = (props: ValueEditorProps) => {
  const t = useT();
  const cfg = configOf(props);
  const touchFloor = useTouchFloor();
  const client = useVocabularyClient();
  const vocabulary = str(cfg["vocabulary"]);
  const levels = useMemo(
    () =>
      Array.isArray(cfg["levels"]) ? cfg["levels"].map(str).filter((one) => one.length > 0) : [],
    [cfg]
  );
  const minDepth = numberish(cfg["minDepth"]) ?? 1;
  const maxDepth = Math.min(numberish(cfg["maxDepth"]) ?? levels.length, levels.length);

  const stored = useMemo(
    () => (Array.isArray(props.value) ? props.value.map(str).filter((one) => one.length > 0) : []),
    [props.value]
  );
  // The path being built. It is a DRAFT and not the value, because a chain
  // shorter than `minDepth` is not an answer — see the component note.
  const [draft, setDraft] = useState<readonly string[]>(stored);
  const seen = useRef(stored.join(" "));
  const storedKey = stored.join(" ");
  useEffect(() => {
    if (seen.current === storedKey) return;
    seen.current = storedKey;
    // Somebody else moved the value (a reset, a seeded draft). Only adopt a
    // real path: an emitted `undefined` for a too-short chain comes back as
    // an empty one, and adopting THAT would erase the rungs mid-chain.
    if (storedKey.length > 0) setDraft(stored);
  }, [storedKey, stored]);

  // The path echo needs LABELS, and only the rungs' own sheets know them —
  // so the codes are resolved here, once per level, exactly as a reopened
  // draft is resolved anywhere else in this file.
  const [pathLabels, setPathLabels] = useState<readonly string[]>([]);
  const draftKey = draft.join(" ");
  useEffect(() => {
    const path = draftKey.length === 0 ? [] : draftKey.split(" ");
    if (client === null || vocabulary.length === 0 || path.length === 0) {
      setPathLabels([]);
      return;
    }
    let live = true;
    void Promise.all(
      path.map(async (code, depth) => {
        const level = levels[depth];
        if (level === undefined) return code;
        try {
          return (await client.resolve(vocabulary, level, [code]))[code] ?? code;
        } catch {
          return code;
        }
      })
    ).then((resolved) => {
      if (live) setPathLabels(resolved);
    });
    return () => {
      live = false;
    };
  }, [client, vocabulary, levels, draftKey]);

  if (client === null || vocabulary.length === 0 || levels.length === 0) {
    return (
      <UnsupportedValueEditor
        feature={props.feature}
        reason={ATTRIBUTES_I18N_KEYS.vocabularyUnavailable}
      />
    );
  }

  const pick = (depth: number, code: string): void => {
    // A rung picked anew drops everything under it: a generation of the
    // previous model is not an answer, it is a refusal waiting to happen.
    const next = [...draft.slice(0, depth), code];
    setDraft(next);
    props.onChange(next.length >= minDepth ? next : undefined);
  };

  const rungs = levels.slice(0, maxDepth);
  return (
    <Flex vertical gap={spacing[2]} role="group" data-attributes-chain={rungs.length}>
      {pathLabels.length > 0 && (
        <Typography.Text
          type="secondary"
          data-testid="attributes-ref-path"
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {pathEcho(pathLabels)}
        </Typography.Text>
      )}
      {rungs.map((level, depth) => (
        <RefRung
          key={level}
          {...(depth === 0 ? { id: props.id } : {})}
          client={client}
          vocabulary={vocabulary}
          level={level}
          // A level name is key-or-literal, exactly like a feature's `group`:
          // an imported catalogue writes words, a hand-built one writes keys.
          levelLabel={t(level)}
          depth={depth}
          touchFloor={touchFloor}
          disabled={props.disabled === true}
          parent={depth === 0 ? undefined : draft[depth - 1]}
          {...(depth === 0
            ? {}
            : { parentLabel: t(levels[depth - 1] as string) })}
          {...(draft[depth] !== undefined ? { value: draft[depth] } : {})}
          onPick={(code) => {
            pick(depth, code);
          }}
        />
      ))}
    </Flex>
  );
};

export { RefHierarchicalSelectEditor, RefSelectEditor, useTermSearch };
