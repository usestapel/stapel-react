/**
 * `<ListingComposerPage>` — the submission screen.
 *
 * Four contracts meet on this page and each arrives through its own seam, so
 * the component can be read top to bottom without knowing any of the other
 * pairs:
 *
 *   category   `renderCategoryPicker` — the container's `<CategoryPickerField>`,
 *                                given `setCategory` to call
 *   details    `features`      — the schema, drawn by `<FeatureFields>` (L0)
 *   photos     `gallerySlot`   — the container's `<MediaGalleryField bag>`,
 *                                whose bag is handed here as `images`
 *   the draft  this pair
 *
 * ── Why the category slot is a render prop and not a node ──────────────────
 *
 * It was a node (`categorySlot`), and a node cannot be mounted: the composer's
 * category moves only through `bag.setCategory`, and a `ReactNode` handed in
 * from outside has no way to reach it. There was no `onCategoryChange`either,
 * so a container could neither set the category nor learn it — and `features`,
 * the schema of the chosen category, was therefore unreachable rather than
 * merely withheld. The screen could not be mounted at all (storefront Wave D,
 * named gap G-1).
 *
 * `renderCategoryPicker({ value, setCategory })` is the shape
 * `<CategoryPage renderListings>` already uses in the sibling pair, and the
 * controlled pair `category` / `onCategoryChange` is there for the container
 * that holds the id anyway — it must, because the schema read
 * (`useCategoryFeatures(id)`) that fills `features` is keyed by it.
 *
 * ── Every blocked control says which of six reasons it is ──────────────────
 *
 * The publish button is the most-gated control in the fleet, and that is the
 * point: "sign in", "choose a category", "we could not load what this
 * category asks for", "this build cannot draw one of these details", "wait
 * for the photos", "fix the highlighted fields" are six different problems
 * with six different next actions. `firstBlock` orders them the way a person
 * would be told, and the reason is rendered beside the button — never left
 * as a grey rectangle.
 */
import type { ReactElement, ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
} from "antd";
import { useDescribeFlowError, useT } from "@stapel/core";
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
import { ErrorAlert } from "./ErrorAlert.js";
import { ListingsSkinTheme } from "./theme.js";
import type { ThemeModeProp } from "./types.js";

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
 * What `renderLocationPicker` is handed: the whole location composite and the
 * one function that changes it.
 *
 * The value is the composite and not four scalars on purpose — `lat` without
 * `lon` is a broken location rather than half a location, and a `geohash` that
 * disagrees with the pin beside it is worse than none (model/draft.ts). A
 * picker that resolves a place has all four at once and writes them together.
 */
export interface ComposerLocationSlot {
  /** The location the draft currently carries. */
  readonly value: ListingLocation;
  /** Write the whole composite. `geohash` included — this pair will not
   * compute one, and a resolver that has it should not throw it away. */
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
   * @deprecated A node cannot reach `setCategory`, so a picker rendered into
   * this slot could never tell the composer what was chosen. Use
   * `renderCategoryPicker` (or the controlled `category` /
   * `onCategoryChange` pair). Still rendered, so nothing that passed it breaks.
   */
  readonly categorySlot?: ReactNode;
  /**
   * WHERE the thing is, asked the host's way. Omitted, the composer asks for a
   * label and a raw `lat`/`lon` pair — the only question it can ask on its
   * own, and one no seller can answer. Filled, it replaces both:
   *
   * ```tsx
   * renderLocationPicker={({ value, setLocation, save }) => (
   *   <AddressField value={value} onChange={setLocation} onCommit={save} />
   * )}
   * ```
   *
   * A geocoder is deployment knowledge (stapel-geo's `/geo/api/v1/geocoding/`
   * proxy, on this fleet), which is why it arrives as a slot rather than as a
   * dependency of this pair.
   */
  readonly renderLocationPicker?: (slot: ComposerLocationSlot) => ReactNode;
  /** The photo grid. Its bag is what `images` carries. */
  readonly gallerySlot?: ReactNode;
  /** `useUploadQueue()`'s bag from `@stapel/cdn-react` — `refs` becomes
   * `images_draft`, `settled` gates the submit. */
  readonly images?: ListingImagesBag;
  readonly onPublished?: (listingId: number) => void;
}

export function ListingComposerPage(
  props: ListingComposerPageProps
): ReactElement {
  const t = useT();
  const describe = useDescribeFlowError();
  const bag = useListingComposer({
    ...(props.listingId !== undefined ? { listingId: props.listingId } : {}),
    features: props.features,
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

  return (
    <ListingsSkinTheme {...(props.mode !== undefined ? { mode: props.mode } : {})}>
      <Flex vertical gap={16} data-testid="listings-composer" data-stage={bag.stage}>
        <Typography.Title level={3}>
          {t(
            props.listingId === undefined
              ? LISTINGS_I18N_KEYS.composeNewTitle
              : LISTINGS_I18N_KEYS.composeEditTitle
          )}
        </Typography.Title>

        {/* stapel-listings 0.6.1 exposes no read of the `*_draft` twin, so a
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
            {props.renderCategoryPicker !== undefined
              ? props.renderCategoryPicker({
                  value: bag.values.categoryId,
                  setCategory: bag.setCategory,
                })
              : (props.categorySlot ?? (
                  <Input
                    value={bag.values.categoryId}
                    aria-label={t(LISTINGS_I18N_KEYS.composeCategory)}
                    data-testid="listings-composer-category"
                    onChange={(event) => {
                      bag.setCategory(event.target.value);
                    }}
                  />
                ))}
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

          <Space align="start" wrap>
            <Form.Item
              label={t(LISTINGS_I18N_KEYS.composePriceLabel)}
              {...errorOf(PRICE_FIELD)}
            >
              <Input
                inputMode="decimal"
                value={bag.values.price}
                aria-label={t(LISTINGS_I18N_KEYS.composePriceLabel)}
                data-testid="listings-composer-price"
                onChange={(event) => {
                  bag.setValue("price", event.target.value);
                }}
                onBlur={bag.save}
              />
            </Form.Item>

            <Form.Item label={t(LISTINGS_I18N_KEYS.composeCurrencyLabel)}>
              <Input
                value={bag.values.currency}
                aria-label={t(LISTINGS_I18N_KEYS.composeCurrencyLabel)}
                data-testid="listings-composer-currency"
                onChange={(event) => {
                  bag.setValue("currency", event.target.value);
                }}
                onBlur={bag.save}
              />
            </Form.Item>
          </Space>

          {/* WHERE, asked once — as a place if the host can resolve places,
              as coordinates if it cannot.

              A seller does not know their latitude. Two decimal boxes are a
              question no advert-poster on any marketplace has ever been asked,
              and they are the only reason `location` was ever left empty on
              this fleet. But this pair cannot ask for an ADDRESS either: that
              needs a geocoder, a geocoder is a deployment's (stapel-geo,
              Photon, whatever the host runs), and a library that picked one
              would pick it for every host.

              So the question is a slot. `renderLocationPicker({ value,
              setLocation })` is the same shape as `renderCategoryPicker`
              above, and it carries the WHOLE composite — including `geohash`,
              which only the resolver can fill in and which this pair still
              refuses to compute (model/draft.ts says why). A host that fills
              it replaces both the label box and the coordinate pair, because
              a picker that resolves a place has already answered all four.

              Unfilled, the fields below are exactly what shipped before: the
              label, and the coordinates behind it. Nothing that worked stops
              working, and nothing here pretends a geocoder exists. */}
          {props.renderLocationPicker !== undefined ? (
            <Form.Item
              label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}
              {...errorOf("location")}
            >
              <div data-testid="listings-composer-location-slot">
                {props.renderLocationPicker({
                  value: bag.values.location,
                  setLocation: (location) => {
                    bag.setLocation(location);
                  },
                  save: bag.save,
                })}
              </div>
            </Form.Item>
          ) : (
            <>
              <Form.Item label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}>
                <Input
                  value={bag.values.location.locationLabel}
                  aria-label={t(LISTINGS_I18N_KEYS.composeLocationLabel)}
                  data-testid="listings-composer-location"
                  onChange={(event) => {
                    bag.setLocation({
                      ...bag.values.location,
                      locationLabel: event.target.value,
                    });
                  }}
                  onBlur={bag.save}
                />
              </Form.Item>

              {/* Latitude and longitude are ONE value: half a coordinate points
                  nowhere, and the mirror refuses it under `location`. `geohash`
                  is not typed here at all — it comes from whatever resolved the
                  place, because a geohash computed at a precision of our own
                  choosing would bucket the pin somewhere the indexer does not
                  expect (model/draft.ts). */}
              <Space align="start" wrap>
                <Form.Item
                  label={t(LISTINGS_I18N_KEYS.composeLatLabel)}
                  {...(bag.fieldErrors["location"] ? { validateStatus: "error" as const } : {})}
                >
                  <Input
                    inputMode="decimal"
                    value={bag.values.location.lat ?? ""}
                    aria-label={t(LISTINGS_I18N_KEYS.composeLatLabel)}
                    data-testid="listings-composer-lat"
                    onChange={(event) => {
                      bag.setLocation({
                        ...bag.values.location,
                        lat: event.target.value.length > 0 ? event.target.value : null,
                      });
                    }}
                    onBlur={bag.save}
                  />
                </Form.Item>
                <Form.Item
                  label={t(LISTINGS_I18N_KEYS.composeLonLabel)}
                  {...errorOf("location")}
                >
                  <Input
                    inputMode="decimal"
                    value={bag.values.location.lon ?? ""}
                    aria-label={t(LISTINGS_I18N_KEYS.composeLonLabel)}
                    data-testid="listings-composer-lon"
                    onChange={(event) => {
                      bag.setLocation({
                        ...bag.values.location,
                        lon: event.target.value.length > 0 ? event.target.value : null,
                      });
                    }}
                    onBlur={bag.save}
                  />
                </Form.Item>
              </Space>
            </>
          )}

          <Divider />

          <Typography.Title level={5}>
            {t(LISTINGS_I18N_KEYS.composePhotos)}
          </Typography.Title>
          {props.gallerySlot}
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
            <Alert
              type="error"
              showIcon
              data-testid="listings-composer-features-failed"
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
          <Alert
            type="error"
            showIcon
            data-testid="listings-composer-invalid"
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
            error={describe({
              code: LISTINGS_I18N_KEYS.unknownError,
              params: {},
              status: 0,
              message: undefined,
              language: undefined,
            })}
          />
        ) : null}

        <Space>
          <Button
            disabled={!bag.saveGate.available}
            loading={bag.saving}
            data-testid="listings-composer-save"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={bag.save}
          >
            {t(bag.saving ? LISTINGS_I18N_KEYS.composeSaving : LISTINGS_I18N_KEYS.composeSave)}
          </Button>

          <Button
            type="primary"
            disabled={!bag.publishGate.available}
            loading={bag.publishing}
            data-testid="listings-composer-publish"
            data-analytics="none"
            data-analytics-reason="business action — host app wraps with its own tracked()"
            onClick={bag.publish}
          >
            {bag.publishing ? t(LISTINGS_I18N_KEYS.composePublishing) : publishLabel}
          </Button>

          {bag.saved ? (
            <Typography.Text type="success" data-testid="listings-composer-saved">
              {t(LISTINGS_I18N_KEYS.composeSaved)}
            </Typography.Text>
          ) : null}
        </Space>

        {!bag.publishGate.available ? (
          <Typography.Text type="secondary" data-testid="listings-composer-publish-blocked">
            {t(bag.publishGate.block.code, bag.publishGate.block.params)}
          </Typography.Text>
        ) : null}
      </Flex>
    </ListingsSkinTheme>
  );
}
