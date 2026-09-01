/**
 * The way out of a search that found nothing — every exit built out of state
 * the pair already holds.
 *
 * The screen this replaces was one sentence with fifteen chips above it. On a
 * live board where 2924 leaves of 2924 were empty, that sentence was the
 * terminal state of the whole catalogue, and the two constraints most likely
 * to have caused it — a radius the page applied on its own and the narrowest
 * segment of the category path — were the two the person never typed.
 *
 * Each variant differs in exactly one thing: WHICH constraints are applied.
 * That is the component's whole logic, so it is the whole demo — the exits are
 * derived, never invented, and a search with nothing to widen offers nothing.
 */
import type { ReactElement } from "react";
import { Button, Flex, Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import { EmptyExits } from "../src/default/EmptyExits.js";
import { SearchSkinHarness } from "./_harness.js";
import { DEMO_FEATURES, DEMO_TYPE } from "./fixtures.js";

/** A narrowed, centred, filtered search — every exit at once. */
const NARROWED = [
  `type=${DEMO_TYPE}`,
  "category=141/151/165",
  "lat=55.7558",
  "lon=37.6173",
  "radius_km=25",
  "f.brand=bosch",
  "r.power_w=100..500",
].join("&");

/** Only a location. Two exits, and no "up a level" to offer. */
const LOCATED = [
  `type=${DEMO_TYPE}`,
  "lat=55.7558",
  "lon=37.6173",
  "radius_km=25",
].join("&");

/**
 * What a HOST puts in the slot: the neighbouring sections, with counts.
 *
 * Drawn here as plain buttons because that is all this package would ever see
 * — the tree walk and the counts belong to the container, and the demo's job
 * is to show that the slot lands above the derived exits, not to invent a
 * sibling picker inside a search package.
 */
function Siblings(): ReactElement {
  const t = useT();
  return (
    <Flex vertical gap={spacing[2]}>
      <Typography.Text type="secondary">
        {t("demo.exits.siblings")}
      </Typography.Text>
      <Flex wrap gap={spacing[2]}>
        <Button>{t("demo.exits.sibling_used")}</Button>
        <Button>{t("demo.exits.sibling_bikes")}</Button>
      </Flex>
    </Flex>
  );
}

function Exits(props: {
  readonly search: string;
  readonly withSiblings?: boolean;
}): ReactElement {
  return (
    <SearchSkinHarness phone search={props.search}>
      <EmptyExits
        categoryFeatures={DEMO_FEATURES}
        {...(props.withSiblings === true
          ? { renderExtra: () => <Siblings /> }
          : {})}
      />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.empty-exits",
  title: "Empty-result exits",
  description:
    "A search that found nothing, with a way out of every constraint that could have caused it — up a level of the category path, four times the radius, everywhere, drop one named filter, clear everything. Each button removes exactly one constraint and is offered only when that constraint is actually applied, so the row is never a wall of controls that change nothing. Sibling sections with counts are the exit a buyer most wants and the one this package must not build: walking the tree belongs to the categories pair, so it is a host slot rendered above the derived exits.",
  component: EmptyExits,
  covers: ["parentCategory"],
  tokens: ["surface-raised"],
  variants: {
    "every constraint": {
      description:
        "Narrowed to a third-level category, centred with a 25 km radius, one facet and one range applied — five separate exits plus 'clear everything', because which one is the culprit is not something this pair can rank.",
      viewport: "phone",
      step: "all-exits",
      render: () => <Exits search={NARROWED} />,
    },
    "only the location": {
      description:
        "The commonest real case on a thin board: nothing was typed, nothing was filtered, and the SERP applied a radius the category page did not. Two exits, and no 'up a level' — there is no path to shorten.",
      viewport: "phone",
      step: "geo-only",
      render: () => <Exits search={LOCATED} />,
    },
    "with the host's siblings": {
      description:
        "The slot filled: neighbouring sections with live counts, above the derived exits. The host has the tree and the counts; this package has neither, and a made-up number beside a section name is worse than no section list.",
      viewport: "phone",
      step: "with-extra",
      render: () => <Exits search={NARROWED} withSiblings />,
    },
  },
});
