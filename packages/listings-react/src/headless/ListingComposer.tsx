import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  loadFailed,
  loadLoading,
  loadReady,
} from "@stapel/core";
import type { ActionAvailability, FlowError, LoadState } from "@stapel/core";
import type { FeatureDef, FeaturesDto } from "@stapel/attributes-react";
import {
  initialFeatureValues,
  toFeaturesDto,
  unsupportedTypes,
  useVocabularyClient,
} from "@stapel/attributes-react";
import type {
  ListingDetail as ListingDetailData,
  ListingDraft,
  PublishResponse,
} from "../api/types.js";
import { useListingsRuntime } from "../model/context.js";
import { useListing, useListingDraft } from "../model/queries.js";
import {
  useCreateDraft,
  usePublishListing,
  useSaveDraft,
} from "../model/mutations.js";
import {
  createDraftBody,
  draftPatchFromValues,
  draftValuesFromDetail,
  draftValuesFromWire,
  droppedFeatureSlugs,
  emptyDraftValues,
  retainKnownFeatureValues,
} from "../model/draft.js";
import type { ListingDraftValues, ListingLocation } from "../model/draft.js";
import { asFeatureDaoList } from "../model/features.js";
import { featuresDtoFromDaoList } from "../model/features.js";
import {
  LISTING_FIELD_ORDER,
  envelopeFieldErrors,
  mirrorDraft,
  publishRefusal,
} from "../model/validation.js";
import type { PublishRefusal } from "../model/validation.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { useMandateGate } from "./useMandateGate.js";

/**
 * The submission flow — the pair's long pole, and the place four contracts
 * meet: the draft twin (listings), the value editors (attributes), the upload
 * queue (cdn) and the category schema (categories).
 *
 * ── The steps, and why they are not a `@flow_step` funnel ──────────────────
 *
 *     create the draft row → save into it → pick a category → publish
 *
 * The server does not sequence these (see `flows/registry.ts`). What DOES
 * sequence them is here, and its stages are named so analytics can follow the
 * funnel without the backend having declared one.
 *
 * The row comes FIRST, and the category is a field saved into it like any
 * other. That is not a preference: `category_id` is nullable on the draft half
 * (stapel-listings 0.21.4) precisely so an id exists before the form is
 * answerable, and everything addressed by that id — a background analysis of
 * the first photo, an upload filed against the draft, a link back into an
 * unfinished submission — cannot start until it does (D261). The category is
 * mandatory to PUBLISH and nowhere earlier; the server says the same thing,
 * refusing a publish with `publish_validation_failed` naming `category_id`.
 *
 * ── The three seams, and why none of them is an import ─────────────────────
 *
 * `@stapel/listings-react`, `@stapel/cdn-react` and `@stapel/categories-react`
 * are all L2 pairs, and L2 pairs never import each other (the monorepo README
 * states the direction). So:
 *
 *  - **the category schema** arrives as `features` — a plain
 *    `readonly FeatureDef[]`. The container gets it from
 *    `@stapel/categories-react`'s `useCategoryFeatures`;
 *  - **the gallery** arrives as {@link ListingImagesBag} — two members,
 *    satisfied STRUCTURALLY by `useUploadQueue()`'s bag from
 *    `@stapel/cdn-react`. `bag.refs` IS the value of `images_draft` (same
 *    order, first tile is the cover) and `bag.settled` is the submit gate
 *    that stops a publish while photos are in flight. That pair wrote its bag
 *    to this contract on purpose (its §13.6 note 9);
 *  - **the value editors** come from `@stapel/attributes-react`, which is L0
 *    and therefore a legitimate dependency. Only `editorTypes` crosses back:
 *    the headless half must judge renderability without importing a skin, so
 *    the skin's `BUILTIN_VALUE_EDITOR_TYPES` is passed IN.
 *
 * ── Reopening a draft, before and after stapel-listings 0.21.1 ─────────────
 *
 * `GET /{pk}/` serializes the PUBLISHED fields only (`ListingDetailSerializer`)
 * and, before 0.21.1, `ListingDraftSerializer` appeared only as the RESPONSE
 * of create / save-draft — no read returned the `*_draft` twin at all. So a
 * draft abandoned and reopened came back empty, and a live listing's edit
 * seeded from the published half instead (`draftValuesFromDetail`), which is
 * what the person could actually see but not necessarily what they had last
 * typed and not yet republished.
 *
 * 0.21.1 added the owner-only `GET /{pk}/draft/`, the exact `save-draft`
 * response shape. The seeding effect now tries it first
 * (`draftValuesFromWire`) for every reopened listing, live or not, and falls
 * back to the published-half seed only when that read 404s — either nothing
 * was ever saved, or the backend predates the route. `draftNotReadable`
 * narrows to exactly that fallback case: the draft read failed AND the
 * published half is empty too, so there is truly nothing to show.
 */

/** The two members of `@stapel/cdn-react`'s upload bag this composer needs.
 * Declared structurally so the dependency stays a wiring decision. */
export interface ListingImagesBag {
  /** Settled CDN references in display order — the value of `images_draft`. */
  readonly refs: readonly string[];
  /** Available when every pick has a reference; blocked WITH the reason
   * (still uploading / one failed) otherwise. */
  readonly settled: ActionAvailability;
}

/**
 * Where the submission has got to. Named so a funnel can be measured.
 *
 * `choosing_category` says the category is not chosen yet and NOTHING about
 * whether the row exists — since D261 the draft is created by the first save,
 * category or no category, so `bag.listingId` can be a real id at this stage.
 * A surface that needs "is there a row" must read `listingId`; reading it off
 * the stage is what made a draft-addressed job wait for a step it did not
 * depend on.
 */
export type ComposeStage =
  | "choosing_category"
  | "editing"
  | "saving"
  | "publishing"
  | "published";

/** What a successful publish turned out to be — the 0.5.0 distinction, taken
 * from the server's own answer rather than guessed from what we sent. */
export type PublishOutcome = "submitted_for_review" | "live_edit_under_review";

export interface UseListingComposerOptions {
  /** An existing listing to edit. Absent: a new one, whose row is created on
   * the first save. */
  readonly listingId?: number;
  /** The chosen category's features. Empty while none is chosen. */
  readonly features: readonly FeatureDef[];
  /** The schema read is in flight. Blocks the submit with its own reason —
   * publishing against a half-known schema is how a mandatory attribute gets
   * skipped. */
  readonly featuresLoading?: boolean;
  /** The schema read failed. Same block, different sentence. */
  readonly featuresError?: unknown;
  /** Value types the rendering half can draw — pass
   * `BUILTIN_VALUE_EDITOR_TYPES` from `@stapel/attributes-react/default`. */
  readonly editorTypes?: readonly string[];
  /**
   * The language a NEW draft is written in — the composer's own UI locale, in
   * practice (`useI18n().locale`).
   *
   * `Listing.language` is sent on every save and was never settable: a blank
   * value let the server's deployment default decide, so a Spanish seller's
   * listing was filed as Russian because that is what the storefront defaults
   * to. Seeding it from the locale the form is being READ in is the only
   * honest guess a library can make, and a host that knows better passes
   * `initialValues.language`, which still wins.
   */
  readonly language?: string;
  /** The upload queue. Absent: no gallery, and `images` is set through
   * `setValue` by whatever the host uses instead. */
  readonly images?: ListingImagesBag;
  /**
   * The chosen category, when the CONTAINER owns that state.
   *
   * The category is the one value the composer cannot own alone: the picker
   * lives in `@stapel/categories-react` and the schema read
   * (`useCategoryFeatures(id)`) that fills `features` is keyed by it, so the
   * container holds it either way. Passing it here makes this hook controlled
   * on that field — `values.categoryId` mirrors it, and `setCategory` reports
   * upwards instead of writing local state that would then disagree with the
   * schema on screen.
   *
   * Absent: uncontrolled, exactly as before.
   */
  readonly category?: string;
  /** Called by `setCategory`, whether or not `category` is controlled. This is
   * how a container learns which category to read the schema for. */
  readonly onCategoryChange?: (categoryId: string) => void;
  /** Seed for a brand-new draft (a category preselected from the URL, say). */
  readonly initialValues?: Partial<ListingDraftValues>;
  onDraftCreated?: (draft: ListingDraft) => void;
  onPublished?: (response: PublishResponse, outcome: PublishOutcome) => void;
}

export interface ListingComposerBag {
  readonly stage: ComposeStage;
  readonly listingId: number | undefined;
  readonly values: ListingDraftValues;
  /** The listing being edited, when there is one. `loading` until it lands —
  a composer must not let someone publish over a listing it has not read. */
  readonly listingState: LoadState<ListingDetailData> | undefined;
  /** Editing something already PUBLISHED: the submit becomes "send changes",
   * and the listing stays visible throughout. */
  readonly isLiveEdit: boolean;
  /** The reopened draft came back empty because no read returns the draft
   * twin — see this module's header. */
  readonly draftNotReadable: boolean;

  setValue<K extends keyof ListingDraftValues>(
    key: K,
    value: ListingDraftValues[K]
  ): void;
  setLocation(location: ListingLocation): void;
  setFeature(slug: string, value: unknown): void;
  /** Changing category keeps the answers the new schema also asks for. */
  setCategory(categoryId: string): void;
  /** Slugs cleared by the last category change — named, not silently lost. */
  readonly droppedOnCategoryChange: readonly string[];

  /** The client mirror, always current. */
  readonly mirror: Readonly<Record<string, FlowError>>;
  /** What a control should actually show: the mirror once the person has
   * tried to submit, overlaid by the server's verdict when there is one. */
  readonly fieldErrors: Readonly<Record<string, FlowError>>;
  /** The server's last publish refusal, unrouted, for a summary line. */
  readonly refusal: PublishRefusal | undefined;
  /**
   * The first field the mirror is refusing, in the order the form asks for it
   * (`LISTING_FIELD_ORDER`, then the category's features in schema order), or
   * `undefined` when nothing is refused.
   *
   * The publish gate can say "10 required details are still empty" while not
   * one of them is on screen — on a phone the attribute region starts nearly
   * two viewports below the fold — and a count with nowhere to go is a dead
   * end. This is what a skin's "take me there" control aims at.
   */
  readonly firstUnsatisfied: string | undefined;
  /** Value types this build cannot draw — the fact, from attributes-react. */
  readonly unsupported: readonly string[];

  readonly saveGate: ActionAvailability;
  readonly publishGate: ActionAvailability;
  save(): void;
  /**
   * Save once the state written in this same handler has landed.
   *
   * `save()` closes over the values of the render it was created in, so a
   * picker doing `setLocation(place); save()` in one click saved the draft as
   * it was BEFORE the place was chosen — the plain fields never hit this
   * because a blur is always a separate tick from the keystroke. A picker has
   * no blur: choosing a suggestion IS the commit, so it needs a save that runs
   * after the write it belongs to.
   */
  saveSoon(): void;
  publish(): void;
  readonly saving: boolean;
  readonly publishing: boolean;
  readonly saved: boolean;
  readonly saveError: unknown;
  readonly outcome: PublishOutcome | undefined;
}

export function useListingComposer(
  options: UseListingComposerOptions
): ListingComposerBag {
  const runtime = useListingsRuntime();
  const mandate = useMandateGate();

  const [listingId, setListingId] = useState<number | undefined>(
    options.listingId
  );
  const [values, setValues] = useState<ListingDraftValues>(() => ({
    ...emptyDraftValues({
      currency: runtime.currency,
      ...(options.language !== undefined ? { language: options.language } : {}),
    }),
    ...options.initialValues,
  }));
  const [showErrors, setShowErrors] = useState(false);
  const [dropped, setDropped] = useState<readonly string[]>([]);
  const [refusal, setRefusal] = useState<PublishRefusal | undefined>(undefined);
  const [outcome, setOutcome] = useState<PublishOutcome | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  // A counter rather than a boolean: two picks in a row are two saves, and a
  // boolean that was already `true` would swallow the second.
  const [saveRequest, setSaveRequest] = useState(0);

  const existing = useListing(options.listingId);
  const listingDraft = useListingDraft(options.listingId);
  const createDraft = useCreateDraft();
  const saveDraft = useSaveDraft();
  const publishListing = usePublishListing();

  // Seed once from the listing being edited. `seeded` is a ref rather than a
  // dependency guard because re-seeding on a refetch would throw away
  // everything typed since — a background invalidation must never rewrite a
  // form somebody is in the middle of.
  //
  // The draft-twin read (`GET {id}/draft/`, 0.21.1) is tried FIRST
  // (`draftValuesFromWire`); the published-half seed (`draftValuesFromDetail`)
  // is the fallback, taken once that read has settled to anything other than
  // success — a 404 because nothing was ever saved, a 404 because this
  // backend predates the route, or any other failure a composer must not
  // hang on. Waiting for `listingDraft` to settle too (not only `existing`)
  // is what stops a live listing with unpublished edits from flashing its
  // published content before the true draft lands.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    const detail = existing.data;
    if (detail === undefined) return;
    if (listingDraft.status === "pending") return;
    seeded.current = true;
    setListingId(detail.id);
    setValues(
      listingDraft.status === "success"
        ? draftValuesFromWire(listingDraft.data, { currency: runtime.currency })
        : draftValuesFromDetail(
            detail,
            featuresDtoFromDaoList(asFeatureDaoList(detail.features)) as FeaturesDto,
            { currency: runtime.currency }
          )
    );
  }, [existing.data, listingDraft.status, listingDraft.data, runtime.currency]);

  // Pruning and SEEDING both run on the SCHEMA arriving, one render after the
  // category changed: `setCategory` cannot prune against features it has not
  // been handed. Gated on the schema being settled, because acting on a
  // half-loaded (or previous) category's features would delete answers that
  // are perfectly valid for the one now chosen.
  //
  // The effect fires once per feature SET (its deps are the set and the
  // settled flag), so a default seeded here is not re-seeded over an answer
  // the person then cleared.
  const schemaSettled =
    options.featuresLoading !== true && options.featuresError === undefined;
  const { features } = options;
  useEffect(() => {
    if (!schemaSettled || features.length === 0) return;
    setValues((current) => {
      const gone = droppedFeatureSlugs(current.features, features);
      const kept =
        gone.length === 0 ? current.features : retainKnownFeatureValues(current.features, features);
      // `FeatureDef.default` (and the type's own default) is what the CATALOGUE
      // says a blank form opens with — a `select` option flagged `default`, a
      // preset date. It is applied ONLY where the draft has no answer: a
      // reopened listing, or anything typed before the schema landed, outranks
      // a default, because a default is a suggestion and an answer is not.
      const seeded: Record<string, unknown> = {};
      for (const [slug, value] of Object.entries(initialFeatureValues(features))) {
        if (kept[slug] === undefined) seeded[slug] = value;
      }
      if (gone.length === 0 && Object.keys(seeded).length === 0) return current;
      if (gone.length > 0) setDropped(gone);
      return { ...current, features: { ...kept, ...seeded } };
    });
  }, [schemaSettled, features]);

  // The gallery is the upload bag's, whenever there is one: two sources of
  // truth for the same list is how a publish sends photos the person removed.
  const images = options.images?.refs ?? values.images;
  // Same rule for the category when the container holds it: the schema on
  // screen is read for the container's id, so a local copy that drifted from
  // it would ask one category's questions and file the listing under another.
  const controlledCategory = options.category;
  const effectiveValues: ListingDraftValues = useMemo(
    () => ({
      ...values,
      images,
      ...(controlledCategory !== undefined
        ? { categoryId: controlledCategory }
        : {}),
    }),
    [values, images, controlledCategory]
  );

  const featuresDto = useMemo(
    () => toFeaturesDto(options.features, effectiveValues.features),
    [options.features, effectiveValues.features]
  );

  const mirror = useMemo(
    () =>
      mirrorDraft(
        effectiveValues,
        options.features,
        featuresDto,
        runtime.limits
      ),
    [effectiveValues, options.features, featuresDto, runtime.limits]
  );

  // A `ref_select` whose vocabulary source the host never wired up is exactly
  // as undrawable as a type with no editor: the control renders and cannot be
  // answered. It therefore reaches the publish gate through the SAME channel
  // (`unsupportedTypes`) rather than a second one — one fact, one sentence.
  // Read from context, so a host wires `VocabularyClientProvider` once around
  // the composer and nothing else changes.
  const vocabularyClient = useVocabularyClient();
  const unsupported = useMemo(
    () => unsupportedTypes(options.features, options.editorTypes ?? [], { vocabularyClient }),
    [options.features, options.editorTypes, vocabularyClient]
  );

  const isLiveEdit = existing.data?.status === "published";
  // Narrowed to the fallback case: the draft-twin read did not land (see the
  // seeding effect above), and the published half is empty too, so there is
  // truly nothing to show. A build on stapel-listings 0.21.1+ only reaches
  // this when the row has genuinely never been saved into.
  const draftNotReadable =
    existing.data !== undefined &&
    existing.data.status !== "published" &&
    listingDraft.status !== "success" &&
    (existing.data.title ?? "").length === 0 &&
    (existing.data.description ?? "").length === 0;

  // A save-draft/create 400 names its field in the envelope rather than in a
  // batch, so it takes the other door onto the same routing table. Without it
  // the composer painted a banner and left every control clean — the person
  // was told something was wrong and not what (blocker C2).
  const saveThrown: unknown = saveDraft.error ?? createDraft.error;
  const fieldErrors: Readonly<Record<string, FlowError>> = useMemo(() => {
    const shown = showErrors ? mirror : {};
    const routed =
      refusal?.kind === "invalid_draft"
        ? refusal.fieldErrors
        : refusal?.kind === "error"
          ? envelopeFieldErrors(refusal.error)
          : {};
    return { ...shown, ...envelopeFieldErrors(saveThrown), ...routed };
  }, [showErrors, mirror, refusal, saveThrown]);

  // The order is the FORM's, not the record's — see `LISTING_FIELD_ORDER`.
  // A key in neither list (a server field with no control of its own) is still
  // named rather than dropped: something is refusing, and saying which is
  // better than saying nothing.
  const firstUnsatisfied: string | undefined = useMemo(() => {
    const refused = mirror;
    for (const field of LISTING_FIELD_ORDER) {
      if (refused[field] !== undefined) return field;
    }
    for (const feature of options.features) {
      if (refused[feature.slug] !== undefined) return feature.slug;
    }
    return Object.keys(refused)[0];
  }, [mirror, options.features]);

  const listingState: LoadState<ListingDetailData> | undefined =
    options.listingId === undefined
      ? undefined
      : existing.status === "error"
        ? loadFailed(existing.error)
        : existing.data !== undefined
          ? loadReady(existing.data)
          : loadLoading();

  const busy = createDraft.isPending || saveDraft.isPending;

  const schemaGate: ActionAvailability =
    options.featuresError !== undefined
      ? actionBlocked(LISTINGS_I18N_KEYS.composeBlockedDetailsUnavailable)
      : options.featuresLoading === true
        ? actionBlocked(LISTINGS_I18N_KEYS.composeDetailsLoading)
        : actionAvailable();

  const categoryGate: ActionAvailability =
    effectiveValues.categoryId.length > 0
      ? actionAvailable()
      : actionBlocked(LISTINGS_I18N_KEYS.composeBlockedNoCategory);

  const busyGate: ActionAvailability = busy
    ? actionBlocked(LISTINGS_I18N_KEYS.composeBlockedBusy)
    : actionAvailable();

  // NO `categoryGate` here (D261). A draft is allowed to exist without a
  // category — stapel-listings 0.21.4 made `category_id` nullable on the draft
  // half and `save-draft` accepts a body without one — and holding the SAVE
  // until a category was picked meant the row did not exist during the step
  // before it. Everything addressed BY the draft id (an analysis job handed
  // the id, an upload filed against it, a resumable link) therefore had no id
  // to be addressed by, and the work never started. The category is still
  // mandatory to PUBLISH, which is the gate below and the server's own
  // `publish_validation_failed`.
  const saveGate = firstBlock(mandate, busyGate);

  // The publish gate is the save gate PLUS everything that must be true for a
  // submission to be complete. Order is the order a person would be told:
  // may you act at all → is the form even answerable → are the photos in →
  // is the form itself clean.
  const publishGate = firstBlock(
    mandate,
    categoryGate,
    schemaGate,
    // The type names (`size_grid`) are this build's vocabulary, not copy: a
    // seller can act on "finish it somewhere else", never on the identifier.
    unsupported.length > 0
      ? actionBlocked(LISTINGS_I18N_KEYS.composeBlockedUnsupportedType)
      : actionAvailable(),
    options.images?.settled ?? actionAvailable(),
    busyGate,
    publishListing.isPending
      ? actionBlocked(LISTINGS_I18N_KEYS.composeBlockedBusy)
      : actionAvailable(),
    // "Fix the highlighted fields first" is only true once something IS
    // highlighted — the mirror reaches the fields only after `showErrors`.
    // Before that the same block has to say what is actually missing.
    Object.keys(mirror).length > 0
      ? actionBlocked(
          showErrors
            ? LISTINGS_I18N_KEYS.composeBlockedMirror
            : LISTINGS_I18N_KEYS.composeBlockedIncomplete,
          showErrors ? undefined : { count: Object.keys(mirror).length }
        )
      : actionAvailable()
  );

  /**
   * Create the row on demand: the id is what every other write needs.
   *
   * Created REGARDLESS of the category (D261). The create body carries the
   * category when there is one and is `{}` when there is not — both are valid
   * to `POST /listings/` since 0.21.4 — so the earliest save any surface makes
   * produces an id, and a category picked afterwards is written by the next
   * `save-draft` like any other field.
   */
  const ensureListingId = useCallback(async (): Promise<number | undefined> => {
    if (listingId !== undefined && listingId > 0) return listingId;
    const draft = await createDraft.mutateAsync(
      createDraftBody(effectiveValues.categoryId)
    );
    setListingId(draft.id);
    options.onDraftCreated?.(draft);
    return draft.id;
  }, [listingId, effectiveValues.categoryId, createDraft, options]);

  const persist = useCallback(async (): Promise<number | undefined> => {
    const id = await ensureListingId();
    if (id === undefined) return undefined;
    // The id comes from `ensureListingId`, not from this closure's render:
    // creating the row and saving into it happen in ONE gesture, and the
    // state update that records the new id has not committed yet.
    await saveDraft.mutateAsync({
      id,
      body: draftPatchFromValues(effectiveValues, options.features),
    });
    setSaved(true);
    return id;
  }, [ensureListingId, saveDraft, effectiveValues, options.features]);

  const save = useCallback((): void => {
    // Deliberately NOT arming `showErrors` here (D54): saves are
    // housekeeping — the flat page saves on every blur and the staged
    // composer on every step change — and a draft is allowed to be
    // incomplete; that is what a draft is. Arming the mirror on save meant
    // red "field is required" lines under untouched fields before the
    // person's first keystroke. The mirror reaches the fields on the SUBMIT
    // ATTEMPT: `publish()` below.
    if (!saveGate.available) return;
    setRefusal(undefined);
    void persist().catch(() => {
      // The mutation's own `error` carries it; swallowing the rejection here
      // only stops an unhandled-rejection warning for a failure the bag
      // already reports.
    });
  }, [saveGate.available, persist]);

  // `save` through a ref, so the effect below can run the CURRENT one without
  // re-firing every time the form changes shape.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (saveRequest === 0) return;
    saveRef.current();
  }, [saveRequest]);

  const saveSoon = useCallback((): void => {
    setSaveRequest((current) => current + 1);
  }, []);

  const publish = useCallback((): void => {
    setShowErrors(true);
    if (!publishGate.available) return;
    setRefusal(undefined);
    void (async () => {
      try {
        // Always save first: publish reads the STORED draft, so publishing
        // without saving would promote whatever was there before the last
        // keystroke — and the person would be told their listing is fine
        // while a field they just fixed is still wrong on the server.
        const id = await persist();
        if (id === undefined) return;
        const response = await publishListing.mutateAsync(id);
        const result: PublishOutcome =
          response.status === "published"
            ? "live_edit_under_review"
            : "submitted_for_review";
        setOutcome(result);
        options.onPublished?.(response, result);
      } catch (thrown) {
        setRefusal(publishRefusal(thrown));
      }
    })();
  }, [publishGate.available, persist, publishListing, options]);

  const stage: ComposeStage =
    outcome !== undefined
      ? "published"
      : publishListing.isPending
        ? "publishing"
        : busy
          ? "saving"
          : effectiveValues.categoryId.length === 0
            ? "choosing_category"
            : "editing";

  return {
    stage,
    listingId,
    values: effectiveValues,
    listingState,
    isLiveEdit,
    draftNotReadable,

    setValue: (key, value) => {
      setSaved(false);
      setValues((current) => ({ ...current, [key]: value }));
    },
    setLocation: (location) => {
      setSaved(false);
      setValues((current) => ({ ...current, location }));
    },
    setFeature: (slug, value) => {
      setSaved(false);
      setValues((current) => ({
        ...current,
        features: { ...current.features, [slug]: value },
      }));
    },
    setCategory: (categoryId) => {
      setSaved(false);
      // Told upwards FIRST and unconditionally: the container's schema read is
      // keyed by this id, and it must be asked for even when the composer is
      // uncontrolled — that is the wire `features` arrives on.
      options.onCategoryChange?.(categoryId);
      if (controlledCategory === undefined) {
        setValues((current) => {
          if (current.categoryId === categoryId) return current;
          // The features of the NEW category are not known yet (the
          // container's schema read has not run), so nothing is pruned here —
          // pruning happens in the effect below, once they arrive. Recording
          // the intent, not guessing the outcome.
          return { ...current, categoryId };
        });
      }
      setDropped([]);
      setRefusal(undefined);
    },
    droppedOnCategoryChange: dropped,

    mirror,
    fieldErrors,
    refusal,
    firstUnsatisfied,
    unsupported,

    saveGate,
    publishGate,
    save,
    saveSoon,
    publish,
    saving: busy,
    publishing: publishListing.isPending,
    saved,
    saveError: saveThrown,
    outcome,
  };
}

/** Renderless: the bag, handed to a render prop. */
export function ListingComposer(
  props: UseListingComposerOptions & {
    children: (bag: ListingComposerBag) => ReactNode;
  }
): ReactElement {
  const bag = useListingComposer(props);
  return <>{props.children(bag)}</>;
}
