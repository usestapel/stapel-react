/** First run — the DEFAULT SKIN for the initial-setup prompt. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { InitialSetupModal } from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import { LANGUAGES, MY_PROFILE } from "./_fixtures.js";

/** A profile that has NOT been through first run, and no display name — the
 * state the prompt exists for. */
const FIRST_RUN_PROFILE = {
  ...MY_PROFILE,
  display_name: "",
  initial_setup_passed: false,
};

const HANDLERS = {
  "/languages/": LANGUAGES,
  "/me": FIRST_RUN_PROFILE,
} as const;

function Skippable(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={HANDLERS}>
      <InitialSetupModal open />
    </ProfilesDemoHarness>
  );
}

function Blocking(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={HANDLERS}>
      <InitialSetupModal open skippable={false} fields={["displayName"]} />
    </ProfilesDemoHarness>
  );
}

/**
 * A dialog, not a modal-shaped component: `SkinDialog` makes it a bottom sheet
 * on a phone and a centred modal above, once, for the whole fleet.
 */
export default defineDemo({
  id: "profiles.initial-setup-skin",
  title: "First run (skin)",
  description:
    "The first-run prompt: display name, theme and app language in the same row canon the settings screen uses, committed in ONE PATCH carrying initial_setup_passed. Save states why it is off, as text beside it, because a disabled button fires no pointer events and a tooltip there is a reason nobody can read.",
  component: InitialSetupModal,
  tokens: ["surface-raised", "text"],
  variants: {
    "first-run": {
      description: "Skippable: Continue plus a quiet 'Maybe later', and the usual dismissal.",
      viewport: "phone",
      step: "open",
      render: () => <Skippable />,
    },
    blocking: {
      description:
        "The blocking case (a guest who cannot join a call nameless): no Skip, no dismissal drawn at all, and Save states the reason it is switched off.",
      viewport: "desktop",
      step: "blocked",
      render: () => <Blocking />,
    },
  },
});
