/** A person's name as a page heading — and the space it occupies before it
 * has arrived (D453). */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ProfileNameHeading } from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";

function Loading(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <ProfileNameHeading loading />
    </ProfilesDemoHarness>
  );
}

function Ready(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <ProfileNameHeading name="Ada Lovelace" />
    </ProfilesDemoHarness>
  );
}

function Unnamed(): ReactElement {
  return (
    <ProfilesDemoHarness>
      <ProfileNameHeading name="" />
    </ProfilesDemoHarness>
  );
}

/**
 * The two states are the SAME element at the same level, so the slot does not
 * change height when the profile lands. Measured before this component
 * existed: a 24px line of loading text was swapped for an 86px `h4`, and the
 * 46px pushed a whole seller page down — CLS 0.0281 at 1440, 0.0396 at 1280,
 * the only surface of four above 0.01.
 */
export default defineDemo({
  id: "profiles.profile-name-heading-skin",
  title: "Profile name heading (skin)",
  description:
    "A person's display name as a page heading, with the height of that heading reserved while the profile read is in flight. Both states render the same <Typography.Title>, so antd's heading margins and line box apply identically and nothing below the name moves when the answer lands.",
  component: ProfileNameHeading,
  tokens: ["surface-sunken", "text"],
  variants: {
    loading: {
      description:
        "The read is in flight: the heading is drawn, holding a placeholder bar, announced as 'loading the profile'.",
      viewport: "phone",
      step: "loading",
      render: () => <Loading />,
    },
    ready: {
      description:
        "The answer landed. Same element, same level, same box — the name replaces the bar and nothing moves.",
      viewport: "phone",
      step: "ready",
      render: () => <Ready />,
    },
    unnamed: {
      description:
        "A registered person who has typed nothing (stapel-profiles 0.15.0): the pair's word for a nameless profile, never blank space where a heading should be.",
      viewport: "desktop",
      step: "unnamed",
      render: () => <Unnamed />,
    },
  },
});
