/**
 * `<ListingComposerPage>` — the submission screen.
 *
 * Five contracts meet on this page and each arrives through its own seam, so
 * the component can be read top to bottom without knowing any of the other
 * pairs:
 *
 *   category   `renderCategoryPicker` — the container's `<CategoryPickerField>`,
 *                                given `setCategory` to call
 *   where      `locationPicker`  — the container's `<LocationField>`
 *                                (`@stapel/geo-react`)
 *   currency   `renderCurrencyPicker` — whatever vocabulary the deployment sells in
 *   details    `features`      — the schema, drawn by `<FeatureFields>` (L0)
 *   photos     `gallerySlot`   — the container's `<MediaGalleryField bag>`,
 *                                whose bag is handed here as `images`
 *   the draft  this pair
 *
 * ── An unfilled slot is NAMED, never improvised ────────────────────────────
 *
 * Every one of those four slots used to degrade into a control this pair could
 * write on its own, and every one of those controls asked a question no seller
 * can answer: a numeric category id typed into a text box, a currency CODE
 * typed into a text box, and — the defect the owner named — two decimal boxes
 * labelled Latitude and Longitude. A gallery heading with nothing under it was
 * the same defect with the improvisation left out.
 *
 * So an unfilled slot renders `<SlotPlaceholder name="…"/>`: a labelled dashed
 * region in a dev build, nothing at all in production. The rule is the one the
 * rest of this codebase already lives by — `matchList`'s required empty arm,
 * `ActionAvailability` with no "disabled for unknown reasons", `LoadState`
 * refusing to fold failed into empty. A slot was the last place absence could
 * still be silent, and `stapel/no-silent-slot` now says so at lint time.
 *
 * ── …and its LABEL goes with it ────────────────────────────────────────────
 *
 * The placeholder is nothing in production — but the `Form.Item` around it
 * still drew its label, so a production composer with three unfilled slots
 * rendered three labelled voids: "Category", "Currency", "Where it is" over
 * empty space, and a "Photos" heading over air. A label is a promise that a
 * control follows it. {@link SlotField} therefore renders the WHOLE field —
 * label, help text and control — or nothing at all, and the `Photos` section
 * does the same with its heading. `slotVisibility` pins the dev view on so a
 * production-built showcase can still photograph the named placeholders.
 *
 * ── Why the pickers are slots and not dependencies ─────────────────────────
 *
 * A category tree, a geocoder and a currency vocabulary are all DEPLOYMENT
 * knowledge, and all three live in sibling L2 pairs
 * (`@stapel/categories-react`, `@stapel/geo-react`, the host's own). L2 pairs
 * do not import each other; the container is the seam. A library that picked
 * one would pick it for every host.
 *
 * ── The SECTION ORDER is this component's, and it is not a prop ────────────
 *
 * One order, at every width:
 *
 *   category → title → description → price → currency → where → photos →
 *   the category's characteristics → the listing's own options
 *
 * The category comes first because everything after it depends on the choice.
 * Then the five questions a seller came to answer — what it is, what it says,
 * what it costs, where it is, what it looks like — and only then the questions
 * the CATEGORY asks.
 *
 * This used to be two orders chosen by the form's width, and the narrow one
 * put the characteristics directly under the category. The reason was real:
 * measured on a live classified deployment, Mobile phones put the first
 * attribute control at y=1596, two viewports below the fold, while the footer
 * said "10 required details not filled in" with none of them on screen. The
 * fix was not: the same leaf carries 32 imported fields, so on the next
 * measurement of the same form the seller was asked for the parcel's weight,
 * its length and "what the goods are measured in" BEFORE the title — title
 * y=5575, price y=5871, photos y=6245, of a 7308px form. A composer that asks
 * about postage before it asks what is being sold has no funnel left.
 *
 * So the discoverability problem is solved where it actually lives, and by two
 * things that do not move the questions around:
 *
 *  - the count of unfilled details is a CONTROL that goes to the first of them
 *    (`listings-composer-goto-missing`, below), so "10 required details" is
 *    never a dead end wherever the region sits;
 *  - the region itself is short, because `groupCollapse="auto"` opens the
 *    groups that ask something required and leaves the plumbing (delivery
 *    dimensions, wholesale terms) closed under its own heading.
 *
 * `detailsPlacement` is therefore gone as a decision — `data-placement` stays
 * on the region as a constant, because an e2e that measured the regression
 * needs something to read that is not a pixel count. A host that wants a
 * different order does not want this page; it wants `<FeatureFields>` and its
 * own form, which is exactly why that component is exported separately.
 *
 * ── Every blocked control says which of six reasons it is ──────────────────
 *
 * The publish button is the most-gated control in the fleet, and that is the
 * point: "sign in", "choose a category", "we could not load what this
 * category asks for", "this build cannot draw one of these details", "wait
 * for the photos", "fix the highlighted fields" are six different problems
 * with six different next actions. `firstBlock` orders them the way a person
 * would be told, and `<GatedButton>` renders the reason beside the button —
 * never a grey rectangle, never a hover.
 */
import type { ComponentType, ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Typography,
} from "antd";
import {
  ErrorAlert,
  GatedButton,
  PaneGate,
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import {
  SlotPlaceholder,
  actionAvailable,
  isDevBuild,
  useDescribeFlowError,
  useI18n,
  useT,
} from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  BUILTIN_VALUE_EDITOR_TYPES,
  FeatureFields,
  featureControlId,
} from "@stapel/attributes-react/default";
import { useListingComposer } from "../headless/ListingComposer.js";
import type { ListingLocation } from "../model/draft.js";
import type { ListingImagesBag } from "../headless/ListingComposer.js";
import {
  CATEGORY_FIELD,
  DESCRIPTION_FIELD,
  IMAGES_FIELD,
  LOCATION_FIELD,
  PRICE_FIELD,
  TITLE_FIELD,
  envelopeFieldErrors,
  failedResults,
} from "../model/validation.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import type { ThemeModeProp } from "./types.js";

/**
 * A form is read in one column, and a column has a width past which the eye
 * loses the line — the reason a 2560px pane once rendered a 1640px Title box.
 * A measure, not a pixel guess: `ch` scales with the type the theme is set to.
 */
export const COMPOSER_MEASURE = "44rem";

/**
 * What `data-placement` says on the characteristics region.
 *
 * A constant, and deliberately so: the order is the composer's and does not
 * depend on the width any more (see the header). The attribute stays because
 * an e2e suite measured the regression through it and needs a reading that is
 * not a pixel count.
 */
export const COMPOSER_DETAILS_PLACEMENT = "after-core-fields";

/**
 * The DOM id of the control that answers one of the composer's own fields —
 * the names `mirrorListingFields` refuses by (`title`, `description`, …).
 *
 * A person told "10 required details are still empty" needs to be taken to
 * one, and taking them there needs an ADDRESS. Features already have one
 * (`featureControlId`); the composer's own fields had none, and a test id is
 * not an address — it is a test's handle, and reaching for it in product code
 * makes every test id load-bearing.
 */
export function composerFieldId(field: string): string {
  return `listings-composer-field-${field}`;
}

/** What counts as a control a person can be put in front of. A slot's control
 * belongs to the container, so the field is asked for its first focusable
 * descendant rather than assumed to be an `<input>`. */
const FOCUSABLE =
  "input,select,textarea,button,[href],[tabindex]:not([tabindex='-1'])";

/**
 * Put the person in front of one field: open whatever it is folded inside,
 * bring it into view, and focus what they are meant to answer.
 *
 * The disclosure step is the one that is easy to forget. A characteristic
 * lives in a `<details>` section that may be closed (`groupCollapse="auto"`),
 * and scrolling to a control inside a closed disclosure scrolls to nothing —
 * the "take me to the first empty field" button would report success and move
 * the page nowhere. Any depth of nesting is opened, because the answer to
 * "where is it" must not depend on how the section was drawn.
 *
 * The rest is guarded rather than assumed. `scrollIntoView` does not exist in
 * every environment this renders in (jsdom, older embedded engines), and a
 * field whose control came from a slot may have nothing focusable in it at
 * all — in which case scrolling to it is still the whole of the help that can
 * honestly be given.
 */
function revealField(id: string): void {
  if (typeof document === "undefined") return;
  const anchor = document.getElementById(id);
  if (anchor === null) return;
  for (
    let folded = anchor.closest("details");
    folded !== null;
    folded = folded.parentElement?.closest("details") ?? null
  ) {
    folded.open = true;
  }
  if (typeof anchor.scrollIntoView === "function") {
    anchor.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  const control = anchor.matches(FOCUSABLE)
    ? anchor
    : anchor.querySelector<HTMLElement>(FOCUSABLE);
  control?.focus();
}

/**
 * What `renderCategoryPicker` is handed: the current category and the ONLY
 * function that changes it. Same shape as any other bag in this monorepo — the
 * value plus the setter, never a setter alone.
 */
export interface ComposerCategorySlot {
  /** The category the draft currently carries. Empty string: none chosen. */
  readonly value: string;
  /** Choose a category. Prunes the answers the new schema does not ask for
   * (one render later, once `features` arrives) and reports upwards. */
  readonly setCategory: (categoryId: string) => void;
}

/**
 * What `renderCurrencyPicker` is handed: the code the draft carries and the
 * one function that changes it.
 *
 * The vocabulary is not this pair's: `Listing.currency` is a free
 * `maxLength: 8` string on the wire (stapel-listings has no currency enum —
 * the list lives in stapel-currencies), so the pair holds a DEFAULT from
 * `createListingsRuntime` and asks the container for a chooser. Unfilled, the
 * price field simply states which currency it is in.
 */
export interface ComposerCurrencySlot {
  /** ISO-4217-ish code, e.g. `"RUB"`. Never empty — the runtime's default. */
  readonly value: string;
  readonly setCurrency: (code: string) => void;
}

/**
 * What a location picker component is handed — the contract
 * `@stapel/geo-react`'s `<LocationField>` was built to fill.
 *
 * `{ value, onChange }`, and `value` is the pin plus the address a resolver
 * found for it. `lat`/`lon` are NUMBERS here (a picker works in numbers) while
 * the draft keeps decimal STRINGS, because a float round-trips `55.796100`
 * into `55.7961` and changes what was submitted; the conversion happens in
 * this component, once, at the seam.
 *
 * Geo-react's own props are `value?: LatLon` and
 * `onChange?: (picked: PickedLocation) => void`, so the adapter a container
 * writes is three lines and no state:
 *
 * ```tsx
 * import { LocationField } from "@stapel/geo-react/default";
 *
 * <ListingComposerPage
 *   locationPicker={({ value, onChange }) => (
 *     <LocationField
 *       {...(value.lat !== null && value.lon !== null
 *         ? { value: { point: { lat: value.lat, lon: value.lon },
 *                      ...(value.address !== undefined
 *                        ? { address: value.address } : {}) } }
 *         : {})}
 *       onChange={(picked) => {
 *         onChange({ lat: picked.point.lat, lon: picked.point.lon,
 *                    address: picked.address ?? undefined });
 *       }}
 *     />
 *   )}
 * />
 * ```
 *
 * `LocationField` and not `LocationPickerField`, and the difference is the
 * whole reason this slot exists. The older component is a BUTTON — "Choose on
 * the map" — that prints its answer underneath itself, so a form the person
 * has filled in goes on looking empty and the question names the mechanism
 * rather than the thing being asked. `LocationField` is a field: it states
 * the question while empty and holds the chosen place inside itself once it
 * is not, and one tap runs the whole ladder behind it — the permission
 * pre-prompt before the browser's one-shot prompt, the server's IP guess when
 * that is refused, then the map. Either component fits this contract; only
 * one of them looks like an answer to "where is it?".
 *
 * `geohash` is absent from this contract on purpose: since stapel-listings
 * 0.7.1 the server computes it from the coordinates and ignores anything sent
 * in the body, so a picker that has one has nowhere to put it and no reason
 * to try (`model/draft.ts`).
 */
export interface ComposerLocationValue {
  /** Decimal degrees, or `null` when no place has been chosen yet. */
  readonly lat: number | null;
  readonly lon: number | null;
  /** The one-line label a person reads: "Kazan, Vahitovsky district". */
  readonly address?: string;
}

export interface ComposerLocationPickerProps {
  readonly value: ComposerLocationValue;
  readonly onChange: (next: ComposerLocationValue) => void;
}

/**
 * The lower-level location seam: the WHOLE draft composite, and the `save`
 * the plain fields call on blur.
 *
 * Kept beside {@link ComposerLocationPickerProps} for a host whose picker
 * also resolves a `location_id` out of its own place directory — the id is
 * this pair's wire field and no generic picker knows about it. A container
 * that only has a pin and an address wants `locationPicker` instead.
 */
export interface ComposerLocationSlot {
  /** The location the draft currently carries. */
  readonly value: ListingLocation;
  /** Write the whole composite. `geohash` is read-only on the wire (0.7.1) —
   * whatever is written here is kept for display and never sent. */
  readonly setLocation: (location: ListingLocation) => void;
  /**
   * Persist the draft now. The plain fields save on blur, and a picker has no
   * blur to speak of: choosing a suggestion IS the commit, so the slot is
   * handed the same `save` those fields call rather than being left to hope
   * the next unrelated blur carries its value.
   */
  readonly save: () => void;
}

export interface ListingComposerPageProps extends ThemeModeProp {
  /** Editing an existing listing; absent for a new one. */
  readonly listingId?: number;
  /** The chosen category's features — from `@stapel/categories-react` via the
   * container (L2 pairs do not import each other). */
  readonly features: readonly FeatureDef[];
  readonly featuresLoading?: boolean;
  readonly featuresError?: unknown;
  /**
   * The category chooser, handed the value and the setter. This is the slot a
   * container fills with `@stapel/categories-react`'s `<CategoryPickerField>`:
   *
   * ```tsx
   * renderCategoryPicker={({ value, setCategory }) => (
   *   <CategoryPickerField
   *     value={value === "" ? null : Number(value)}
   *     onChange={(id) => setCategory(id === null ? "" : String(id))}
   *   />
   * )}
   * ```
   *
   * Unfilled: a named placeholder. The composer will NOT ask a person to type
   * a category id.
   */
  readonly renderCategoryPicker?: (slot: ComposerCategorySlot) => ReactNode;
  /**
   * The chosen category, when the container owns that state — the usual case,
   * since the same id keys the `features` read.
   */
  readonly category?: string;
  /** Called whenever the category changes, controlled or not. */
  readonly onCategoryChange?: (categoryId: string) => void;
  /**
   * The currency chooser. Unfilled, the price field states the deployment's
   * currency and nothing asks the seller to type a code.
   */
  readonly renderCurrencyPicker?: (slot: ComposerCurrencySlot) => ReactNode;
  /**
   * WHERE the thing is, asked the host's way — the slot
   * `@stapel/geo-react`'s `<LocationField>` fills (see
   * {@link ComposerLocationPickerProps} for the adapter, and for why the
   * field beats the older button).
   *
   * Unfilled: a named placeholder. The composer will NOT fall back to two
   * decimal boxes — a seller does not know their latitude, and those boxes
   * were the only reason `location` was ever left empty on this fleet.
   */
  readonly locationPicker?: ComponentType<ComposerLocationPickerProps>;
  /**
   * The whole-composite form of the same seam, for a picker that also resolves
   * this pair's `location_id`. Wins over `locationPicker` when both are given.
   */
  readonly renderLocationPicker?: (slot: ComposerLocationSlot) => ReactNode;
  /** The photo grid — `@stapel/cdn-react`'s `<MediaGalleryField bag>`. Its bag
   * is what `images` carries. Unfilled: a named placeholder, not a heading
   * over nothing. */
  readonly gallerySlot?: ReactNode;
  /** `useUploadQueue()`'s bag from `@stapel/cdn-react` — `refs` becomes
   * `images_draft`, `settled` gates the submit. */
  readonly images?: ListingImagesBag;
  /**
   * Whether an unfilled slot shows its named placeholder. `"auto"` (default)
   * follows the build: named in development, the whole field absent in
   * production. `"visible"` pins it on — for a showcase built in production
   * mode, which is the only way to photograph an integration defect.
   */
  readonly slotVisibility?: "auto" | "visible";
  readonly onPublished?: (listingId: number) => void;
}

/**
 * A labelled field whose control comes from a slot — or NOTHING.
 *
 * The composer's orphan-field bug in one component: a `Form.Item` renders its
 * label unconditionally, so an unfilled slot (which is `null` in a production
 * build) left the label standing over empty space. Here the label and the
 * control are one decision. `named` says whether the dev placeholder will
 * draw; when it will not and the host filled nothing, the field is not part of
 * the form at all.
 */
function SlotField(props: {
  readonly label: string;
  readonly extra?: string;
  readonly slot: string;
  readonly named: boolean;
  readonly control: ReactNode | undefined;
  readonly status: { help: ReactNode; validateStatus: "error" } | Record<string, never>;
  readonly testId: string;
  /** The address `revealField` aims at — see {@link composerFieldId}. */
  readonly anchorId: string;
}): ReactElement | null {
  const filled = props.control !== undefined;
  if (!filled && !props.named) return null;
  // A refusal REPLACES the hint rather than stacking under it. "Choose a
  // category — the rest of the form depends on it" and "a category is
  // required" are one fact printed twice, one line apart, and the second is
  // the one the person just earned.
  const refused = "validateStatus" in props.status;
  return (
    <Form.Item
      label={props.label}
      {...(props.extra !== undefined && !refused ? { extra: props.extra } : {})}
      {...props.status}
    >
      <div id={props.anchorId} data-testid={props.testId}>
        {props.control ?? <SlotPlaceholder name={props.slot} visibility="visible" />}
      </div>
    </Form.Item>
  );
}

/** Did this refusal land on a control? Then the control is where it is read. */
function routedToAControl(thrown: unknown): boolean {
  return Object.keys(envelopeFieldErrors(thrown)).length > 0;
}

/** A decimal string → the number a picker works in, or `null`. */
function toNumber(value: string | null): number | null {
  if (value === null || value.length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ListingComposerPage(
  props: ListingComposerPageProps
): ReactElement {
  const t = useT();
  const { locale } = useI18n();
  const describe = useDescribeFlowError();
  const bag = useListingComposer({
    ...(props.listingId !== undefined ? { listingId: props.listingId } : {}),
    features: props.features,
    // A new draft carries the language it was WRITTEN in, and the only honest
    // guess is the locale the composer is being read in. It was left empty and
    // the server's default decided instead — a Spanish seller filing a listing
    // stamped `ru` because that is the deployment default (gap L-9).
    language: locale,
    ...(props.featuresLoading !== undefined
      ? { featuresLoading: props.featuresLoading }
      : {}),
    ...(props.featuresError !== undefined
      ? { featuresError: props.featuresError }
      : {}),
    editorTypes: BUILTIN_VALUE_EDITOR_TYPES,
    ...(props.images !== undefined ? { images: props.images } : {}),
    ...(props.category !== undefined ? { category: props.category } : {}),
    ...(props.onCategoryChange !== undefined
      ? { onCategoryChange: props.onCategoryChange }
      : {}),
    ...(props.onPublished !== undefined
      ? {
          // `listing_id` comes back in the response, so the callback never
          // has to reach for a piece of state that may be one render behind.
          onPublished: (response) => {
            props.onPublished?.(response.listing_id);
          },
        }
      : {}),
  });

  /** Spread onto a `Form.Item`: the two props exist only when there IS a
   * refusal, which is what `exactOptionalPropertyTypes` asks for and what
   * keeps a clean field from rendering an empty help line. */
  const errorOf = (
    field: string
  ): { help: ReactNode; validateStatus: "error" } | Record<string, never> => {
    const error = bag.fieldErrors[field];
    if (error === undefined) return {};
    return { help: describe(error).message, validateStatus: "error" };
  };

  const publishLabel = t(
    bag.isLiveEdit
      ? LISTINGS_I18N_KEYS.composeRepublish
      : LISTINGS_I18N_KEYS.composePublish
  );

  const LocationPicker = props.locationPicker;

  /**
   * The characteristics of the chosen category — built once and rendered in
   * exactly one of two places, so neither arm can drift from the other.
   *
   * The four states are four different sentences, and the one that used to be
   * missing is the FIRST: with no category chosen there is no request in
   * flight and none will be made, so "loading the category's characteristics"
   * was simply untrue — a spinner-shaped sentence over a form that was waiting
   * for the person, not for the network.
   */
  const details = (
    <div
      data-testid="listings-composer-details"
      data-placement={COMPOSER_DETAILS_PLACEMENT}
    >
      <Divider />
      <Typography.Title level={5}>
        {t(LISTINGS_I18N_KEYS.composeDetails)}
      </Typography.Title>
      {props.featuresError !== undefined ? (
        <ErrorAlert
          testId="listings-composer-features-failed"
          message={t(LISTINGS_I18N_KEYS.composeDetailsFailed)}
        />
      ) : bag.values.categoryId.length === 0 ? (
        <Typography.Text
          type="secondary"
          data-testid="listings-composer-features-no-category"
        >
          {t(LISTINGS_I18N_KEYS.composeDetailsNoCategory)}
        </Typography.Text>
      ) : props.featuresLoading === true ? (
        <Typography.Text type="secondary" data-testid="listings-composer-features-loading">
          {t(LISTINGS_I18N_KEYS.composeDetailsLoading)}
        </Typography.Text>
      ) : props.features.length === 0 ? (
        <Typography.Text type="secondary" data-testid="listings-composer-features-empty">
          {t(LISTINGS_I18N_KEYS.composeDetailsEmpty)}
        </Typography.Text>
      ) : (
        <FeatureFields
          features={props.features}
          values={bag.values.features}
          errors={bag.fieldErrors}
          disabled={bag.publishing}
          onChange={bag.setFeature}
          // An imported leaf is mostly plumbing: 32 fields across seven
          // headings, four of them parcel dimensions. Open what is required or
          // already answered, leave the rest one tap away under its own
          // heading — see `FeatureGroupCollapse`.
          groupCollapse="auto"
        />
      )}
    </div>
  );

  // Where the "take me to it" control aims. A feature answers at its own
  // control id; everything else at the composer's.
  const missing = bag.firstUnsatisfied;
  const missingAnchor =
    missing === undefined
      ? undefined
      : props.features.some((feature) => feature.slug === missing)
        ? featureControlId(missing)
        : composerFieldId(missing);
  // Whether an unfilled slot draws its named placeholder — and therefore
  // whether the field it belongs to exists at all.
  const namedSlots = props.slotVisibility === "visible" || isDevBuild();

  return (
    <SkinTheme
      surface="base"
      style={{ maxWidth: COMPOSER_MEASURE, padding: spacing[4] }}
      {...(props.mode !== undefined ? { mode: props.mode } : {})}
    >
      <Flex
        vertical
        gap={spacing[4]}
        data-testid="listings-composer"
        data-stage={bag.stage}
      >
        <Typography.Title level={3}>
          {t(
            props.listingId === undefined
              ? LISTINGS_I18N_KEYS.composeNewTitle
              : LISTINGS_I18N_KEYS.composeEditTitle
          )}
        </Typography.Title>

        {/* stapel-listings 0.7.1 exposes no read of the `*_draft` twin, so a
            draft reopened in a new session comes back empty. Saying so beats
            a blank form that looks like lost work. */}
        {bag.draftNotReadable ? (
          <Alert
            type="warning"
            showIcon
            data-testid="listings-composer-draft-unreadable"
            title={t(LISTINGS_I18N_KEYS.composeBlockedNoDraft)}
          />
        ) : null}

        {bag.outcome !== undefined ? (
          <Alert
            type="success"
            showIcon
            data-testid="listings-composer-published"
            data-outcome={bag.outcome}
            title={t(
              bag.outcome === "live_edit_under_review"
                ? LISTINGS_I18N_KEYS.composePublishedLive
                : LISTINGS_I18N_KEYS.composePublishedFirst
            )}
          />
        ) : null}

        <Form layout="vertical" data-testid="listings-composer-form">
          <SlotField
            label={t(LISTINGS_I18N_KEYS.composeCategory)}
            extra={t(LISTINGS_I18N_KEYS.composeCategoryHelp)}
            slot="renderCategoryPicker"
            named={namedSlots}
            status={errorOf(CATEGORY_FIELD)}
            testId="listings-composer-category"
            anchorId={composerFieldId(CATEGORY_FIELD)}
            control={props.renderCategoryPicker?.({
              value: bag.values.categoryId,
              setCategory: bag.setCategory,
            })}
          />

          {bag.droppedOnCategoryChange.length > 0 ? (
            <Alert
              type="info"
              showIcon
              data-testid="listings-composer-dropped"
              title={t(LISTINGS_I18N_KEYS.composeCategoryChangedDropped, {
                count: bag.droppedOnCategoryChange.length,
              })}
            />
          ) : null}

          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composeTitleLabel)}
            {...errorOf(TITLE_FIELD)}
          >
            <Input
              id={composerFieldId(TITLE_FIELD)}
              value={bag.values.title}
              aria-label={t(LISTINGS_I18N_KEYS.composeTitleLabel)}
              data-testid="listings-composer-title"
              onChange={(event) => {
                bag.setValue("title", event.target.value);
              }}
              onBlur={bag.save}
            />
          </Form.Item>

          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composeDescriptionLabel)}
            {...errorOf(DESCRIPTION_FIELD)}
          >
            <Input.TextArea
              id={composerFieldId(DESCRIPTION_FIELD)}
              rows={5}
              value={bag.values.description}
              aria-label={t(LISTINGS_I18N_KEYS.composeDescriptionLabel)}
              data-testid="listings-composer-description"
              onChange={(event) => {
                bag.setValue("description", event.target.value);
              }}
              onBlur={bag.save}
            />
          </Form.Item>

          {/* Price and currency are ONE question, asked ONCE. The currency is
              not a text box: the vocabulary is the deployment's
              (stapel-currencies). With no chooser the code rides along as the
              field's addon so the price still says what it is in; with one,
              the addon would be a second currency control saying the same
              thing beside the first. */}
          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composePriceLabel)}
            {...errorOf(PRICE_FIELD)}
          >
            <Input
              id={composerFieldId(PRICE_FIELD)}
              inputMode="decimal"
              value={bag.values.price}
              {...(props.renderCurrencyPicker === undefined
                ? { addonAfter: bag.values.currency }
                : {})}
              aria-label={t(LISTINGS_I18N_KEYS.composePriceLabel)}
              data-testid="listings-composer-price"
              onChange={(event) => {
                bag.setValue("price", event.target.value);
              }}
              onBlur={bag.save}
            />
          </Form.Item>

          <SlotField
            label={t(LISTINGS_I18N_KEYS.composeCurrencyLabel)}
            slot="renderCurrencyPicker"
            named={namedSlots}
            status={{}}
            testId="listings-composer-currency"
            anchorId={composerFieldId("currency")}
            control={props.renderCurrencyPicker?.({
              value: bag.values.currency,
              setCurrency: (code) => {
                bag.setValue("currency", code);
                bag.saveSoon();
              },
            })}
          />

          {/* WHERE, asked once, by whoever can resolve places.
              A seller does not know their latitude — two decimal boxes are a
              question no advert-poster on any marketplace has ever been
              asked. This pair cannot ask for an ADDRESS on its own either:
              that needs a geocoder, and a geocoder is a deployment's
              (`@stapel/geo-react` over stapel-geo, on this fleet). So the
              question is a slot, and an unfilled slot says its own name
              instead of improvising a control nobody can use. */}
          <SlotField
            label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}
            extra={t(LISTINGS_I18N_KEYS.composeLocationHelp)}
            slot="locationPicker"
            named={namedSlots}
            status={errorOf(LOCATION_FIELD)}
            testId="listings-composer-location"
            anchorId={composerFieldId(LOCATION_FIELD)}
            control={
              props.renderLocationPicker !== undefined ? (
                <div data-testid="listings-composer-location-slot">
                  {props.renderLocationPicker({
                    value: bag.values.location,
                    setLocation: (location) => {
                      bag.setLocation(location);
                    },
                    save: bag.saveSoon,
                  })}
                </div>
              ) : LocationPicker !== undefined ? (
                <div data-testid="listings-composer-location-slot">
                  <LocationPicker
                    value={{
                      lat: toNumber(bag.values.location.lat),
                      lon: toNumber(bag.values.location.lon),
                      ...(bag.values.location.locationLabel.length > 0
                        ? { address: bag.values.location.locationLabel }
                        : {}),
                    }}
                    onChange={(next) => {
                      // Numbers in, decimal strings out — the wire's spelling,
                      // written at the seam so no other module has to know.
                      bag.setLocation({
                        ...bag.values.location,
                        lat: next.lat === null ? null : String(next.lat),
                        lon: next.lon === null ? null : String(next.lon),
                        locationLabel: next.address ?? "",
                      });
                      bag.saveSoon();
                    }}
                  />
                </div>
              ) : undefined
            }
          />

          {/* A heading is a promise that something follows it. With no gallery
              and no named placeholder there is nothing to head. */}
          {props.gallerySlot !== undefined || namedSlots ? (
            <>
              <Divider />
              <Typography.Title level={5}>
                {t(LISTINGS_I18N_KEYS.composePhotos)}
              </Typography.Title>
              <div id={composerFieldId(IMAGES_FIELD)}>
                {props.gallerySlot ?? (
                  <SlotPlaceholder name="gallerySlot" visibility="visible" />
                )}
              </div>
              {bag.fieldErrors[IMAGES_FIELD] ? (
                <Typography.Text type="danger" data-testid="listings-composer-images-error">
                  {describe(bag.fieldErrors[IMAGES_FIELD]).message}
                </Typography.Text>
              ) : null}
            </>
          ) : null}

          {/* The category's own questions, after the five the seller came to
              answer. See the header on why this is one order and not two. */}
          {details}

          <Divider />

          <Form.Item>
            <Checkbox
              checked={bag.values.countable}
              data-testid="listings-composer-countable"
              onChange={(event) => {
                bag.setValue("countable", event.target.checked);
              }}
            >
              {t(LISTINGS_I18N_KEYS.composeCountable)}
            </Checkbox>
          </Form.Item>

          {bag.values.countable ? (
            <Form.Item label={t(LISTINGS_I18N_KEYS.composeStock)}>
              <InputNumber
                min={0}
                value={bag.values.stockQuantity}
                aria-label={t(LISTINGS_I18N_KEYS.composeStock)}
                data-testid="listings-composer-stock"
                onChange={(value) => {
                  bag.setValue("stockQuantity", value ?? null);
                }}
              />
            </Form.Item>
          ) : null}

          <Form.Item>
            <Checkbox
              checked={bag.values.autoRepublish}
              data-testid="listings-composer-auto-republish"
              onChange={(event) => {
                bag.setValue("autoRepublish", event.target.checked);
              }}
            >
              {t(LISTINGS_I18N_KEYS.composeAutoRepublish)}
            </Checkbox>
          </Form.Item>
        </Form>

        {bag.refusal?.kind === "invalid_draft" ? (
          <ErrorAlert
            testId="listings-composer-invalid"
            message={t(LISTINGS_I18N_KEYS.composeInvalidSummary, {
              count: failedResults(bag.refusal.batch).length,
            })}
          />
        ) : null}

        {/* A refusal that reached a control is READ there, under the field
            the person can change. Repeating it as a banner — twice, since a
            publish saves the draft first and both failures are the same 400 —
            is how one refused coordinate painted two identical "Validation
            error" plaques and named nothing (blocker C2). The banner is for
            what has nowhere else to go. */}
        {bag.refusal?.kind === "error" && !routedToAControl(bag.refusal.error) ? (
          <ErrorAlert
            testId="listings-composer-error"
            error={describe({
              code: bag.refusal.error.code,
              params: bag.refusal.error.params,
              status: bag.refusal.error.status,
              message: bag.refusal.error.message,
              language: bag.refusal.error.language,
            })}
          />
        ) : null}

        {bag.saveError !== undefined &&
        bag.saveError !== null &&
        !routedToAControl(bag.saveError) ? (
          <ErrorAlert
            testId="listings-composer-save-error"
            thrown={bag.saveError}
          />
        ) : null}

        {/* One primary, and it LEADS. Two same-weight boxes side by side, the
            filled one second, is a footer with no primary in it — which is
            how it read on a phone, where the eye takes the first control as
            the action. `Save draft` is the quiet way out, so it is quiet.
            Each keeps its own reason directly under it, never a grey slab
            under the pair. */}
        {/* The footer is one SCOPE, so the reason both buttons are off is
            written once and both point at it. "Choose a category" under
            Publish and again under Save draft is one fact printed twice. */}
        <PaneGate gate={actionAvailable()} testId="listings-composer-footer">
        <Flex vertical gap={spacing[3]} align="flex-start">
          <GatedButton
            gate={bag.publishGate}
            type="primary"
            size="large"
            loading={bag.publishing}
            testId="listings-composer-publish"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={bag.publish}
          >
            {bag.publishing ? t(LISTINGS_I18N_KEYS.composePublishing) : publishLabel}
          </GatedButton>

          {/* A count with nowhere to go is a dead end: "10 required details
              are still empty" is printed by the gate above with not one of
              them on screen, because the attribute region starts below the
              fold. This is the way to the first of them — a real button, with
              its own accessible name, and not a click handler stuck on the
              sentence (which announces as text and cannot be tabbed to). It
              appears only while the gate is closed, so it never stands under
              a button that is ready to press. */}
          {!bag.publishGate.available && missingAnchor !== undefined ? (
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 0 }}
              data-testid="listings-composer-goto-missing"
              data-analytics="none"
              data-analytics-reason="navigation within the page — the host app wraps business actions with its own tracked()"
              onClick={() => {
                revealField(missingAnchor);
              }}
            >
              {t(LISTINGS_I18N_KEYS.composeShowFirstMissing)}
            </Button>
          ) : null}

          <Flex gap={spacing[3]} wrap align="flex-start">
            <GatedButton
              gate={bag.saveGate}
              type="text"
              loading={bag.saving}
              testId="listings-composer-save"
              data-analytics="none"
              data-analytics-reason="business action — host app wraps with its own tracked()"
              onClick={bag.save}
            >
              {t(bag.saving ? LISTINGS_I18N_KEYS.composeSaving : LISTINGS_I18N_KEYS.composeSave)}
            </GatedButton>

            {bag.saved ? (
              <Typography.Text type="success" data-testid="listings-composer-saved">
                {t(LISTINGS_I18N_KEYS.composeSaved)}
              </Typography.Text>
            ) : null}
          </Flex>
        </Flex>
        </PaneGate>
      </Flex>
    </SkinTheme>
  );
}
