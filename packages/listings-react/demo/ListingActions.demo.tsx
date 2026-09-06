/**
 * The two verbs a classified puts beside a listing's title — save it, and
 * send it to somebody — as ONE cluster.
 *
 * They are not two buttons in a row because everything that makes them usable
 * belongs to the pair: the hit-target tier, the corner of the photograph they
 * are pinned to on a phone, and the ruling that they are icon-only on the
 * listing page because there are two of them and a price on one line.
 *
 * The two variants are the two things a reader can BE. A member presses the
 * heart and it flips. A visitor is not shown a live control that quietly does
 * nothing: the heart states the reason it is off and carries the container's
 * sign-in door, while the share control beside it stays fully live — sending
 * a link to a friend needs no account, and switching it off with the heart
 * would be the pair inventing a mandate the backend never asked for.
 */
import type { CSSProperties, ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { ListingActions } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";

const LISTING_ID = 7;
const LISTING_URL = "/l/7-bosch-gsb-13-re";
const LISTING_TITLE = "Bosch GSB 13 RE";

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  padding: spacing["4"],
  borderRadius: radii.lg,
  background: cssVar("surface-raised"),
  border: `1px solid ${cssVar("border")}`,
  width: 320,
};

function Member(): ReactElement {
  return (
    <ListingsDemoHarness>
      <div style={rowStyle}>
        <ListingActions
          listingId={LISTING_ID}
          favorited={false}
          shareUrl={LISTING_URL}
          shareTitle={LISTING_TITLE}
          testId="demo-actions"
        />
      </div>
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness principal="anonymous">
      <div style={rowStyle}>
        <ListingActions
          listingId={LISTING_ID}
          favorited={false}
          shareUrl={LISTING_URL}
          shareTitle={LISTING_TITLE}
          signIn={{ href: "/login?next=/l/7-bosch-gsb-13-re" }}
          blockedReason="text"
          testId="demo-actions-visitor"
        />
      </div>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.actions",
  title: "Save and share cluster",
  description:
    "The reader's two actions in one cluster, so the pair can be given a hit-target tier, a corner and an order ONCE rather than twice. `placement=\"overlay\"` pins it to the trailing-top corner of a card's media — the one corner a gallery leaves free, because the dots own the bottom centre and the photo counter owns the bottom trailing corner. Not to be confused with `useListingActions`, which is the SELLER's lifecycle moves; neither is exported from the other's barrel.",
  component: ListingActions,
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "member",
      description:
        "A signed-in reader: both glyphs live, the heart unsaved and pressable, the share control beside it at the same size.",
      render: () => <Member />,
    },
    blocked: {
      viewport: "desktop",
      step: "no_mandate",
      description:
        "A visitor: the heart says WHY it is off and carries the door, and the share control stays live — sending somebody a link needs no account, so switching it off would be the pair inventing a mandate the backend never asked for.",
      render: () => <Visitor />,
    },
  },
});
