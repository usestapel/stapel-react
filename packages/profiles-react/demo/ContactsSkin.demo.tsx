/** The seller's phone numbers — the DEFAULT SKIN, both halves. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { Button } from "antd";
import { useT } from "@stapel/core";
import { ContactsManager, RevealPhoneButton } from "../src/default/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import { ADA_ID, CONTACTS, CONTACTS_EMPTY, REVEAL_SUMMARY } from "./_fixtures.js";

/**
 * Order matters: `mockFetch` takes the FIRST key the url contains, and
 * `/contacts` is a substring of every contacts path.
 */
const OWNER = {
  "/contacts/reveal": { phones: [] },
  "/reveals/summary": REVEAL_SUMMARY,
  "/contacts": CONTACTS,
} as const;

const OWNER_EMPTY = {
  "/reveals/summary": REVEAL_SUMMARY,
  "/contacts": CONTACTS_EMPTY,
} as const;

const REVEALED = {
  "/contacts/reveal": {
    phones: [
      { label: "Work", value: "+15550100" },
      { label: "", value: "+15550199" },
    ],
  },
} as const;

const REGISTRATION = {
  "/contacts/reveal": [
    403,
    {
      localizable_error: "error.403.contacts_registration_required",
      error: "Register an account to see a seller's phone number",
      params: {},
    },
  ] as const,
} as const;

const BUDGET = {
  "/contacts/reveal": [
    429,
    {
      localizable_error: "error.429.contacts_reveal_budget",
      error: "Too many phone lookups",
      params: { retry_after: 240 },
    },
  ] as const,
} as const;

function Manager(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={OWNER}>
      <ContactsManager surface="base" />
    </ProfilesDemoHarness>
  );
}

function NoNumbers(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={OWNER_EMPTY}>
      <ContactsManager surface="base" />
    </ProfilesDemoHarness>
  );
}

/** The host's registration door, stood in for by a button that goes nowhere —
 * which door it is belongs to the host, not to this pair. */
function Door(): ReactElement {
  const t = useT();
  return <Button type="primary">{t("demo.contacts.door")}</Button>;
}

function Reveal(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={REVEALED}>
      <RevealPhoneButton ownerKey={ADA_ID} listingId="91823" renderDoor={Door} />
    </ProfilesDemoHarness>
  );
}

function Guest(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={REGISTRATION}>
      <RevealPhoneButton ownerKey={ADA_ID} renderDoor={Door} />
    </ProfilesDemoHarness>
  );
}

function OverBudget(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={BUDGET}>
      <RevealPhoneButton ownerKey={ADA_ID} renderDoor={Door} />
    </ProfilesDemoHarness>
  );
}

function NoPhone(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={REVEALED}>
      <RevealPhoneButton ownerKey={ADA_ID} available={false} renderDoor={Door} />
    </ProfilesDemoHarness>
  );
}

/**
 * Two audiences, one feature. The owner manages numbers they have proved by
 * SMS and can see how often each was handed over; a viewer presses one button
 * and the button becomes the number — or the registration door, or the
 * sentence saying when to come back.
 */
export default defineDemo({
  id: "profiles.contacts-skin",
  title: "Seller contacts (skin)",
  description:
    "The owner's contacts screen and the viewer's Show-phone button. A number is masked to its last two digits until its owner asks to see it, an unverified number says out loud that it reaches nobody, the policy picker is built from the vocabulary the server sent, and the hand-over counters are counts with no names in them. On the viewer's side a 200 replaces the button with tel: links in place (never cached, never stored), a 403 states that an account is required and renders the host's registration door, and a 429 says how many minutes to wait.",
  component: ContactsManager,
  covers: ["RevealPhoneButton"],
  tokens: ["surface-raised", "text", "text-muted"],
  variants: {
    manager: {
      description:
        "Two numbers: one confirmed and handed over 128 times, one still unverified with its verify flow beside it.",
      viewport: "desktop",
      step: "ready",
      render: () => <Manager />,
    },
    "manager-empty": {
      description:
        "No numbers yet — the empty state says what adding one is for, and the add form is the only control on the screen.",
      viewport: "phone",
      step: "empty",
      render: () => <NoNumbers />,
    },
    reveal: {
      description:
        "The viewer's button before the ask. Pressing it replaces the button with the seller's numbers as tel: links with a copy control each.",
      viewport: "phone",
      step: "idle",
      render: () => <Reveal />,
    },
    registration: {
      description:
        "A guest or a signed-out visitor: the ask answers 403, the sentence says an account is needed, and the host's registration door stands beside it.",
      viewport: "phone",
      step: "registration",
      render: () => <Guest />,
    },
    budget: {
      description:
        "Over the hourly budget: the wire says retry_after in seconds and the sentence says minutes.",
      viewport: "phone",
      step: "budget",
      render: () => <OverBudget />,
    },
    "no-phone": {
      description:
        "The seller's public profile says there is no number to ask for: the control is switched off WITH its reason beside it, not greyed out in silence.",
      viewport: "phone",
      step: "unavailable",
      render: () => <NoPhone />,
    },
  },
});
