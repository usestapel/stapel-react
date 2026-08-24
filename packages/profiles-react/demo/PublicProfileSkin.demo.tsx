/** Public profile — the DEFAULT SKIN for "look at somebody". */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { PublicProfilePage, Relationship } from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import { ADA, ADA_ID, NEWCOMER, NEWCOMER_ID, SELF_ID } from "./_fixtures.js";

const ADA_HANDLERS = {
  "/relationship": { user_id: ADA_ID, status: "neutral" },
  [`/${ADA_ID}`]: ADA,
} as const;

const NEWCOMER_HANDLERS = {
  "/relationship": { user_id: NEWCOMER_ID, status: "neutral" },
  [`/${NEWCOMER_ID}`]: NEWCOMER,
} as const;

function Profile(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={ADA_HANDLERS}>
      <PublicProfilePage userId={ADA_ID} selfUserId={SELF_ID} />
    </ProfilesDemoHarness>
  );
}

/** The relationship control on its own — what a chat header or a review
 * byline mounts next to a name. */
function Control(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={ADA_HANDLERS}>
      <Relationship userId={ADA_ID} displayName="Ada Lovelace" />
    </ProfilesDemoHarness>
  );
}

function Unwritten(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={NEWCOMER_HANDLERS}>
      <PublicProfilePage userId={NEWCOMER_ID} selfUserId={SELF_ID} />
    </ProfilesDemoHarness>
  );
}

/**
 * `GET /{user_id}` had a typed client, a query hook and no component: there
 * was no way in the whole library to look at another person. Follow is the one
 * primary; Block is a quiet danger link behind a confirm that spells the
 * consequence out.
 */
export default defineDemo({
  id: "profiles.public-profile-skin",
  title: "Public profile (skin)",
  description:
    "The /u/:userId screen: identity block, follower and following counts through ICU plurals, location and rating when the deployment fills them, and the follow / block controls underneath. Since stapel-profiles 0.15.0 a registered person who has typed nothing answers 200 with an empty-but-renderable profile — drawn here as a person, not as an error card.",
  component: PublicProfilePage,
  covers: ["Relationship"],
  tokens: ["surface-raised", "text", "text-muted"],
  variants: {
    profile: {
      description: "A filled profile, no relationship yet: Follow is the primary action.",
      viewport: "phone",
      step: "neutral",
      render: () => <Profile />,
    },
    control: {
      description:
        "<Relationship> alone: Follow as the one primary, Block as a quiet danger link behind a confirm that names the consequence.",
      viewport: "phone",
      step: "control",
      render: () => <Control />,
    },
    unwritten: {
      description:
        "The empty-but-renderable answer (stapel-profiles 0.15.0): registered, provisioned, nothing typed. A person, with a sentence — never a 404.",
      viewport: "desktop",
      step: "unwritten",
      render: () => <Unwritten />,
    },
  },
});
