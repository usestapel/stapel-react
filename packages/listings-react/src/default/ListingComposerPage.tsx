/**
 * `<ListingComposerPage>` — the submission screen.
 *
 * Five contracts meet on this page and each arrives through its own seam, so
 * the component can be read top to bottom without knowing any of the other
 * pairs:
 *
 *   category   `renderCategoryPicker` — the container's `<CategoryPickerField>`,
 *                                given `setCategory` to call
 *   where      `locationPicker`  — the container's `<LocationPickerField>`
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
 * ── Why the pickers are slots and not dependencies ─────────────────────────
 *
 * A category tree, a geocoder and a currency vocabulary are all DEPLOYMENT
 * knowledge, and all three live in sibling L2 pairs
 * (`@stapel/categories-react`, `@stapel/geo-react`, the host's own). L2 pairs
 * do not import each other; the container is the seam. A library that picked
 * one would pick it for every host.
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
  SkinTheme,
} from "@stapel/tokens-antd/skin";
import { SlotPlaceholder, useDescribeFlowError, useI18n, useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "@stapel/attributes-react";
import {
  BUILTIN_VALUE_EDITOR_TYPES,
  FeatureFields,
} from "@stapel/attributes-react/default";
import { useListingComposer } from "../headless/ListingComposer.js";
import type { ListingLocation } from "../model/draft.js";
import type { ListingImagesBag } from "../headless/ListingComposer.js";
import {
  CATEGORY_FIELD,
  DESCRIPTION_FIELD,
  IMAGES_FIELD,
  PRICE_FIELD,
  TITLE_FIELD,
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
 * `@stapel/geo-react`'s `<LocationPickerField>` was built to fill.
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
 * import { LocationPickerField } from "@stapel/geo-react/default";
 *
 * <ListingComposerPage
 *   locationPicker={({ value, onChange }) => (
 *     <LocationPickerField
 *       {...(value.lat !== null && value.lon !== null
 *         ? { value: { lat: value.lat, lon: value.lon } }
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
   * `@stapel/geo-react`'s `<LocationPickerField>` fills (see
   * {@link ComposerLocationPickerProps} for the three-line adapter).
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
  readonly onPublished?: (listingId: number) => void;
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
            message={t(LISTINGS_I18N_KEYS.composeBlockedNoDraft)}
          />
        ) : null}

        {bag.outcome !== undefined ? (
          <Alert
            type="success"
            showIcon
            data-testid="listings-composer-published"
            data-outcome={bag.outcome}
            message={t(
              bag.outcome === "live_edit_under_review"
                ? LISTINGS_I18N_KEYS.composePublishedLive
                : LISTINGS_I18N_KEYS.composePublishedFirst
            )}
          />
        ) : null}

        <Form layout="vertical" data-testid="listings-composer-form">
          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composeCategory)}
            extra={t(LISTINGS_I18N_KEYS.composeCategoryHelp)}
            {...errorOf(CATEGORY_FIELD)}
          >
            <div data-testid="listings-composer-category">
              {props.renderCategoryPicker !== undefined ? (
                props.renderCategoryPicker({
                  value: bag.values.categoryId,
                  setCategory: bag.setCategory,
                })
              ) : (
                <SlotPlaceholder name="renderCategoryPicker" />
              )}
            </div>
          </Form.Item>

          {bag.droppedOnCategoryChange.length > 0 ? (
            <Alert
              type="info"
              showIcon
              data-testid="listings-composer-dropped"
              message={t(LISTINGS_I18N_KEYS.composeCategoryChangedDropped, {
                count: bag.droppedOnCategoryChange.length,
              })}
            />
          ) : null}

          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composeTitleLabel)}
            {...errorOf(TITLE_FIELD)}
          >
            <Input
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

          {/* Price and currency are ONE question. The currency is not a text
              box: the vocabulary is the deployment's (stapel-currencies), so
              the code rides along as the field's addon and a container that
              lets the seller change it fills the slot beside it. */}
          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composePriceLabel)}
            {...errorOf(PRICE_FIELD)}
          >
            <Input
              inputMode="decimal"
              value={bag.values.price}
              addonAfter={bag.values.currency}
              aria-label={t(LISTINGS_I18N_KEYS.composePriceLabel)}
              data-testid="listings-composer-price"
              onChange={(event) => {
                bag.setValue("price", event.target.value);
              }}
              onBlur={bag.save}
            />
          </Form.Item>

          <Form.Item label={t(LISTINGS_I18N_KEYS.composeCurrencyLabel)}>
            <div data-testid="listings-composer-currency">
              {props.renderCurrencyPicker !== undefined ? (
                props.renderCurrencyPicker({
                  value: bag.values.currency,
                  setCurrency: (code) => {
                    bag.setValue("currency", code);
                    bag.saveSoon();
                  },
                })
              ) : (
                <SlotPlaceholder name="renderCurrencyPicker" />
              )}
            </div>
          </Form.Item>

          {/* WHERE, asked once, by whoever can resolve places.
              A seller does not know their latitude — two decimal boxes are a
              question no advert-poster on any marketplace has ever been
              asked. This pair cannot ask for an ADDRESS on its own either:
              that needs a geocoder, and a geocoder is a deployment's
              (`@stapel/geo-react` over stapel-geo, on this fleet). So the
              question is a slot, and an unfilled slot says its own name
              instead of improvising a control nobody can use. */}
          <Form.Item
            label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}
            extra={t(LISTINGS_I18N_KEYS.composeLocationHelp)}
            {...errorOf("location")}
          >
            <div data-testid="listings-composer-location">
              {props.renderLocationPicker !== undefined ? (
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
              ) : (
                <SlotPlaceholder name="locationPicker" />
              )}
            </div>
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>
            {t(LISTINGS_I18N_KEYS.composePhotos)}
          </Typography.Title>
          {props.gallerySlot ?? <SlotPlaceholder name="gallerySlot" />}
          {bag.fieldErrors[IMAGES_FIELD] ? (
            <Typography.Text type="danger" data-testid="listings-composer-images-error">
              {describe(bag.fieldErrors[IMAGES_FIELD]).message}
            </Typography.Text>
          ) : null}

          <Divider />

          <Typography.Title level={5}>
            {t(LISTINGS_I18N_KEYS.composeDetails)}
          </Typography.Title>
          {props.featuresError !== undefined ? (
            <ErrorAlert
              testId="listings-composer-features-failed"
              message={t(LISTINGS_I18N_KEYS.composeDetailsFailed)}
            />
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
            />
          )}

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

        {bag.refusal?.kind === "error" ? (
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

        {bag.saveError !== undefined && bag.saveError !== null ? (
          <ErrorAlert
            testId="listings-composer-save-error"
            thrown={bag.saveError}
          />
        ) : null}

        {/* Two buttons of two weights, each carrying its own reason. Publish is
            the primary and the only one; "Save draft" is the quiet way out. */}
        <Flex gap={spacing[3]} wrap align="flex-start">
          <GatedButton
            gate={bag.saveGate}
            loading={bag.saving}
            testId="listings-composer-save"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={bag.save}
          >
            {t(bag.saving ? LISTINGS_I18N_KEYS.composeSaving : LISTINGS_I18N_KEYS.composeSave)}
          </GatedButton>

          <GatedButton
            gate={bag.publishGate}
            type="primary"
            loading={bag.publishing}
            testId="listings-composer-publish"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={bag.publish}
          >
            {bag.publishing ? t(LISTINGS_I18N_KEYS.composePublishing) : publishLabel}
          </GatedButton>

          {bag.saved ? (
            <Typography.Text type="success" data-testid="listings-composer-saved">
              {t(LISTINGS_I18N_KEYS.composeSaved)}
            </Typography.Text>
          ) : null}
        </Flex>
      </Flex>
    </SkinTheme>
  );
}
