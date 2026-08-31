/**
 * The category landing's quick-search panel.
 *
 * The four variants are the count contract, photographed: an exact total, a
 * lower bound, a count still in flight, and a panel with no fields at all. The
 * fields are the HOST's — this package composes no select and imports no
 * search client — and the count arrives as core's `LoadState`, in the same
 * shape `@stapel/search-react`'s `useSearchCount()` returns.
 */
import type { ReactElement, ReactNode } from "react";
import { Select } from "antd";
import { defineDemo } from "@stapel/showcase";
import { loadLoading, loadReady, useT } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { CategoryQuickSearchPanel } from "../src/default/index.js";
import type { QuickSearchCount } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";

const MAKE_OPTIONS = [
  { value: "bmw", label: "BMW" },
  { value: "kia", label: "Kia" },
];
const PRICE_OPTIONS = [
  { value: "0-500000", label: "≤ 500 000" },
  { value: "500000-", label: "500 000 +" },
];

/** The two selects a car category's quick search asks about, composed by the
 * host out of the category's own facets — never by this package. */
function DemoFields(): ReactElement {
  const t = useT();
  return (
    <>
      <Select
        options={MAKE_OPTIONS}
        placeholder={t("demo.quick_search.make")}
        style={{ width: "100%" }}
      />
      <Select
        options={PRICE_OPTIONS}
        placeholder={t("demo.quick_search.price")}
        style={{ width: "100%" }}
      />
    </>
  );
}

function Panel(props: {
  readonly count?: LoadState<QuickSearchCount>;
  readonly fields?: ReactNode;
}): ReactElement {
  const t = useT();
  return (
    <CategoryQuickSearchPanel
      heading={t("demo.quick_search.heading")}
      ctaHref="/s?type=listing&category=vehicles"
      {...(props.count !== undefined ? { count: props.count } : {})}
      {...(props.fields !== undefined ? { fields: props.fields } : {})}
    />
  );
}

const EXACT: LoadState<QuickSearchCount> = loadReady({
  count: 128,
  kind: "exact",
});
const LOWER_BOUND: LoadState<QuickSearchCount> = loadReady({
  count: 500,
  kind: "at_least",
});
const IN_FLIGHT: LoadState<QuickSearchCount> = loadLoading();

export default defineDemo({
  id: "categories.quick-search",
  title: "Category quick search",
  description:
    "The category landing's brand-tinted panel: a heading, the host's own field slots, and a full-width button carrying the live result count. Only a ready, countable answer earns a number — loading, refused and 'the engine cannot say' all render the plain sentence, and a lower bound gets its own, because a floor printed as a total is a lie in a shorter form.",
  component: CategoryQuickSearchPanel,
  tokens: ["brand-subtle"],
  variants: {
    counted: {
      description: "An exact total: the button says how many.",
      viewport: "phone",
      step: "ready-exact",
      render: () => (
        <CategoriesDemoHarness>
          <Panel count={EXACT} fields={<DemoFields />} />
        </CategoriesDemoHarness>
      ),
    },
    counting: {
      description:
        "The count is in flight. The button stays pressable and stays honest — the same sentence a refusal and an uncountable answer get.",
      viewport: "phone",
      step: "loading",
      render: () => (
        <CategoriesDemoHarness>
          <Panel count={IN_FLIGHT} fields={<DemoFields />} />
        </CategoriesDemoHarness>
      ),
    },
    "a floor, not a total": {
      description:
        "count_is_lower_bound: at least 500 match, possibly more. Never rendered as 500.",
      viewport: "desktop",
      step: "ready-at-least",
      render: () => (
        <CategoriesDemoHarness>
          <Panel count={LOWER_BOUND} fields={<DemoFields />} />
        </CategoriesDemoHarness>
      ),
    },
    "no fields": {
      description:
        "A category whose quick search is just 'show me everything under here' — a heading and a button, which is a legitimate panel.",
      viewport: "desktop",
      step: "ready-exact-bare",
      render: () => (
        <CategoriesDemoHarness>
          <Panel count={loadReady({ count: 12, kind: "exact" })} />
        </CategoriesDemoHarness>
      ),
    },
  },
});
