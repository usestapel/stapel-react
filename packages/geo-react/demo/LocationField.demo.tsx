/**
 * The field a form actually wants: one control that asks "where?" and then
 * HOLDS the answer.
 *
 * The four variants are the four things a form can be looking at, and the
 * point of photographing them together is that three of them are answers:
 * a chosen address, a chosen place the geocoder had no address for, and an
 * empty field that already knows roughly where the visitor is. Only the
 * fourth — no tile template, so no map to open — is a failure.
 *
 * Nowhere in any of them is a latitude or a longitude, which is the whole
 * reason this component exists.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { LocationField } from "../src/default/LocationField.js";
import {
  DEMO_IP,
  DEMO_RESOLVE,
  DemoFrame,
  GeoDemoHarness,
  demoConfig,
  demoEnvelope,
  seedMapConfig,
} from "./_harness.js";

const BERLIN = { lat: 52.51667, lon: 13.38333 };

const HANDLERS = {
  "map/config": demoConfig(),
  "api/v1/ip": DEMO_IP,
  "geocoding/resolve": DEMO_RESOLVE,
};

function Framed(props: {
  readonly children: ReactElement;
  readonly broken?: boolean;
}): ReactElement {
  return props.broken === true ? (
    <GeoDemoHarness
      handlers={{
        "map/config": [503, demoEnvelope("error.503.unavailable", "Unavailable")],
      }}
    >
      <DemoFrame>{props.children}</DemoFrame>
    </GeoDemoHarness>
  ) : (
    <GeoDemoHarness handlers={HANDLERS} seed={seedMapConfig()}>
      <DemoFrame>{props.children}</DemoFrame>
    </GeoDemoHarness>
  );
}

export default defineDemo({
  id: "geo.location-field",
  title: "Where is it? One field, and no coordinates",
  description:
    "The composer's location question as a FIELD rather than a button: empty it says what it is for, filled it holds the chosen place inside itself the way a text input holds text. Tapping it runs the whole ladder — the permission pre-prompt before the browser's one-shot prompt, the IP centre when that is refused, then the map. A latitude never reaches the screen.",
  component: LocationField,
  tokens: ["surface-raised", "border-subtle", "text-muted"],
  variants: {
    empty: {
      description:
        "Nothing chosen yet. The field states the question, and the line under it says where the map will open from — because a city-level guess presented silently reads as a precise one.",
      viewport: "phone",
      step: "empty",
      render: () => (
        <Framed>
          <LocationField data-testid="demo-location-field" />
        </Framed>
      ),
    },
    chosen: {
      description:
        "Answered. The address is INSIDE the field, not printed under it, so the form does not look half-filled after the person filled it in.",
      viewport: "desktop",
      step: "chosen",
      render: () => (
        <Framed>
          <LocationField
            value={{ point: BERLIN, address: "Unter den Linden, 1, Berlin, Deutschland" }}
            data-testid="demo-location-field"
          />
        </Framed>
      ),
    },
    "chosen-without-address": {
      description:
        "A point the geocoder had no address for — the middle of a lake, a new building. Still an answer: the field says so rather than looking unanswered, and the place is still saved.",
      viewport: "phone",
      step: "chosen-nowhere",
      render: () => (
        <Framed>
          <LocationField value={{ point: { lat: 54.8, lon: 15.2 } }} data-testid="demo-location-field" />
        </Framed>
      ),
    },
    "no-map": {
      description:
        "`map/config` failed, so there is no tile template and nothing to open. The one state where this field offers no door at all, rather than one onto a grey rectangle.",
      viewport: "desktop",
      step: "config-failed",
      render: () => (
        <Framed broken>
          <LocationField data-testid="demo-location-field" />
        </Framed>
      ),
    },
  },
});
