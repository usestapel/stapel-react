/**
 * The composed picker: search field, map, position offer, confirmation line,
 * confirm button. Mounted only once `map/config` is READY.
 *
 * A module of its own because two skins put it on screen — `LocationField`
 * (the field a form actually wants) and `LocationPickerField` (the older
 * button-plus-summary shape) — and a body that lived inside one of them would
 * make the other import a component to get at its insides.
 *
 * A separate component and not a branch inside its parents, too, because every
 * hook below needs the loaded config and hooks cannot be called conditionally.
 * It also means the search's debounce clock and the pin's settle clock start
 * when the map does, not when the form did.
 *
 * ## No coordinates on screen, anywhere
 *
 * This body used to print `{lat}, {lon}` to five decimals under the
 * confirmation line, and the summary above it printed them again. That was the
 * original defect wearing a nicer hat: a person choosing where their sofa is
 * does not read 55.75581, and a number they cannot check is not a confirmation
 * — it is noise that makes a right answer look technical and a wrong one look
 * authoritative. The address is the confirmation; the coordinate is what gets
 * stored, and storage is not a display concern.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Typography } from "antd";
import { useT } from "@stapel/core";
import { ErrorAlert } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { GEO_I18N_KEYS } from "../i18n/keys.js";
import { useBrowserPosition } from "../headless/useBrowserPosition.js";
import { useLocationPicker } from "../headless/useLocationPicker.js";
import { usePlaceSearch } from "../headless/usePlaceSearch.js";
import type { PickedLocation } from "../headless/useLocationPicker.js";
import type { PositionOutcome } from "../headless/useBrowserPosition.js";
import type { LatLon } from "../model/coords.js";
import type { MapConfig, PlaceResolution } from "../api/types.js";
import { AddressSearchField, AVAILABILITY_KEYS } from "./AddressSearchField.js";
import { TileMap } from "./TileMap.js";

/** The three refusals the browser can hand back that are worth a sentence.
 * `unsupported` is absent on purpose: there is nothing to say, because the
 * control is not rendered at all where the API does not exist. */
const POSITION_KEYS: Readonly<Record<Exclude<PositionOutcome, "unsupported">, string>> = {
  denied: GEO_I18N_KEYS.positionDenied,
  unavailable: GEO_I18N_KEYS.positionUnavailable,
  timeout: GEO_I18N_KEYS.positionTimeout,
};

/** Where the map opens when nobody — not the caller, not the resolved-location
 * ladder, not the deployment — has an opinion. The null island is a deliberate
 * non-place, and every rung above it exists so this is never reached. */
const NO_OPINION: LatLon = { lat: 0, lon: 0 };

/**
 * `map/config.default_center` is `[lat, lon]` — NOT GeoJSON order. The one
 * field in this contract that looks like a coordinates array and is not.
 *
 * Precedence: the caller's stored `value` (a pin that already exists) beats
 * the opening `center` (a guess about where to start) beats the deployment's
 * declared centre beats the null island.
 */
export function centerOf(
  config: MapConfig,
  value: LatLon | undefined,
  center: LatLon | undefined
): LatLon {
  if (value !== undefined) return value;
  if (center !== undefined) return center;
  const declared = config.default_center;
  if (Array.isArray(declared) && declared.length >= 2) {
    const lat = declared[0];
    const lon = declared[1];
    if (typeof lat === "number" && typeof lon === "number") return { lat, lon };
  }
  return NO_OPINION;
}

export interface PickerBodyProps {
  readonly config: MapConfig;
  readonly height: number | string;
  /** A pin that already exists — an edit form's stored answer. */
  readonly value?: LatLon;
  /**
   * Where to OPEN when there is no `value` yet: the browser's fix, the IP
   * answer, whatever `useResolvedLocation` produced. Distinct from `value`
   * because it is a guess about the camera, not a stored choice — although
   * the pin is the centre, so the person still has to confirm it.
   */
  readonly center?: LatLon;
  /** The zoom that matches how much `center` actually knows. */
  readonly centerZoom?: number;
  readonly resolution?: PlaceResolution;
  readonly onChange?: (picked: PickedLocation) => void;
  readonly onConfirm: (picked: PickedLocation) => void;
  readonly nearest: number;
  readonly lang?: string;
}

export function PickerBody(props: PickerBodyProps): ReactElement {
  const t = useT();
  const { config } = props;
  const [center, setCenter] = useState<LatLon>(() =>
    centerOf(config, props.value, props.center)
  );
  const [zoom, setZoom] = useState<number>(
    props.value !== undefined
      ? config.picked_zoom
      : (props.centerZoom ?? config.default_zoom)
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
    </div>
  );
}
