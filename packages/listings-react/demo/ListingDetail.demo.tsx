/** Both axes on one page, and one primary action per reader. */
import type { ReactElement } from "react";
import { Button } from "antd";
import { useT } from "@stapel/core";
import { defineDemo } from "@stapel/showcase";
import { ListingDetailPane } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_DETAIL, DEMO_STATUS } from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/listings/7/status/": DEMO_STATUS,
  "/listings/7/": DEMO_DETAIL,
};

const MISSING: DemoHandlers = {
  "/listings/7/status/": [404, {}],
  "/listings/7/": [404, {}],
};

/** What the container fills `contactSlot` with — `@stapel/chat-react`'s
 * "message the seller" button, stood in for here because L2 pairs do not
 * import each other and a demo may not either. */
function ContactSeller(): ReactElement {
  const t = useT();
  return (
    <Button
      type="primary"
      data-testid="demo-contact-seller"
      data-analytics="none"
      data-analytics-reason="demo stand-in for the container's chat button"
    >
      {t("demo.contact.seller")}
    </Button>
  );
}

function Buyer(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingDetailPane id={7} contactSlot={<ContactSeller />} />
    </ListingsDemoHarness>
  );
}

function Unwired(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingDetailPane id={7} />
    </ListingsDemoHarness>
  );
}

function Owner(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <ListingDetailPane
        id={7}
        viewerId={DEMO_DETAIL.owner}
        onEdit={() => undefined}
      />
    </ListingsDemoHarness>
  );
}

function NotFound(): ReactElement {
  return (
    <ListingsDemoHarness handlers={MISSING}>
      <ListingDetailPane id={7} />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.detail",
  title: "Listing detail",
  description:
    "The money screen, read by two people. A buyer gets ONE primary — the container's 'message the seller' in contactSlot — with favouriting as the secondary beside it. The OWNER gets Edit and Take down instead, plus the moderation axis: since stapel-listings 0.5.0 an edit to a live listing keeps status=published and moves only moderation_status, and a page that derived one field from the other would either hide the listing or hide the review. An unfilled contactSlot names itself rather than leaving 'save to favourites' as the only verb on the page.",
  component: ListingDetailPane,
  covers: ["ListingDetail"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "buyer_contact_wired",
      description: "A buyer, with the chat pair wired into contactSlot.",
      render: () => <Buyer />,
    },
    "contact-unwired": {
      viewport: "phone",
      step: "buyer_slot_unfilled",
      description:
        "The same page in an app with no chat: the slot says its own name in a dev build.",
      render: () => <Unwired />,
    },
    owner: {
      viewport: "phone",
      step: "owner_live_edit_under_review",
      description: "The owner: Edit, Take down, and the review the buyer never sees.",
      render: () => <Owner />,
    },
    "not-found": {
      viewport: "desktop",
      step: "not_found",
      description:
        "No listing ever had this id — a different sentence from 'it was removed' and from 'we could not ask'.",
      render: () => <NotFound />,
    },
  },
});
