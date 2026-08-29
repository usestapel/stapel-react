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
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Button, Typography, theme as antdTheme } from "antd";
import { matchLoad, useT } from "@stapel/core";
import { ErrorAlert, SkinDialog } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import { GEO_I18N_KEYS } from "../i18n/keys.js";
import { useMapConfig } from "../model/queries.js";
import type { PickedLocation } from "../headless/useLocationPicker.js";
import type { LatLon } from "../model/coords.js";
import type { PlaceResolution } from "../api/types.js";
import { PickerBody } from "./PickerBody.js";
import { GeoSkinTheme } from "./theme.js";

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

/**
 * The chosen place, as a form field's summary line.
 *
 * The coordinates used to be printed here, "because the coordinate is what
 * gets stored". They are gone: what gets stored is not a display concern, and
 * a five-decimal number nobody can check makes a right answer look technical
 * and a wrong one look authoritative. A point the geocoder had no address for
 * still says so, because the place IS chosen.
 */
function ChosenSummary(props: { readonly picked: PickedLocation }): ReactElement {
  const t = useT();
  const { picked } = props;
  const named = picked.address !== null && picked.address !== "";
  return (
    <div data-geo-chosen="" data-testid="geo-chosen">
      <Typography.Text {...(named ? {} : { type: "secondary" as const })}>
        {named ? picked.address : t(GEO_I18N_KEYS.fieldChosenNoAddress)}
      </Typography.Text>
    </div>
  );
}
