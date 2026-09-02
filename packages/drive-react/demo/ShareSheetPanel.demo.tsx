/** The share axis, drawn: two independent halves, a kill switch, a refusal. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ShareSheetPanel } from "../src/default/index.js";
import { DriveDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DOC_BUDGET,
  GRANT_MIRA,
  GRANT_PAUSED,
  GRANT_TEAM,
  LINK_FRESH,
  LINK_OPENED,
  LINK_PAUSED,
  shareLinkUrl,
} from "./fixtures.js";

const BOTH: DemoHandlers = {
  "/access": [GRANT_MIRA, GRANT_TEAM],
  "/links": [LINK_FRESH, LINK_OPENED],
};

const LINKS_ONLY: DemoHandlers = {
  // The whitelist LISTING is itself gated on docs.share.whitelist, so its 403
  // is the capability answer — not an outage.
  "/access": [403, { localizable_error: "error.403.forbidden" }],
  "/links": [LINK_FRESH],
};

const SUSPENDED: DemoHandlers = {
  "/access": [GRANT_PAUSED],
  "/links": [LINK_PAUSED],
};

const MINT_ERROR: DemoHandlers = {
  "/access": [],
  "GET /links": [],
  // The deployment caps minted links at `view`; asking for `edit` is REFUSED
  // rather than clamped, and the sheet renders that refusal's own sentence.
  "POST /links": [400, { localizable_error: "error.400.docs_share_level" }],
};

function Sheet(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <DriveDemoHarness handlers={props.handlers}>
      <ShareSheetPanel
        documentId={DOC_BUDGET.id}
        title={DOC_BUDGET.title}
        linkUrl={shareLinkUrl}
        onClose={() => undefined}
      />
    </DriveDemoHarness>
  );
}

export default defineDemo({
  id: "drive.shareSheet",
  title: "Share sheet",
  description:
    "Sharing as a bottom sheet, over the docs pair's headless share bag — nothing of the axis is re-implemented here. stapel-docs has two INDEPENDENT grant sources, and a deployment may enable either, both or neither, so the sheet has two sections and each answers for itself. Three properties this drawing is responsible for: a switched-off mode's rows stay VISIBLE under a banner (hiding them tells an admin the access was revoked, and re-enabling the mode would then restore access nobody expected); a section the caller may not administer is absent rather than a dead form; and a refused mint says WHICH refusal it was, because the level ceiling is not published by any endpoint and can only be learned by asking.",
  component: ShareSheetPanel,
  variants: {
    default: {
      viewport: "phone",
      step: "people+links",
      description:
        "Both halves live: two links (one already opened by somebody, which is stamped once and is evidence rather than a counter) and two grants — a person and a resolver-backed group reference.",
      render: () => <Sheet handlers={BOTH} />,
    },
    linksOnly: {
      viewport: "phone",
      step: "links-only",
      description:
        "Only link sharing is administrable here: the people section says so in one line instead of offering a form whose every submit would be refused.",
      render: () => <Sheet handlers={LINKS_ONLY} />,
    },
    suspended: {
      viewport: "phone",
      step: "suspended",
      description:
        "Both modes are switched off for this deployment. The rows are still there, tagged Paused, under a banner that says they were not revoked — the kill switch is a display state, never a filter.",
      render: () => <Sheet handlers={SUSPENDED} />,
    },
    mintError: {
      viewport: "phone",
      step: "mint-error",
      description:
        "A mint at `edit` refused by SHARING.LINK.MAX_LEVEL. The sentence is the refusal's own ('That access level may not be granted here'), because the remedy — mint one level lower — is specific to it, and no endpoint in 0.6.1 publishes the ceiling for the sheet to check first.",
      render: () => <Sheet handlers={MINT_ERROR} />,
    },
  },
});
