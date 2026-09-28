/**
 * The basemap on its own, at two sizes — the demo to open with the network
 * panel showing.
 *
 * Two claims are visible here and nowhere else. The tile grid is sized from
 * the ELEMENT, so the small frame requests fewer tiles than the wide one at
 * the same zoom and the same viewport; and the attribution is drawn in both,
 * because it is a licence obligation with no prop to switch it off.
 *
 * The tiles come from the real OSM tile server: a raster basemap IS a grid of
 * `<img>` tags, so there is nothing to stub that would still be the thing
 * being demonstrated.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { TileMap } from "../src/default/TileMap.js";
import { GeoSkinTheme } from "../src/default/theme.js";
import { GEO_I18N_KEYS } from "../src/i18n/keys.js";
import type { LatLon } from "../src/model/coords.js";
import type { TileLayer } from "../src/api/types.js";
import { DemoFrame, GeoDemoHarness, demoConfig } from "./_harness.js";

const LAYER = (demoConfig()["tiles"] as TileLayer);
const BERLIN: LatLon = { lat: 52.51667, lon: 13.38333 };

function Map(props: { readonly width: string; readonly height: number }): ReactElement {
  const t = useT();
  const [center, setCenter] = useState<LatLon>(BERLIN);
  const [zoom, setZoom] = useState(13);
  return (
    <div style={{ width: props.width }}>
      <TileMap
        layer={LAYER}
        center={center}
        zoom={zoom}
        height={props.height}
        labels={{
          map: t(GEO_I18N_KEYS.pickerMapLabel),
          zoomIn: t(GEO_I18N_KEYS.pickerZoomIn),
          zoomOut: t(GEO_I18N_KEYS.pickerZoomOut),
          pin: t(GEO_I18N_KEYS.pickerPinLabel),
        }}
        onChange={(nextCenter, nextZoom) => {
          setCenter(nextCenter);
          setZoom(nextZoom);
        }}
      />
    </div>
  );
}

function Framed(props: { readonly children: ReactElement }): ReactElement {
  return (
    <GeoDemoHarness handlers={{ "map/config": demoConfig() }}>
      <GeoSkinTheme>{props.children}</GeoSkinTheme>
    </GeoDemoHarness>
  );
}

export default defineDemo({
  id: "geo.tile-map",
  title: "A basemap with no map library",
  description:
    "A grid of <img> tags plus the Web Mercator arithmetic in model/coords.ts — no Leaflet, no MapLibre, no stylesheet and no CSP surface. The pin is fixed at the centre and the map moves under it, because on a phone a draggable marker is covered by the finger dragging it. Arrow keys pan, +/- zoom, and the container carries an accessible name.",
  component: TileMap,
  tokens: ["surface-raised", "border-subtle"],
  variants: {
    default: {
      description: "Full width. Drag it, wheel it, double-click it, or tab to it and use the arrows.",
      viewport: "desktop",
      step: "ready",
      render: () => (
        <Framed>
          <DemoFrame>
            <Map width="100%" height={320} />
          </DemoFrame>
        </Framed>
      ),
    },
    narrow: {
      description:
        "The same map in a narrower element at the same viewport width: fewer tiles requested, because the grid is measured from the ELEMENT.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <Framed>
          <DemoFrame>
            <div style={{ display: "flex", gap: spacing[4] }}>
              <Map width="14rem" height={200} />
            </div>
          </DemoFrame>
        </Framed>
      ),
    },
  },
});
