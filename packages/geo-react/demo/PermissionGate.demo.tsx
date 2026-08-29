/**
 * Asking for a browser capability, as the three things a screen can be in.
 *
 * The components live in `@stapel/tokens-antd/skin` — the shared substrate,
 * which ships no demo directory of its own — and geo-react is their first
 * consumer, so this is where the surface gets photographed. Nothing here is
 * geo-specific except the copy, which is the point: the gate takes its
 * sentences from whoever is asking.
 *
 * `PermissionGate` is what a screen holds; the pre-prompt it opens is a
 * `SkinDialog`, so a bottom sheet on a phone and a modal above it. The dialog
 * itself is not a variant here for a mechanical reason worth writing down: a
 * portal cannot be server-rendered, and this package's demo gate photographs
 * the STATIC first frame of every variant — so a demo whose whole body lives
 * in a portal would photograph an empty box three times and pass a gate that
 * proves nothing. The sheet is verified where it is real: the substrate's own
 * tests, and the live storefront.
 *
 * What the three pictures are for:
 *
 *  - **ask** — nobody has been asked. A door, not a capability: the browser is
 *    untouched until the person opens it.
 *  - **granted** — the capability's own content, and no ask anywhere. A screen
 *    that keeps offering "allow" after a yes is as wrong as one that keeps
 *    offering it after a no.
 *  - **refused** — the way forward that never needed the capability. No dead
 *    trigger: the browser will not ask again, so a button that asks it is a
 *    door that goes nowhere.
 */
import type { ReactElement } from "react";
import { Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import type { PermissionBag, PermissionStatus } from "@stapel/core";
import { PermissionGate } from "@stapel/tokens-antd/skin";
import { GEO_I18N_KEYS } from "../src/i18n/keys.js";
import { DemoFrame, GeoDemoHarness } from "./_harness.js";

function bagOf(status: PermissionStatus): PermissionBag {
  return {
    kind: "geolocation",
    status,
    supported: status !== "unsupported",
    asking: false,
    request: () => Promise.resolve(status),
    refresh: () => undefined,
  };
}

const PROMPT = bagOf("prompt");
const GRANTED = bagOf("granted");
const DENIED = bagOf("denied");

/** Inside the harness, so `useT` has the provider the demo mounts. */
function GateBody(props: { readonly permission: PermissionBag }): ReactElement {
  const t = useT();
  return (
    <PermissionGate
      permission={props.permission}
      surface="modal"
      title={t(GEO_I18N_KEYS.permissionTitle)}
      body={t(GEO_I18N_KEYS.permissionBody)}
      deniedBody={t(GEO_I18N_KEYS.permissionDenied)}
      allowLabel={t(GEO_I18N_KEYS.pickerUseMyPosition)}
      fallback={
        <Typography.Text type="secondary">
          {t(GEO_I18N_KEYS.permissionDenied)}
        </Typography.Text>
      }
      testId="demo-permission-gate"
    >
      <Typography.Text strong>{t(GEO_I18N_KEYS.pickerUseMyPosition)}</Typography.Text>
    </PermissionGate>
  );
}


function Gate(props: { readonly permission: PermissionBag }): ReactElement {
  return (
    <GeoDemoHarness>
      <DemoFrame>
        <GateBody permission={props.permission} />
      </DemoFrame>
    </GeoDemoHarness>
  );
}

export default defineDemo({
  id: "geo.permission-gate",
  title: "Asking for a browser capability, before the browser does",
  description:
    "The substrate's permission gate (@stapel/tokens-antd/skin) with geo's copy in it. A browser prompt fires once and its refusal is permanent, so the explanation has to come first — and once the answer is no, the screen offers the way that never needed the capability instead of a button that cannot work.",
  component: PermissionGate,
  tokens: ["surface-raised", "text-muted"],
  variants: {
    ask: {
      description:
        "Nobody has been asked. The control opens an explanation; the browser stays untouched until then.",
      viewport: "phone",
      step: "prompt",
      render: () => <Gate permission={PROMPT} />,
    },
    granted: {
      description:
        "Allowed. The capability's own content, and no ask left on screen — a question already answered is not asked again.",
      viewport: "desktop",
      step: "granted",
      render: () => <Gate permission={GRANTED} />,
    },
    refused: {
      description:
        "Refused, permanently — the browser will not ask again. The way forward that does not need the capability, and no dead trigger beside it.",
      viewport: "phone",
      step: "denied",
      render: () => <Gate permission={DENIED} />,
    },
  },
});
