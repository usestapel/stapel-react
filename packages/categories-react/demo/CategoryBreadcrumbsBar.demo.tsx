/**
 * Root → current, and the one place this skin decides how a link is rendered.
 *
 * `CategoryLink` is the seam: absent a host `linkComponent` every crumb is a
 * plain anchor — correct, and a full page load per click in a router app. The
 * `in a router` variant renders the same bar through a host `<Link>`, which is
 * the one line a container writes and the shape the scaffold must pass.
 */
import type { ReactElement, ReactNode } from "react";
import { Flex } from "antd";
import { useT } from "@stapel/core";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { CategoryBreadcrumbsBar, CategoryLink } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import { DEMO_ROWS } from "./fixtures.js";

const SEEDED: DemoSeed = { rows: DEMO_ROWS };

/** A container's router adapter — `<Link>` from react-router, wouter, next. */
function RouterLink(props: {
  readonly href: string;
  readonly children?: ReactNode;
}): ReactElement {
  return (
    <a
      href={props.href}
      data-router-to={props.href}
      onClick={(event) => {
        event.preventDefault();
      }}
    >
      {props.children}
    </a>
  );
}

/** The one seam, both ways round. */
function LinkPair(): ReactElement {
  const t = useT();
  return (
    <SkinTheme>
      <Flex vertical gap={spacing[2]}>
        <CategoryLink href="/c/phones" slug="phones">
          {t("demo.link.plain")}
        </CategoryLink>
        <CategoryLink href="/c/phones" slug="phones" linkComponent={RouterLink}>
          {t("demo.link.router")}
        </CategoryLink>
      </Flex>
    </SkinTheme>
  );
}

export default defineDemo({
  id: "categories.breadcrumbs",
  title: "Category breadcrumbs",
  description:
    "Every caption goes through renderCategoryLabel, the one place this skin decides between 'translate this' and 'print this': a name is a translation KEY unless the row says otherwise. The CURRENT crumb is a label, never a link to the page under your feet.",
  component: CategoryBreadcrumbsBar,
  covers: ["CategoryBreadcrumbs", "CategoryLink"],
  tokens: ["surface-raised"],
  variants: {
    deep: {
      description: "Three levels down, only the ancestors linked.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryBreadcrumbsBar slug="used-phones" />
        </CategoriesDemoHarness>
      ),
    },
    "in a router": {
      description: "The same bar through the host's <Link> — no anchor navigation at all.",
      viewport: "desktop",
      step: "ready-routed",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryBreadcrumbsBar slug="used-phones" linkComponent={RouterLink} />
        </CategoriesDemoHarness>
      ),
    },
    "the link itself": {
      description:
        "CategoryLink on its own: an anchor by default, the host's component when one is handed in.",
      viewport: "desktop",
      step: "link",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <LinkPair />
        </CategoriesDemoHarness>
      ),
    },
    "stale link": {
      description: "A slug the catalogue does not have — said only once the sync succeeded.",
      viewport: "desktop",
      step: "unknown-slug",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CategoryBreadcrumbsBar slug="typewriters" />
        </CategoriesDemoHarness>
      ),
    },
  },
});
