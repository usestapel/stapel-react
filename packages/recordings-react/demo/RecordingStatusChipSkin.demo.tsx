/** One chip per real RecordingStatus value, plus the neutral fallback for a status this build has never seen. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecordingStatusChip } from "../src/default/index.js";
import { RECORDING_STATUSES } from "../src/index.js";
import { SkinDemo } from "./_fixtures.js";

function ChipRow(props: { statuses: readonly string[] }): ReactElement {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {props.statuses.map((status) => (
        <RecordingStatusChip key={status} status={status} />
      ))}
    </div>
  );
}

function DefaultVariant(): ReactElement {
  return (
    <SkinDemo>
      <ChipRow statuses={RECORDING_STATUSES} />
    </SkinDemo>
  );
}

function PhoneVariant(): ReactElement {
  return (
    <SkinDemo>
      <ChipRow statuses={["completed", "transcribing", "error", "quantum-folding"]} />
    </SkinDemo>
  );
}

export default defineDemo({
  id: "recordings.status-chip",
  title: "Status chip",
  description:
    "The eleven lifecycle values the backend can emit, each with a sentence and a tone, and the neutral chip an unknown status falls back to.",
  component: RecordingStatusChip,
  variants: {
    default: {
      description: "The full vocabulary: pipeline-owned, terminal-good, terminal-bad.",
      viewport: "desktop",
      step: "all",
      render: () => <DefaultVariant />,
    },
    phone: {
      description: "A status string this build does not know — a neutral chip, never the raw enum member.",
      viewport: "phone",
      step: "unknown",
      render: () => <PhoneVariant />,
    },
  },
});
