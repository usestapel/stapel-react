/** How long somebody has been here — the tenure line a seller page reads a
 * stranger's profile for. */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { MemberSince } from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";

/** Years on the site — the shape a buyer is looking for. */
function Tenured(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <MemberSince created_at="2021-11-08T07:30:00Z" />
    </ProfilesDemoHarness>
  );
}

/** Signed up this month. The same sentence, and a very different fact. */
function New(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <MemberSince created_at="2026-09-01T09:00:00Z" />
    </ProfilesDemoHarness>
  );
}

/**
 * Several tenures together — a month and a year each, never a day and never
 * the raw instant the wire carries.
 */
function Ladder(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <Flex vertical gap={spacing[2]}>
        <MemberSince created_at="2019-01-20T00:00:00Z" />
        <MemberSince created_at="2023-06-02T00:00:00Z" />
        <MemberSince created_at="2026-02-14T00:00:00Z" />
      </Flex>
    </ProfilesDemoHarness>
  );
}

/**
 * stapel-profiles 0.19.2 put `created_at` on the public read so a seller page
 * can say "on the site since March 2024" without a second lookup, and every
 * consumer that wanted it was formatting the ISO string itself — one careless
 * render away from a raw `2024-03-15T12:00:00Z` on the glass.
 *
 * The instant is deliberately cut down to a month and a year: "since 15 March
 * 2024, 09:41" reads as surveillance of a stranger, and the question was never
 * asked at that resolution.
 */
export default defineDemo({
  id: "profiles.member-since-skin",
  title: "Member since (skin)",
  description:
    "A profile's created_at as one quiet line at the app's locale — a month and a year, never the raw ISO instant and never a day. Renders nothing at all when the deployment's profile carries no creation time, because a component that cannot state its fact should not take up a line saying so.",
  component: MemberSince,
  tokens: ["text-muted"],
  variants: {
    tenured: {
      description: "Years on the site — the shape a buyer is looking for.",
      viewport: "phone",
      step: "tenured",
      render: () => <Tenured />,
    },
    fresh: {
      description:
        "Signed up this month: the same sentence, and a fact worth reading differently.",
      viewport: "phone",
      step: "fresh",
      render: () => <New />,
    },
    ladder: {
      description:
        "Several tenures together — month and year each, so the lines compare at a glance.",
      viewport: "desktop",
      step: "ladder",
      render: () => <Ladder />,
    },
  },
});
