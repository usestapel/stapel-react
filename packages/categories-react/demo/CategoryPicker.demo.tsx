/** The compose form's chooser: drill down, and say why it is not done yet. */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { CategoryPicker } from "../src/index.js";
import {
  CategoriesDemoHarness,
  DemoCard,
  StepBadge,
  useDemoStore,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/categories/": DEMO_PAGE };

function Picker(): ReactElement {
  return (
    <CategoriesDemoHarness handlers={HANDLERS}>
      <DemoCard heading="CategoryPicker">
        <Body />
      </DemoCard>
    </CategoriesDemoHarness>
  );
}

function Body(): ReactElement {
  const t = useT();
  const store = useDemoStore();
  const [selected, setSelected] = useState<number | null>(1);
  return (
    <CategoryPicker
      store={store}
      value={selected}
      onChange={setSelected}
      translate={t}
    >
      {(bag) => (
        <>
          <StepBadge step={bag.state.status} />
          <StepBadge step={`blocked: ${bag.submitBlockedReason ?? "no"}`} />
          {bag.state.status === "ready" &&
            bag.state.data.map((option) => (
              <button
                key={option.node.id}
                type="button"
                data-analytics="none"
                data-analytics-reason="demo-only navigation of the local tree; nothing is submitted, so there is no funnel step to count"
                onClick={() => {
                  bag.open(option.node);
                }}
              >
                {`${option.node.category.slug}${option.isLeaf ? " ·leaf" : ""}`}
              </button>
            ))}
        </>
      )}
    </CategoryPicker>
  );
}

export default defineDemo({
  id: "categories.picker",
  title: "Category picker",
  description:
    "Drill-down over the already-synced tree — no request per level, and none per keystroke when searching. leavesOnly is on by default and the refusal says why: a listing filed one level too high inherits the wrong feature set, so the form then asks the wrong questions.",
  component: CategoryPicker,
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Picker /> } },
});
