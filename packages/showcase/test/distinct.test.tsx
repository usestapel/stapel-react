import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import {
  assertVariantsRenderDistinctly,
  defineDemo,
  duplicateVariantGroups,
} from "../src/index.js";

/**
 * The real shape of the defect: a prop that only changes what renders AFTER an
 * interaction. `deduped` is read on the second paint, so both variants produce
 * the same DOM on the first — a source-text comparison would pass them.
 */
function Uploader(props: { deduped: boolean }): ReactElement {
  const seen = false; // stands in for "a file has been picked"
  return <p>{seen && props.deduped ? "already stored" : "pick a file"}</p>;
}

const unseeded = defineDemo({
  id: "test.uploader",
  title: "Uploader",
  description: "Two variants, one of which is never reached by a static render.",
  component: Uploader,
  variants: {
    default: { render: () => <Uploader deduped={false} /> },
    "already-stored": {
      step: "deduped",
      render: () => <Uploader deduped />,
    },
  },
});

const seeded = defineDemo({
  id: "test.uploader-seeded",
  title: "Uploader (seeded)",
  description: "Each variant paints its own state.",
  component: Uploader,
  variants: {
    default: { viewport: "phone", render: () => <p>pick a file</p> },
    "already-stored": { step: "deduped", render: () => <p>already stored</p> },
  },
});

describe("duplicateVariantGroups", () => {
  it("groups variants whose rendered markup is byte-identical", () => {
    const groups = duplicateVariantGroups(unseeded, renderToStaticMarkup);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.variants).toEqual(["default", "already-stored"]);
  });

  it("is empty when every variant paints its own state", () => {
    expect(duplicateVariantGroups(seeded, renderToStaticMarkup)).toEqual([]);
  });

  it("compares the DOM, not the render closure's source", () => {
    // The two closures differ textually (`deduped={false}` vs `deduped`) and
    // still collide — the whole reason this guard renders.
    const sources = Object.values(unseeded.variants).map((v) => v.render.toString());
    expect(sources[0]).not.toBe(sources[1]);
    expect(duplicateVariantGroups(unseeded, renderToStaticMarkup)).toHaveLength(1);
  });
});

describe("assertVariantsRenderDistinctly", () => {
  it("passes a demo whose variants differ", () => {
    expect(() => assertVariantsRenderDistinctly(seeded, renderToStaticMarkup)).not.toThrow();
  });

  it("names the colliding variants and the step they claimed to be seeded at", () => {
    expect(() => assertVariantsRenderDistinctly(unseeded, renderToStaticMarkup)).toThrow(
      /default == already-stored \(declared step: deduped\)/
    );
  });

  it("applies the demo's decorator before comparing", () => {
    const demo = defineDemo({
      id: "test.decorated",
      title: "Decorated",
      description: "The decorator is part of what a viewer photographs.",
      component: Uploader,
      decorator: (children) => <section data-frame>{children}</section>,
      variants: {
        a: { render: () => <p>one</p> },
        b: { render: () => <p>two</p> },
      },
    });
    const markup = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- declared above
      demo.variants["a"]!.render() as ReactElement
    );
    expect(markup).not.toContain("data-frame");
    expect(duplicateVariantGroups(demo, renderToStaticMarkup)).toEqual([]);
  });
});
