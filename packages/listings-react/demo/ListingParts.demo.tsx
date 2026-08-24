/**
 * The parts a container composes with, drawn on their own.
 *
 * `ListingCard` and the four panes have their own demos; these five are the
 * pieces those panes are BUILT from, and until this file they had none — which
 * meant the two status treatments, the media placeholder and the sign-in door
 * were only ever photographed as a corner of a bigger screen. §54 asks for a
 * default skin per primitive; the demo gate asks to see it.
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { useT } from "@stapel/core";
import { defineDemo } from "@stapel/showcase";
import {
  LifecycleTag,
  ListingPhoto,
  ListingStatusBlock,
  ModerationNote,
  SignInLink,
} from "../src/default/index.js";
import { listingStatusView } from "../src/index.js";
import { ListingsDemoHarness } from "./_harness.js";

/** The four combinations that matter, out of the nine × four table
 * `model/status.ts` computes: live and calm, live with the edit under review
 * (the 0.5.0 sentence), a first submission, and a takedown. */
const CASES = [
  listingStatusView("published", "approved"),
  listingStatusView("published", "pending"),
  listingStatusView("pending", "pending"),
  listingStatusView("blocked", "rejected"),
];

function Statuses(): ReactElement {
  return (
    <ListingsDemoHarness>
      <Flex vertical gap={16}>
        {CASES.map((status) => (
          <ListingStatusBlock key={status.lifecycle.status} status={status} />
        ))}
      </Flex>
    </ListingsDemoHarness>
  );
}

function Tags(): ReactElement {
  return (
    <ListingsDemoHarness>
      <Flex wrap gap={8}>
        {CASES.map((status) => (
          <LifecycleTag key={status.lifecycle.status} status={status} />
        ))}
      </Flex>
    </ListingsDemoHarness>
  );
}

function Notes(): ReactElement {
  return (
    <ListingsDemoHarness>
      <Flex vertical gap={8}>
        {CASES.map((status) => (
          <ModerationNote key={status.lifecycle.status} status={status} />
        ))}
      </Flex>
    </ListingsDemoHarness>
  );
}

/** The two absences a photo box has to draw: never had one, and had one this
 * build cannot resolve. Neither is a broken `<img>`. */
function Media(): ReactElement {
  return (
    <ListingsDemoHarness>
      <MediaBoxes />
    </ListingsDemoHarness>
  );
}

/** Inside the harness, so `useT` has the demo bundle to read. */
function MediaBoxes(): ReactElement {
  const t = useT();
  return (
    <>
      <Flex gap={16} wrap>
        <div style={{ width: "12rem" }}>
          <ListingPhoto imageRef={undefined} alt={t("demo.photo.none")} />
        </div>
        <div style={{ width: "12rem" }}>
          <ListingPhoto imageRef="unresolvable" alt={t("demo.photo.unresolvable")} />
        </div>
      </Flex>
    </>
  );
}

function Door(): ReactElement {
  return (
    <ListingsDemoHarness principal="anonymous">
      <SignInLink cta={{ href: "/login?next=/l/7" }} testId="demo-sign-in" />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.parts",
  title: "Listing parts",
  description:
    "The pieces the panes are built from. ONE status treatment: a tag carrying the tone and the moderation sentence as ordinary text beneath it — it used to be three (a full-bleed olive bar, a full-bleed grey bar, bare red text) down a single dashboard. The media placeholder is the aspect-ratio box the photo would have filled, painted from theme tokens, so it belongs to whichever side the theme is on instead of glaring white in the dark. The sign-in door is the container's route, never the pair's.",
  component: ListingStatusBlock,
  covers: ["LifecycleTag", "ModerationNote", "ListingPhoto", "SignInLink"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "status_block_four_cases",
      description: "Both axes, four combinations, one treatment.",
      render: () => <Statuses />,
    },
    tags: {
      viewport: "phone",
      step: "lifecycle_tag_only",
      description: "The lifecycle half on its own — what a dense row carries.",
      render: () => <Tags />,
    },
    notes: {
      viewport: "phone",
      step: "moderation_note_only",
      description:
        "The moderation half on its own. An approved listing renders nothing at all.",
      render: () => <Notes />,
    },
    media: {
      viewport: "phone",
      step: "photo_absent_and_unresolvable",
      description: "Two different absences, said differently.",
      render: () => <Media />,
    },
    door: {
      viewport: "desktop",
      step: "sign_in_door",
      description: "The link beside a reason a visitor cannot act on.",
      render: () => <Door />,
    },
  },
});
