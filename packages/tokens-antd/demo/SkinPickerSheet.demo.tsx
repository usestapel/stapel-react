/**
 * `SkinPickerSheet` — the four states a dropdown never modelled, drawn open
 * at phone width because a picker that is only ever photographed shut has no
 * visual evidence at all (visual pass NC-SHEETSHUT).
 *
 * The option labels are placeholder catalogue terms; what a reviewer has to
 * see is the SHAPE — where the search box sits, how far the list runs before
 * the sticky footer, what a stale list looks like next to a fresh one.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { SkinPickerSheet } from "../src/skin/pickerSheet.js";
import type { PickerGroup, PickerOption } from "../src/skin/pickerSheet.js";
import { SkinTheme } from "../src/skin/theme.js";

const PHONE_FRAME_WIDTH = 390;

const TITLE = "Make";
const SEARCH_PLACEHOLDER = "Search makes";
const DONE_LABEL = "Done";
const EMPTY_LABEL = "Nothing matches that yet.";
const REFINE_LABEL = "Only the first 200 are shown — keep typing to narrow it down.";
const RECENT_LABEL = "Recent";
const ALL_LABEL = "All makes";

const MAKES: readonly PickerOption[] = [
  { value: "audi", label: "Audi" },
  { value: "bmw", label: "BMW" },
  { value: "chery", label: "Chery" },
  { value: "haval", label: "Haval" },
  { value: "hyundai", label: "Hyundai" },
  { value: "kia", label: "Kia" },
  { value: "lada", label: "Lada" },
  { value: "mazda", label: "Mazda" },
  { value: "nissan", label: "Nissan" },
  { value: "renault", label: "Renault" },
  { value: "skoda", label: "Skoda", description: "Also sold as a fleet trim" },
  { value: "toyota", label: "Toyota" },
];

const GROUPED: readonly PickerGroup[] = [
  {
    key: "recent",
    label: RECENT_LABEL,
    options: [
      { value: "kia", label: "Kia" },
      { value: "toyota", label: "Toyota" },
    ],
  },
  { key: "all", label: ALL_LABEL, options: MAKES },
];

/** The sheet is drawn inside a phone-width frame, open, with no trigger. */
function Frame(props: { readonly children: ReactElement }): ReactElement {
  return (
    <SkinTheme surface="base" style={{ padding: spacing[4], maxWidth: PHONE_FRAME_WIDTH }}>
      {props.children}
    </SkinTheme>
  );
}

function SinglePicker(props: {
  readonly groups?: readonly PickerGroup[];
  readonly stale?: boolean;
  readonly loading?: boolean;
  readonly options?: readonly PickerOption[];
  readonly emptyLabel?: string;
  readonly refineLabel?: string;
}): ReactElement {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <SkinPickerSheet
      mode="single"
      open
      surface="sheet"
      title={TITLE}
      searchPlaceholder={SEARCH_PLACEHOLDER}
      onClose={() => undefined}
      value={value}
      onChange={setValue}
      {...(props.groups !== undefined ? { groups: props.groups } : {})}
      {...(props.options !== undefined ? { options: props.options } : {})}
      {...(props.stale === true ? { listStale: true, searchValue: "toy" } : {})}
      {...(props.loading === true ? { loading: true, searchValue: "toy" } : {})}
      {...(props.emptyLabel !== undefined ? { emptyLabel: props.emptyLabel } : {})}
      {...(props.refineLabel !== undefined ? { refineLabel: props.refineLabel } : {})}
    />
  );
}

function MultiPicker(): ReactElement {
  const [values, setValues] = useState<readonly string[]>(["bmw", "kia", "toyota"]);
  return (
    <SkinPickerSheet
      mode="multi"
      open
      surface="sheet"
      title={TITLE}
      searchPlaceholder={SEARCH_PLACEHOLDER}
      doneLabel={DONE_LABEL}
      onClose={() => undefined}
      options={MAKES}
      values={values}
      onChange={setValues}
    />
  );
}

/** A long list, so the cap and its tail row are a real frame and not a claim. */
const MANY: readonly PickerOption[] = Array.from({ length: 260 }, (_, index) => ({
  value: `term-${String(index)}`,
  label: `Model ${String(index + 1)}`,
}));

export default defineDemo({
  id: "tokens-antd.picker-sheet",
  title: "Picker sheet",
  description:
    "The fleet's rule for a long list: on a phone it is picked in a bottom sheet with a search box, never a dropdown — the sheet takes the room the keyboard leaves, keeps its search pinned and its commit button above the home indicator, and scrolls its own body instead of the page. Single-select answers and closes on one tap; multi-select holds a draft and commits it on a footer button that carries the count it is about to keep. The list has four states a Select never modelled: loading, empty, capped, and STALE — rows that no longer answer what is in the search box are dimmed and made inert, so nobody picks the previous query's fourth row believing it is this query's.",
  component: SkinPickerSheet,
  tokens: ["surface-raised", "brand", "border", "text-muted"],
  variants: {
    single: {
      description:
        "One answer, with the caller's own `Recent` group on top (that group is `useRecents` from @stapel/core; the sheet only draws what it is handed). Tapping a row answers and closes.",
      viewport: "phone",
      step: "single-open",
      render: () => (
        <Frame>
          <SinglePicker groups={GROUPED} />
        </Frame>
      ),
    },
    multi: {
      description:
        "Three already chosen: the checkmarks are the draft, and the footer button says what pressing it keeps — `Done · 3`. Dismissing instead discards the draft, which is why the count is on the button and not in the title.",
      viewport: "phone",
      step: "multi-open",
      render: () => (
        <Frame>
          <MultiPicker />
        </Frame>
      ),
    },
    loading: {
      description:
        "The answer to the typed query is in flight: a skeleton where the rows will be. The commit is NOT blocked — the values already chosen are still chosen, and somebody who is done should not wait for a list they are not reading.",
      viewport: "phone",
      step: "loading",
      render: () => (
        <Frame>
          <SinglePicker loading options={MAKES} />
        </Frame>
      ),
    },
    "stale-list": {
      description:
        "The search box says one thing and the rows still answer the previous one (the caller's `matched === false`). The list dims and stops responding until it catches up, which is the difference between a slow picker and a picker that quietly hands back the wrong code.",
      viewport: "phone",
      step: "stale",
      render: () => (
        <Frame>
          <SinglePicker stale options={MAKES} />
        </Frame>
      ),
    },
    capped: {
      description:
        "260 matches, 200 rows: nothing is virtualized yet, so the sheet draws what a phone can usefully scroll and the tail row says the list was cut. Pretending the rest is one flick away would be the more expensive lie.",
      viewport: "phone",
      step: "capped",
      render: () => (
        <Frame>
          <SinglePicker options={MANY} refineLabel={REFINE_LABEL} />
        </Frame>
      ),
    },
    empty: {
      description:
        "The load succeeded and matched nothing — a different sentence from `still loading`, and the reason the empty arm is a prop rather than an empty list.",
      viewport: "phone",
      step: "empty",
      render: () => (
        <Frame>
          <SinglePicker options={[]} emptyLabel={EMPTY_LABEL} />
        </Frame>
      ),
    },
  },
});
