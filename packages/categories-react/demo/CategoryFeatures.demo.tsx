/** A category's feature schema — the payload attributes-react draws. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { CategoryFeatures } from "../src/index.js";
import { CategoriesDemoHarness, DemoCard, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_FEATURES } from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/features/": DEMO_FEATURES };

function Schema(): ReactElement {
  return (
    <CategoriesDemoHarness handlers={HANDLERS}>
      <DemoCard heading="CategoryFeatures">
        <CategoryFeatures categoryId={2}>
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge step={`badges: ${String(bag.badges.length)}`} />
              <StepBadge step={`title parts: ${String(bag.titleParts.length)}`} />
              {bag.state.status === "ready" &&
                bag.state.data.map((entry) => (
                  <StepBadge
                    key={entry.feature.slug}
                    step={`${entry.feature.slug}: ${entry.type ?? "untyped"} · ${entry.label.kind}${entry.mandatory ? " · required" : ""}${entry.optionsAreKeys ? " · option labels are keys" : ""}`}
                  />
                ))}
            </>
          )}
        </CategoryFeatures>
      </DemoCard>
    </CategoriesDemoHarness>
  );
}

export default defineDemo({
  id: "categories.features",
  title: "Category feature schema",
  description:
    "GET /categories/{id}/features/ resolves inheritance and order server-side and sends config VERBATIM — no defaults filled in, so an absent key means the type's default and attributes-react owns those. Each row reports whether its name and its option labels are translation keys, and one fixture carries a type no builtin editor covers.",
  component: CategoryFeatures,
  tokens: ["surface-raised"],
  variants: { default: { render: () => <Schema /> } },
});
