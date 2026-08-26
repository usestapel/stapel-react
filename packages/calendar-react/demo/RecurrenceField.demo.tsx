/**
 * The repeat rule, drawn in every shape it takes — including the one it can
 * never take.
 *
 * RRULE accepts UNTIL or COUNT, never both, so the control asks ONE three-way
 * question and shows only the chosen end's field. That rule is invisible in a
 * catalogue that photographs the closed state once; these variants photograph
 * each arm, so "the impossible combination is not offered" is a picture rather
 * than a paragraph.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RecurrenceField } from "../src/default/index.js";
import { NO_RECURRENCE } from "../src/index.js";
import type { RecurrenceValue } from "../src/index.js";
import { CalendarDemoHarness } from "./_harness.js";

/**
 * The field is controlled, so the demo owns the value — a reader can change
 * the preset in the viewer and watch the end question appear, and the STATIC
 * frame is still the one the variant is named for.
 */
function Field(props: { readonly initial: RecurrenceValue }): ReactElement {
  const [value, setValue] = useState(props.initial);
  return (
    <CalendarDemoHarness>
      <RecurrenceField value={value} onChange={setValue} />
    </CalendarDemoHarness>
  );
}

const WEEKLY_UNTIL: RecurrenceValue = {
  ...NO_RECURRENCE,
  type: "weekly",
  end: "until",
  until: "2026-12-24T00:00:00Z",
};

const WEEKLY_COUNT: RecurrenceValue = {
  ...NO_RECURRENCE,
  type: "weekly",
  end: "count",
  count: 8,
};

const CUSTOM: RecurrenceValue = {
  ...NO_RECURRENCE,
  type: "custom",
  interval: 3,
  // 0 = Monday .. 6 = Sunday, the backend's own convention.
  weekdays: [0, 2, 4],
  end: "count",
  count: 12,
};

export default defineDemo({
  id: "calendar.recurrence-field",
  title: "Repeat",
  description:
    "The repeat rule as a single question. `until` and `count` are mutually exclusive in RRULE, so the end is one three-way choice and only the chosen field is drawn — a form that offered both would present a combination the backend must then refuse. The presets are read from a list, not hardcoded, because upstream they are an open merge registry a deployment can extend.",
  component: RecurrenceField,
  tokens: ["surface-raised", "text-muted"],
  variants: {
    none: {
      description: "A one-off event: the preset alone, no end question at all.",
      viewport: "phone",
      step: "none",
      render: () => <Field initial={NO_RECURRENCE} />,
    },
    "ends-on-a-date": {
      description: "Weekly until a date — the date field, and no count field beside it.",
      viewport: "phone",
      step: "weekly.until",
      render: () => <Field initial={WEEKLY_UNTIL} />,
    },
    "ends-after-n": {
      description: "Weekly for a number of times — the count field, and no date field beside it.",
      viewport: "phone",
      step: "weekly.count",
      render: () => <Field initial={WEEKLY_COUNT} />,
    },
    custom: {
      description: "The custom preset: interval and weekdays appear, on a width that can hold seven checkboxes.",
      viewport: "desktop",
      step: "custom",
      render: () => <Field initial={CUSTOM} />,
    },
  },
});
