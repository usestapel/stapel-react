import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import type { ReactElement } from "react";
import { useRevealOnRefusal } from "../src/reveal.js";

afterEach(() => cleanup());

function Form(props: { readonly refused: readonly string[] }): ReactElement {
  const root = useRef<HTMLFormElement | null>(null);
  useRevealOnRefusal(root, props.refused, {
    rowSelector: ".row-error",
    rowOf: (element) => element.closest(".row"),
  });
  return (
    <form ref={root}>
      <button type="submit" data-testid="submit">
        Send
      </button>
      {["name", "phone"].map((field) => (
        <div key={field} className={props.refused.includes(field) ? "row row-error" : "row"}>
          <input data-testid={field} />
        </div>
      ))}
    </form>
  );
}

describe("useRevealOnRefusal", () => {
  it("lands on the first refused field when the server refuses", () => {
    const view = render(<Form refused={[]} />);
    view.getByTestId("submit").focus();
    view.rerender(<Form refused={["phone", "name"]} />);
    expect(document.activeElement).toBe(view.getByTestId("name"));
  });

  it("does not move the caret when refusals only clear", () => {
    const view = render(<Form refused={["name", "phone"]} />);
    view.getByTestId("phone").focus();
    view.rerender(<Form refused={["phone"]} />);
    expect(document.activeElement).toBe(view.getByTestId("phone"));
  });
});
