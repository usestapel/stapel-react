/**
 * `<LocationPickerField/>` — the ONE component a product mounts.
 *
 * The owner opened a live product's listing composer and found two raw fields,
 * `latitude` and `longitude`. This is the pair that must exist so that never
 * happens again: mount this, and a form has a map, search-as-you-type, the
 * browser's position prompt, a pin that can be moved and the address that
 * followed it — with no product-specific code, and no lat/lon input anywhere.
 *
 * ## What it hands back
 *
 * `PickedLocation`: `{ point, geohash, address, resolution }`.
 *
 * `geohash` is `null` whenever the geocoder could not be reached — an
 * anonymous caller under the deployment's default permissions, a throttled
 * one, a 502 — and this pair does NOT compute one client-side to fill the
 * hole. The geohash is stamped server-side at the deployment's configured
 * `geohash_precision`, and a browser-side implementation would be a second,
 * unreconciled copy of that setting: two rows written by two code paths at two
 * precisions, indistinguishable afterwards. The COORDINATE is always real —
 * it is the person's own answer and never depended on the geocoder — so a
 * product always has something to store.
 *
 * ## The states, and which of them are failures
 *
 * `map/config` is the only call that must succeed. While it loads, a
 * placeholder of the map's exact shape holds the space, so nothing jumps.
 * If it FAILS there is no tile template, therefore no map: that is the one
 * state in which this component renders no map at all, and it says so and
 * offers a retry.
 *
 * Everything else is survivable and none of it hides the map:
 *
 *  - resolve → `resolving` / `resolved` / `nowhere` ("no address at this
 *    point, the coordinates are still saved" — a SUCCESSFUL call over the
 *    middle of a lake, never an error) / `refused` with one sentence per
 *    availability;
 *  - the browser's three refusals get their three distinct sentences, and the
 *    fourth (`unsupported`) removes the control instead of disabling it;
 *  - address search degrades on its own, inside `AddressSearchField`.
 *
 * ## Mobile first
 *
 * By default the picker opens in a `SkinDialog`, which is a bottom SHEET on a
 * phone and a centred modal on tablet/desktop. That rule lives in
 * `@stapel/tokens-antd/skin` and is not re-decided here (`stapel/no-bare-dialog`
 * forbids reaching for antd's `Modal`/`Drawer` directly from `src/default/**`).
 * Inside a sheet the map behaves: `SkinDialog`'s sheet is dragged from its
 * HEADER/handle only — verified in `tokens-antd/src/skin/dialog.tsx`, where
 * the pointer handlers are attached to `header` and nothing else — so the
 * map's own `touch-action: none` pan never fights drag-to-dismiss; the sheet
 * body already contains its scrolling (`overscrollBehavior: "contain"`) and
 * pads for `env(safe-area-inset-bottom)`.
 *
 * `mode="inline"` is the same body with no dialog around it, for a desktop
 * form column wide enough to hold a map in place. It is a prop rather than a
 * second exported component because a product should still mount ONE thing and
 * a responsive form should be able to flip it without a second import.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Typography, theme as antdTheme } from "antd";
import { matchLoad, useT } from "@stapel/core";
import { ErrorAlert, SkinDialog } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { GEO_I18N_KEYS } from "../i18n/keys.js";
import { useMapConfig } from "../model/queries.js";
import { useBrowserPosition } from "../headless/useBrowserPosition.js";
import { useLocationPicker } from "../headless/useLocationPicker.js";
import { usePlaceSearch } from "../headless/usePlaceSearch.js";
import type { PickedLocation } from "../headless/useLocationPicker.js";
import type { PositionOutcome } from "../headless/useBrowserPosition.js";
import type { LatLon } from "../model/coords.js";
import type { MapConfig, PlaceResolution } from "../api/types.js";
import { AddressSearchField, AVAILABILITY_KEYS } from "./AddressSearchField.js";
import { TileMap } from "./TileMap.js";
import { GeoSkinTheme } from "./theme.js";

/** The three refusals the browser can hand back that are worth a sentence.
 * `unsupported` is absent on purpose: there is nothing to say, because the
 * control is not rendered at all where the API does not exist. */
const POSITION_KEYS: Readonly<Record<Exclude<PositionOutcome, "unsupported">, string>> = {
  denied: GEO_I18N_KEYS.positionDenied,
  unavailable: GEO_I18N_KEYS.positionUnavailable,
  timeout: GEO_I18N_KEYS.positionTimeout,
};

/** Where the map opens when the deployment has no opinion and the caller
 * passed no value: the null island is a deliberate non-place, and the config's
 * `default_center` is what a real deployment sets. */
const NO_OPINION: LatLon = { lat: 0, lon: 0 };

/** `map/config.default_center` is `[lat, lon]` — NOT GeoJSON order. The one
 * field in this contract that looks like a coordinates array and is not. */
function centerOf(config: MapConfig, value: LatLon | undefined): LatLon {
  if (value !== undefined) return value;
  const declared = config.default_center;
  if (Array.isArray(declared) && declared.length >= 2) {
    const lat = declared[0];
    const lon = declared[1];
    if (typeof lat === "number" && typeof lon === "number") return { lat, lon };
  }
  return NO_OPINION;
}

export interface LocationPickerFieldProps {
  /** The point to start on. Omit for a fresh pick, and the deployment's
   * `default_center` decides. */
  readonly value?: LatLon;
  /**
   * The address already stored for {@link LocationPickerFieldProps.value} —
   * an edit form handing back the answer it saved.
   *
   * The picker then OPENS on that address instead of a blank confirmation
   * line, and does not re-ask the geocoder about a point it was just handed
   * the answer to. Ignored without a `value`, because an answer with no
   * question belongs to no pin. See `useLocationPicker`'s `initialResolution`
   * for why the redundant call is worth removing rather than tolerating.
   */
  readonly resolution?: PlaceResolution;
  /** Fires whenever the pin or its resolved address changes — the live value
   * for a form that saves as it goes. */
  readonly onChange?: (picked: PickedLocation) => void;
  /** Fires when the person presses "use this location". In `dialog` mode this
   * also closes the dialog. */
  readonly onConfirm?: (picked: PickedLocation) => void;
  /** `"dialog"` (default): a button that opens a bottom sheet on a phone and a
   * modal on tablet/desktop. `"inline"`: the picker in place, for a form
   * column that is wide enough. */
  readonly mode?: "dialog" | "inline";
  /** How many known `Location` rows to ask `resolve` for. 0 (default) does not
   * query the reference tree at all. */
  readonly nearest?: number;
  /** See `SearchQuery.lang` — leave unset. */
  readonly lang?: string;
  /** Height of the map box. */
  readonly height?: number | string;
  readonly "data-testid"?: string;
}

export function LocationPickerField(props: LocationPickerFieldProps): ReactElement {
  const t = useT();
  const config = useMapConfig();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<PickedLocation | undefined>(undefined);
  const height = props.height ?? 320;

  const body = matchLoad(config.state, {
    // The placeholder is the map's exact box, so opening the picker does not
    // reflow the form around it when the config lands.
    loading: (): ReactNode => <MapPlaceholder height={height} />,
    // No tile template means no map. The only state where this pair draws
    // none, and it says so rather than rendering an empty grey rectangle.
    failed: (error): ReactNode => (
      <div data-geo-map="failed">
        <ErrorAlert
          thrown={error}
          message={t(GEO_I18N_KEYS.mapConfigFailed)}
          retryLabel={t(GEO_I18N_KEYS.mapRetry)}
          onRetry={config.refetch}
          testId="geo-config-error"
        />
      </div>
    ),
    ready: (loaded): ReactNode => (
      <PickerBody
        config={loaded}
        height={height}
        {...(props.value !== undefined ? { value: props.value } : {})}
        {...(props.value !== undefined && props.resolution !== undefined
          ? { resolution: props.resolution }
          : {})}
        {...(props.onChange !== undefined ? { onChange: props.onChange } : {})}
        {...(props.lang !== undefined ? { lang: props.lang } : {})}
        nearest={props.nearest ?? 0}
        onConfirm={(picked) => {
          setConfirmed(picked);
          props.onConfirm?.(picked);
          setOpen(false);
        }}
      />
    ),
  });

  if (props.mode === "inline") {
    return (
      <GeoSkinTheme>
        <div
          data-geo-picker="inline"
          {...(props["data-testid"] !== undefined
            ? { "data-testid": props["data-testid"] }
            : {})}
        >
          {body}
        </div>
      </GeoSkinTheme>
    );
  }

  return (
    <GeoSkinTheme>
      <div
        data-geo-picker="dialog"
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
        style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}
      >
        <Button
          type="default"
          data-testid="geo-open"
          data-analytics="none"
          data-analytics-reason="local-ui-open-picker"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t(GEO_I18N_KEYS.pickerOpen)}
        </Button>
        {confirmed !== undefined && <ChosenSummary picked={confirmed} />}
        <SkinDialog
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          title={t(GEO_I18N_KEYS.pickerTitle)}
          dismissLabel={t(GEO_I18N_KEYS.pickerClose)}
          data-testid="geo-picker-dialog"
        >
          {body}
        </SkinDialog>
      </div>
    </GeoSkinTheme>
  );
}

function MapPlaceholder(props: { readonly height: number | string }): ReactElement {
  const { token } = antdTheme.useToken();
  const t = useT();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t(GEO_I18N_KEYS.pickerResolving)}
      data-geo-map="placeholder"
      data-testid="geo-map-placeholder"
      style={{
        width: "100%",
        height: props.height,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
    />
  );
}

/** The chosen place, as a form field's summary line. Coordinates are shown
 * beside the address because the coordinate is what gets stored and it is
 * always real, even when the address is not. */
function ChosenSummary(props: { readonly picked: PickedLocation }): ReactElement {
  const t = useT();
  const { picked } = props;
  return (
    <div data-geo-chosen="" data-testid="geo-chosen">
      {picked.address !== null && picked.address !== "" && (
        <Typography.Text>{picked.address}</Typography.Text>
      )}
      <div>
        <Typography.Text type="secondary">
          {t(GEO_I18N_KEYS.pickerCoordinates, {
            lat: picked.point.lat.toFixed(5),
            lon: picked.point.lon.toFixed(5),
          })}
        </Typography.Text>
      </div>
    </div>
  );
}

interface PickerBodyProps {
  readonly config: MapConfig;
  readonly height: number | string;
  readonly value?: LatLon;
  readonly resolution?: PlaceResolution;
  readonly onChange?: (picked: PickedLocation) => void;
  readonly onConfirm: (picked: PickedLocation) => void;
  readonly nearest: number;
  readonly lang?: string;
}

/**
 * The composed picker, mounted only once `map/config` is READY.
 *
 * A separate component and not a branch inside the parent, because every hook
 * below needs the loaded config and hooks cannot be called conditionally. It
 * also means the search's debounce clock and the pin's settle clock start when
 * the map does, not when the form did.
 */
function PickerBody(props: PickerBodyProps): ReactElement {
  const t = useT();
  const { config } = props;
  const [center, setCenter] = useState<LatLon>(() => centerOf(config, props.value));
  const [zoom, setZoom] = useState<number>(
    props.value !== undefined ? config.picked_zoom : config.default_zoom
  );

  const search = usePlaceSearch({
    config,
    bias: center,
    zoom,
    ...(props.lang !== undefined ? { lang: props.lang } : {}),
  });
  const picker = useLocationPicker({
    config,
    initial: center,
    nearest: props.nearest,
    ...(props.resolution !== undefined ? { initialResolution: props.resolution } : {}),
    ...(props.lang !== undefined ? { lang: props.lang } : {}),
  });
  const position = useBrowserPosition({ offered: config.geolocation });

  const { moveTo } = picker;
  const moveCamera = useCallback(
    (next: LatLon, nextZoom: number): void => {
      setCenter(next);
      setZoom(nextZoom);
      // The pin IS the centre — see `TileMap`'s centre-pin note — so every
      // camera move is a pin move, and the debounced resolve follows it.
      moveTo(next);
    },
    [moveTo]
  );

  // The browser's answer is a camera move like any other, at the zoom the
  // deployment picked for a settled choice.
  const located = position.state.step === "located" ? position.state.point : undefined;
  useEffect(() => {
    if (located === undefined) return;
    moveCamera(located, config.picked_zoom);
  }, [located, moveCamera, config.picked_zoom]);

  // Report the live value upward. Compared by identity of the fields that can
  // actually change, so a re-render with the same pin and the same answer does
  // not fire a form's onChange again.
  const { onChange } = props;
  const picked = picker.picked;
  const signature =
    picked === undefined
      ? ""
      : `${String(picked.point.lat)}|${String(picked.point.lon)}|${picked.geohash ?? ""}|${picked.address ?? ""}`;
  const lastSignature = useRef<string>("");
  useEffect(() => {
    if (picked === undefined || onChange === undefined) return;
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    onChange(picked);
  }, [picked, signature, onChange]);

  const labels = useMemo(
    () => ({
      map: t(GEO_I18N_KEYS.pickerMapLabel),
      zoomIn: t(GEO_I18N_KEYS.pickerZoomIn),
      zoomOut: t(GEO_I18N_KEYS.pickerZoomOut),
      pin: t(GEO_I18N_KEYS.pickerPinLabel),
    }),
    [t]
  );

  return (
    <div
      data-geo-picker-body=""
      style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}
    >
      <AddressSearchField
        search={search}
        onPick={(suggestion) => {
          moveCamera(suggestion.point, config.picked_zoom);
        }}
      />

      <TileMap
        layer={config.tiles}
        center={center}
        zoom={zoom}
        height={props.height}
        bbox={config.bbox}
        labels={labels}
        onChange={moveCamera}
        data-testid="geo-map"
      />

      {/* The offer exists only where the deployment turned it on AND the
          browser has the API. Where it does not, the control is not on screen
          at all — a permanently disabled button with an explanation is worse
          than its absence, because it is a door that was never there. */}
      {position.supported && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
          <Button
            data-testid="geo-locate"
            data-analytics="none"
            data-analytics-reason="local-ui-browser-position-prompt"
            loading={position.state.step === "locating"}
            onClick={position.locate}
          >
            {position.state.step === "locating"
              ? t(GEO_I18N_KEYS.pickerLocating)
              : t(GEO_I18N_KEYS.pickerUseMyPosition)}
          </Button>
          {/* Three refusals, three sentences, and three different next
              actions — as TEXT beside the control that produced them. */}
          {position.state.step === "refused" && position.state.outcome !== "unsupported" && (
            <Typography.Text
              type="secondary"
              data-geo-position-state={position.state.outcome}
              data-testid="geo-position-refused"
            >
              {t(POSITION_KEYS[position.state.outcome])}
            </Typography.Text>
          )}
        </div>
      )}

      <ResolveLine picker={picker} />

      <Button
        type="primary"
        block
        data-testid="geo-confirm"
        data-analytics="none"
        data-analytics-reason="passthrough — the caller's onConfirm carries the tracked action"
        // Transient only: the pin exists from the first frame the config does,
        // so this is the gap before the map has a centre — not a permission.
        disabled={picker.picked === undefined}
        data-disabled-reason="the map has no centre yet"
        onClick={() => {
          if (picker.picked !== undefined) props.onConfirm(picker.picked);
        }}
      >
        {t(GEO_I18N_KEYS.pickerConfirm)}
      </Button>
    </div>
  );
}

/**
 * The confirmation line: what the pin currently resolves to.
 *
 * Four outcomes and only one of them is bad news. `nowhere` in particular is a
 * SUCCESSFUL answer — the middle of a lake has coordinates too — so it reads
 * "no address at this point, the coordinates are still saved" and not as a
 * failure, which is what a component that branched on truthiness would have
 * shown.
 */
function ResolveLine(props: {
  readonly picker: ReturnType<typeof useLocationPicker>;
}): ReactElement {
  const t = useT();
  const { picker } = props;
  const point = picker.point;

  const line = ((): ReactNode => {
    switch (picker.resolve.step) {
      case "idle":
        return null;
      case "resolving":
        return (
          <Typography.Text type="secondary" data-geo-resolve="resolving">
            {t(GEO_I18N_KEYS.pickerResolving)}
          </Typography.Text>
        );
      case "resolved": {
        const formatted = picker.resolve.resolution.formatted;
        return formatted === null || formatted === undefined || formatted === "" ? (
          <Typography.Text type="secondary" data-geo-resolve="nowhere">
            {t(GEO_I18N_KEYS.pickerNoAddress)}
          </Typography.Text>
        ) : (
          <Typography.Text strong data-geo-resolve="resolved">
            {formatted}
          </Typography.Text>
        );
      }
      case "nowhere":
        return (
          <Typography.Text type="secondary" data-geo-resolve="nowhere">
            {t(GEO_I18N_KEYS.pickerNoAddress)}
          </Typography.Text>
        );
      case "refused":
        return picker.resolve.availability === "unauthorized" ||
          picker.resolve.availability === "throttled" ? (
          // Neither is a fault: one is this deployment's permission answer for
          // a signed-out visitor, the other is the server asking for quiet.
          // The pin is unaffected, so this is stated, not alarmed about.
          <Typography.Text
            type="secondary"
            data-geo-resolve={picker.resolve.availability}
          >
            {t(AVAILABILITY_KEYS[picker.resolve.availability])}
          </Typography.Text>
        ) : (
          <div data-geo-resolve={picker.resolve.availability}>
            <ErrorAlert
              variant="inline"
              message={t(AVAILABILITY_KEYS[picker.resolve.availability])}
              retryLabel={t(GEO_I18N_KEYS.mapRetry)}
              onRetry={picker.retry}
              testId="geo-resolve-error"
            />
          </div>
        );
    }
  })();

  return (
    <div
      data-geo-confirmation=""
      style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}
    >
      {line}
      {point !== undefined && (
        <Typography.Text type="secondary" data-testid="geo-coordinates">
          {t(GEO_I18N_KEYS.pickerCoordinates, {
            lat: point.lat.toFixed(5),
            lon: point.lon.toFixed(5),
          })}
        </Typography.Text>
      )}
    </div>
  );
}
