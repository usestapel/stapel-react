import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { defineDemo, renderDemoVariant, variantIds } from "../src/index.js";

function Subject(props: { children: (n: number) => ReactElement }): ReactElement {
  return props.children(42);
}

const demo = defineDemo({
  id: "test.subject",
  title: "Subject",
  description: "A trivial demo for the format itself.",
  component: Subject,
  tokens: ["accent"],
  decorator: (children) => <section data-frame>{children}</section>,
  variants: {
    default: { render: () => <Subject>{(n) => <span>{n}</span>}</Subject> },
    alt: {
      description: "Alternate",
      render: () => <Subject>{(n) => <b>{n + 1}</b>}</Subject>,
    },
  },
});

describe("defineDemo", () => {
  it("returns the literal object unchanged", () => {
    expect(demo.id).toBe("test.subject");
    expect(variantIds(demo)).toEqual(["default", "alt"]);
  });

  it("renders a variant wrapped in its decorator", () => {
    const { container } = render(renderDemoVariant(demo, "default"));
    expect(container.querySelector("[data-frame]")).not.toBeNull();
    expect(container.textContent).toBe("42");
  });

  it("throws on an unknown variant", () => {
    expect(() => renderDemoVariant(demo, "nope")).toThrow(/no variant "nope"/);
  });
});
