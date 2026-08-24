/**
 * `/c` — the catalogue root, as a storefront visitor sees it.
 *
 * One of the two most-used screens in the whole storefront, and until this file
 * existed there was no picture of it anywhere: the nav manifest routed to it,
 * the skin was on disk, and every story in the package rendered a debug card
 * for its headless twin instead.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { CatalogPage } from "../src/default/index.js";
import { CategoriesDemoHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import { DEMO_CAROUSEL, DEMO_ROWS } from "./fixtures.js";

const SEEDED: DemoSeed = { rows: DEMO_ROWS, carousel: DEMO_CAROUSEL };
const NOTHING: DemoSeed = { rows: [], carousel: [] };
const OUTAGE: DemoHandlers = {
  "/categories/": [503, { code: "stapel.http.503", message: "unavailable" }],
  "/categories/carousel/": [503, { code: "stapel.http.503", message: "unavailable" }],
};

/**
 * The host's icon resolver. `carousel_icon` is an OPAQUE reference the backend
 * refuses to resolve, so a deployment maps it to whatever its CDN serves —
 * here, a coloured initial, which is what a storefront without artwork should
 * ship rather than a broken `<img>`.
 */
function Glyph(props: { readonly reference: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      data-demo-icon={props.reference}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1.5em",
        height: "1.5em",
        borderRadius: "50%",
        background: cssVar("surface-sunken"),
        color: cssVar("brand"),
      }}
    >
      {props.reference.slice(-1).toUpperCase()}
    </span>
  );
}

export default defineDemo({
  id: "categories.catalog",
  title: "Catalogue page",
  description:
    "The /c route: the carousel of featured categories over the top-level tree. Category names arrive from the wire as TRANSLATION KEYS, so the host's bundle supplies the copy — and icon references stay opaque strings the host resolves, because a library that guessed a CDN path would ship a broken image on every deployment that guessed differently.",
  component: CatalogPage,
  covers: ["CategoriesProvider"],
  tokens: ["surface-base", "surface-raised"],
  variants: {
    browse: {
      description: "A visitor on a phone, catalogue already synced.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CatalogPage renderIcon={(reference) => <Glyph reference={reference} />} />
        </CategoriesDemoHarness>
      ),
    },
    "no icons": {
      description:
        "The same screen where the host resolves no icons — text tiles, by construction rather than by accident.",
      viewport: "desktop",
      step: "ready-without-icons",
      render: () => (
        <CategoriesDemoHarness seed={SEEDED}>
          <CatalogPage />
        </CategoriesDemoHarness>
      ),
    },
    "empty catalogue": {
      description: "A deployment nobody has filled in yet — two different sentences, one per section.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <CategoriesDemoHarness seed={NOTHING}>
          <CatalogPage />
        </CategoriesDemoHarness>
      ),
    },
    outage: {
      description: "The catalogue endpoint refuses. A failed sync is never an empty catalogue.",
      viewport: "desktop",
      step: "failed",
      render: () => (
        <CategoriesDemoHarness handlers={OUTAGE}>
          <CatalogPage />
        </CategoriesDemoHarness>
      ),
    },
  },
});
