/** Relationship — headless follow / unfollow / block / unblock for a user. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { Relationship } from "../src/index.js";
import {
  ProfilesDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
  StepBadge,
} from "./_harness.js";

const DEMO_USER = "b3f1c0de-0000-4000-8000-0000000000aa";

/** Canned handlers: the status read + each action's echoed new status. */
const HANDLERS = {
  "/relationship": { user_id: DEMO_USER, status: "neutral" },
  "/unfollow": { success: true, status: "neutral" },
  "/follow": { success: true, status: "following" },
  "/unblock": { success: true, status: "neutral" },
  "/block": { success: true, status: "blocked" },
} as const;

/** The relationship body — mounted INSIDE the harness (providers available). */
function RelationshipBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="Relationship">
      <Relationship userId={DEMO_USER}>
        {({ status, isFollowing, isBlocked, follow, unfollow, block, unblock }) => (
          <>
            <StepBadge step={status ?? "loading"} />
            <DemoActions>
              <DemoButton
                run={() => (isFollowing ? unfollow() : follow())}
                labelKey={
                  isFollowing
                    ? "profiles.relationship.unfollow"
                    : "profiles.relationship.follow"
                }
              />
              <DemoButton
                run={() => (isBlocked ? unblock() : block())}
                labelKey={
                  isBlocked
                    ? "profiles.relationship.unblock"
                    : "profiles.relationship.block"
                }
              />
            </DemoActions>
            <span>{t("profiles.relationship.self")}</span>
          </>
        )}
      </Relationship>
    </DemoCard>
  );
}

function RelationshipDemo(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={HANDLERS}>
      <RelationshipBody />
    </ProfilesDemoHarness>
  );
}

/**
 * Demonstrates the headless relationship control: the canned status read starts
 * `neutral`; each action's handler echoes the new status, so follow flips the
 * bag to `following` and block to `blocked`. Bring your own buttons — the
 * component is renderless.
 */
export default defineDemo({
  id: "profiles.relationship",
  title: "Relationship",
  description:
    "The headless Relationship wraps the caller↔target status read and the follow / unfollow / block / unblock actions, exposing the live status plus pending / error state. Bring your own controls — the component is renderless.",
  component: Relationship,
  tokens: ["card-bg", "card-border"],
  variants: {
    default: { render: () => <RelationshipDemo /> },
  },
});
