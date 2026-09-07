/** The face on its own, and the name as a real heading — the two pieces of
 * `<PersonRow>` a storefront needed without the row around them. */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import {
  PersonAvatar,
  PersonRow,
  PERSON_COMPACT_AVATAR,
  PERSON_HEADER_AVATAR,
  PERSON_ROW_AVATAR,
} from "../src/default/index.js";
import type { PublicProfile } from "../src/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import { ADA, ADA_ID, GRACE, GRACE_ID } from "./_fixtures.js";

const WITH_PHOTO = ADA as unknown as PublicProfile;
const WITHOUT_PHOTO = GRACE as unknown as PublicProfile;

/** The three sides the pair names, at once — a host reading this picks the
 * constant, never a number. */
function Sides(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <Flex align="center" gap={spacing[3]}>
        <PersonAvatar
          profile={WITH_PHOTO}
          fallbackName="Ada Lovelace"
          side={PERSON_COMPACT_AVATAR}
        />
        <PersonAvatar
          profile={WITH_PHOTO}
          fallbackName="Ada Lovelace"
          side={PERSON_ROW_AVATAR}
        />
        <PersonAvatar
          profile={WITH_PHOTO}
          fallbackName="Ada Lovelace"
          side={PERSON_HEADER_AVATAR}
        />
      </Flex>
    </ProfilesDemoHarness>
  );
}

/** No descriptor on the wire: a monogram, never a broken `<img>`. */
function Monogram(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <Flex align="center" gap={spacing[3]}>
        <PersonAvatar
          profile={WITHOUT_PHOTO}
          fallbackName="Grace Hopper"
          side={PERSON_ROW_AVATAR}
        />
        <PersonAvatar profile={null} fallbackName="" side={PERSON_ROW_AVATAR} />
      </Flex>
    </ProfilesDemoHarness>
  );
}

/** The same row, with the name promoted to the page's `h2`. */
function Heading(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <PersonRow
        size="header"
        userId={GRACE_ID}
        entry={{ status: "found", profile: WITHOUT_PHOTO }}
        headingLevel={2}
        href={`/u/${GRACE_ID}`}
        testId="person-heading-row"
      />
    </ProfilesDemoHarness>
  );
}

/** The row a card's seller line uses, with the same face at caption size. */
function Compact(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <PersonRow
        size="compact"
        userId={ADA_ID}
        entry={{ status: "found", profile: WITH_PHOTO }}
        href={`/u/${ADA_ID}`}
        testId="person-compact-row"
      />
    </ProfilesDemoHarness>
  );
}

/**
 * `<PersonAvatar>` was private for three releases, and every host that drew a
 * face outside a row — a chat gutter, a table cell, a facepile — rewrote the
 * same decision: the backend's descriptor through `<Image>` when there is one,
 * a monogram when there is not, and never a broken `<img>`. `headingLevel`
 * answers the other half of the same ask: on a seller page the person's name
 * IS the page's heading, and it was a `<span>`.
 */
export default defineDemo({
  id: "profiles.person-avatar-skin",
  title: "Person avatar and heading (skin)",
  description:
    "The pair's face primitive on its own — the backend's source-agnostic avatar descriptor drawn through <Image> at any of the three named sides, degrading to a monogram when a profile carries no avatar — and <PersonRow>'s headingLevel, which makes the person's name a real h1–h4 without changing a pixel of the row.",
  component: PersonAvatar,
  covers: ["PersonRow"],
  tokens: ["surface-sunken", "text", "text-muted"],
  variants: {
    sides: {
      description:
        "One descriptor at the three named sides (compact 20, row 40, header 72) — <Image> picks the ladder rung for each.",
      viewport: "phone",
      step: "sides",
      render: () => <Sides />,
    },
    monogram: {
      description:
        "No descriptor on the wire, and no profile at all: initials, then an empty monogram. Never a broken <img>.",
      viewport: "phone",
      step: "monogram",
      render: () => <Monogram />,
    },
    heading: {
      description:
        "headingLevel={2}: the same header row, with the name as the document's h2 wrapping its own link.",
      viewport: "desktop",
      step: "heading",
      render: () => <Heading />,
    },
    compact: {
      description:
        "The caption-sized arm a listing card puts under its photo — same avatar, same four states.",
      viewport: "phone",
      step: "compact",
      render: () => <Compact />,
    },
  },
});
