/**
 * The embeddable control — the one surface of this pair another pair mounts.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReportButton } from "../src/default/index.js";
import { ModerationDemoHarness } from "./_harness.js";
import { POLICY } from "./_fixtures.js";

function Embedded(props: {
  compact?: boolean;
  block?: boolean;
  size?: "small" | "middle";
}): ReactElement {
  return (
    <ModerationDemoHarness handlers={{ "/policy": POLICY }}>
      <ReportButton
        targetType="listing"
        targetKey="8842"
        signIn={{ href: "/login" }}
        {...(props.compact === true ? { compact: true } : {})}
        {...(props.block === true ? { block: true } : {})}
        {...(props.size !== undefined ? { size: props.size } : {})}
      />
    </ModerationDemoHarness>
  );
}

export default defineDemo({
  id: "moderation.report-button",
  title: "Report button (embeddable)",
  description:
    "The slot other pairs mount beside their own actions — a listing card, a review, a chat message menu. It has no nav entry on purpose: it is a control with a target, not a screen. A signed-out visitor gets the SAME button, because hiding it hides the fact that this platform accepts complaints at all; the sheet it opens carries the rules and the sign-in door together. The sheet itself is mounted only after the first press, so a listing page with twenty of these does not open twenty policy reads.",
  component: ReportButton,
  tokens: ["surface-raised", "border"],
  variants: {
    default: {
      description: "Icon and word, at the design width.",
      viewport: "phone",
      step: "idle",
      render: () => <Embedded />,
    },
    compact: {
      description:
        "Icon only, for a card action row where the word does not fit — the accessible name moves to `aria-label` rather than disappearing.",
      viewport: "desktop",
      step: "compact",
      render: () => <Embedded compact size="small" />,
    },
    block: {
      description: "Full width, for a phone action sheet's own list of actions.",
      viewport: "phone",
      step: "block",
      render: () => <Embedded block />,
    },
  },
});
