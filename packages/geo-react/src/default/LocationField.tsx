/**
 * `<LocationField/>` — "Where is it?", as a field.
 *
 * `LocationPickerField` put a BUTTON in the form — "Choose on the map" — and
 * printed the chosen place underneath it. Two problems, one of them fatal:
 *
 *  - a button beside every real input reads as an action, not as an answer to
 *    a question, and the answer landing *below* it means the form's own field
 *    stays visibly empty after the person has filled it in;
 *  - "choose on the MAP" names the mechanism instead of the question. Most
 *    people choosing a place do it by typing a street, and a map is where they
 *    end up only when the street is not enough.
 *
 * So this is one field. Empty, it says what it is for ("Choose a location").
 * Filled, it holds the chosen place INSIDE it, the way a text input holds
 * text — because that is what the person answered. It never shows a latitude
 * or a longitude: a coordinate is what gets STORED, and showing it back is
 * the defect this whole pair exists to undo.
 *
 * ## What one tap does, and why it is four things
 *
 * A picker needs a centre before it has a location, and the ladder that
 * produces one is `useResolvedLocation`. This component is where it meets the
 * browser's one-shot prompt:
 *
 *  1. **granted** — ask for the fix, open the picker on it.
 *  2. **prompt / unknown** — open `PermissionSheet` FIRST. Explaining before
 *     the browser's own prompt is the whole reason the refusal rate is not
 *     100%: fired cold, it is denied by reflex, and denial is permanent.
 *  3. **allowed there** — the fix arrives from the same call that raised the
 *     prompt, and the picker opens on it.
 *  4. **refused, or refused long ago** — the picker opens anyway, centred on
 *     the IP answer (`GET geo/api/v1/ip`), which is a city and says so. No
 *     dead end, no empty ocean, and nothing the person has to do twice.
 *
 * A person who already said no does NOT get the sheet again on every tap —
 * their answer stands, and the field goes straight to the map. The sheet's
 * `fallback` slot carries the same door for the one time they refuse in it.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Input, Typography, theme as antdTheme } from "antd";
import { matchLoad, useT } from "@stapel/core";
import { ErrorAlert, PermissionSheet, SkinDialog } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { GEO_I18N_KEYS } from "../i18n/keys.js";
import { useMapConfig } from "../model/queries.js";
import { useResolvedLocation } from "../headless/useResolvedLocation.js";
import type { PickedLocation } from "../headless/useLocationPicker.js";
import type { LatLon } from "../model/coords.js";
import type { PlaceResolution } from "../api/types.js";
import { PickerBody } from "./PickerBody.js";
import { GeoSkinTheme } from "./theme.js";

/** What the field is holding, if anything. The address is what a person
 * reads; the point is what a product stores. Both, never the coordinates on
 * screen. */
export interface ChosenPlace {
  readonly point: LatLon;
  /** The line to show inside the field. Empty or absent means the geocoder
   * had no address for the point — the field then says so rather than looking
   * unanswered, because the location IS chosen. */
  readonly address?: string | null;
}

export interface LocationFieldProps {
  /** The place already chosen — an edit form handing back what it saved. */
  readonly value?: ChosenPlace;
  /** The stored resolution for {@link LocationFieldProps.value}, so reopening
   * does not re-ask the geocoder about a point it was handed the answer to. */
  readonly resolution?: PlaceResolution;
  /** Fires when the person confirms a place in the picker. */
  readonly onChange?: (picked: PickedLocation) => void;
  /** Override the empty field's own sentence. */
  readonly placeholder?: string;
  /** How many known `Location` rows to ask `resolve` for. 0 (default) does not
   * query the reference tree at all. */
  readonly nearest?: number;
  /** See `SearchQuery.lang` — leave unset. */
  readonly lang?: string;
  /** Height of the map box inside the picker. */
  readonly height?: number | string;
  /** The form marked this field as wrong. */
  readonly status?: "error";
  readonly disabled?: boolean;
  readonly "data-testid"?: string;
}

export function LocationField(props: LocationFieldProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const config = useMapConfig();
  const loaded = config.state.status === "ready" ? config.state.data : undefined;
  const resolved = useResolvedLocation({ config: loaded });

  const [permissionOpen, setPermissionOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosen, setChosen] = useState<ChosenPlace | undefined>(undefined);

  const current = chosen ?? props.value;
  const address = current?.address;
  // A chosen point with no address is still an answer. The field says which
  // one it is; what it must never do is look empty because the geocoder had
  // nothing to say about a lake.
  const shown =
    current === undefined
      ? undefined
      : address !== null && address !== undefined && address !== ""
        ? address
        : t(GEO_I18N_KEYS.fieldChosenNoAddress);

  const openPicker = (): void => {
    setPermissionOpen(false);
    setPickerOpen(true);
  };

  const activate = (): void => {
    if (props.disabled === true) return;
    const status = resolved.permission.status;
    if (status === "prompt" || status === "unknown") {
      // Explain before the browser does. Step 2 of the four in the file doc.
      setPermissionOpen(true);
      return;
    }
    if (status === "granted") {
      void resolved.locate().then(openPicker, openPicker);
      return;
    }
    // Refused, or refused long ago, or no such capability: their answer
    // stands. The IP centre is already in the bag and the map opens on it.
    openPicker();
  };

  const field = (
    <Input
      readOnly
      role="button"
      tabIndex={props.disabled === true ? -1 : 0}
      aria-haspopup="dialog"
      value={shown ?? ""}
      placeholder={props.placeholder ?? t(GEO_I18N_KEYS.fieldPlaceholder)}
      status={props.status === "error" ? "error" : ""}
      disabled={props.disabled ?? false}
      data-geo-field={current === undefined ? "empty" : "chosen"}
      data-testid="geo-field-input"
      data-analytics="none"
      data-analytics-reason="local-ui-open-picker"
      style={{ cursor: props.disabled === true ? "not-allowed" : "pointer" }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    />
  );

  const body = matchLoad(config.state, {
    loading: (): ReactNode => (
      <Input
        readOnly
        disabled
        placeholder={t(GEO_I18N_KEYS.fieldPlaceholder)}
        data-geo-field="loading"
        data-testid="geo-field-loading"
      />
    ),
    // No tile template means no map, so there is nothing this field can open.
    // It says that instead of offering a door onto a grey rectangle.
    failed: (error): ReactNode => (
      <ErrorAlert
        thrown={error}
        message={t(GEO_I18N_KEYS.mapConfigFailed)}
        retryLabel={t(GEO_I18N_KEYS.mapRetry)}
        onRetry={config.refetch}
        testId="geo-field-error"
      />
    ),
    ready: (): ReactNode => field,
  });

  return (
    <GeoSkinTheme>
      <div
        data-geo-location-field=""
        {...(props["data-testid"] !== undefined
          ? { "data-testid": props["data-testid"] }
          : {})}
        style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}
      >
        {body}

        {/* The pre-prompt. Its `fallback` is the same door the refusal path
            takes anyway — stated inside the sheet so a "no" is one tap from
            the map instead of a dead end. */}
        <PermissionSheet
          open={permissionOpen}
          permission={resolved.permission}
          onClose={() => {
            setPermissionOpen(false);
          }}
          onResolved={(status) => {
            if (status === "granted") openPicker();
          }}
          title={t(GEO_I18N_KEYS.permissionTitle)}
          body={t(GEO_I18N_KEYS.permissionBody)}
          deniedBody={t(GEO_I18N_KEYS.permissionDenied)}
          fallback={
            <Button
              data-testid="geo-field-permission-fallback"
              data-analytics="none"
              data-analytics-reason="local-ui-open-picker"
              onClick={openPicker}
            >
              {t(GEO_I18N_KEYS.fieldChooseAnyway)}
            </Button>
          }
          data-testid="geo-field-permission"
        />

        <SkinDialog
          open={pickerOpen}
          onClose={() => {
            setPickerOpen(false);
          }}
          title={t(GEO_I18N_KEYS.pickerTitle)}
          dismissLabel={t(GEO_I18N_KEYS.pickerClose)}
          data-testid="geo-field-dialog"
        >
          {loaded !== undefined && pickerOpen ? (
            <PickerBody
              config={loaded}
              height={props.height ?? 320}
              {...(current !== undefined ? { value: current.point } : {})}
              {...(current !== undefined && props.resolution !== undefined
                ? { resolution: props.resolution }
                : {})}
              {...(current === undefined && resolved.location !== undefined
                ? { center: resolved.location.point, centerZoom: resolved.location.zoom }
                : {})}
              nearest={props.nearest ?? 0}
              {...(props.lang !== undefined ? { lang: props.lang } : {})}
              onConfirm={(picked) => {
                setChosen({
                  point: picked.point,
                  ...(picked.address !== null ? { address: picked.address } : {}),
                });
                props.onChange?.(picked);
                setPickerOpen(false);
              }}
            />
          ) : null}
        </SkinDialog>

        {/* Where the map will open from, when nobody has chosen yet and the
            answer came from an address rather than a device. Stated because a
            city-level guess presented silently reads as a precise one. */}
        {current === undefined &&
        resolved.location !== undefined &&
        resolved.location.source === "ip" &&
        resolved.location.label !== null ? (
          <Typography.Text
            type="secondary"
            data-geo-field-origin="ip"
            data-testid="geo-field-origin"
            style={{ fontSize: token.fontSizeSM }}
          >
            {t(GEO_I18N_KEYS.fieldNearYou, { place: resolved.location.label })}
          </Typography.Text>
        ) : null}
      </div>
    </GeoSkinTheme>
  );
}
