// @vitest-environment jsdom
/**
 * `play` — a variant's post-mount step, so a sheet or a tab that only opens
 * on a click gets photographed open (visual pass NC-SHEETSHUT).
 */
import { describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useState } from "react";
import type { ReactElement } from "react";
import {
  DemoStage,
  assertVariantsRenderDistinctly,
  defineDemo,
  duplicateVariantGroups,
  playVariantIds,
  runDemoPlay,
} from "../src/index.js";

/** A control whose sheet exists only after a click — the shape of the defect. */
function Picker(): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button data-testid="open" onClick={() => setOpen(true)}>
        Choose
      </button>
      {open && <div data-stapel-dialog-surface="sheet">the sheet</div>}
    </div>
  );
}

const demo = defineDemo({
  id: "test.picker",
  title: "Picker",
  description: "A picker whose sheet opens on a click.",
  component: Picker,
  variants: {
    default: { viewport: "phone", step: "closed", render: () => <Picker /> },
    "on a phone": {
      viewport: "phone",
      step: "open",
      render: () => <Picker />,
      play: async ({ click, find }) => {
        await click("[data-testid='open']");
        await find("[data-stapel-dialog-surface='sheet']");
      },
    },
  },
});

describe("play", () => {
  it("lists the variants that declare a step", () => {
    expect(playVariantIds(demo)).toEqual(["on a phone"]);
  });

  it("runs the step against a mounted canvas and reaches the interactive state", async () => {
    const { container } = render(<Picker />);
    expect(container.querySelector("[data-stapel-dialog-surface]")).toBeNull();
    await act(async () => {
      await runDemoPlay(demo, "on a phone", container as HTMLElement);
    });
    expect(container.querySelector("[data-stapel-dialog-surface]")?.textContent).toBe("the sheet");
  });

  it("is a no-op for a variant without one, and throws for an unknown variant", async () => {
    const { container } = render(<Picker />);
    await runDemoPlay(demo, "default", container as HTMLElement);
    expect(container.querySelector("[data-stapel-dialog-surface]")).toBeNull();
    await expect(runDemoPlay(demo, "nope", container as HTMLElement)).rejects.toThrow(/no variant "nope"/);
  });

  it("DemoStage runs the step after mount and stamps done", async () => {
    const { container } = render(<DemoStage demo={demo} variant="on a phone" />);
    const stage = container.querySelector("[data-stapel-demo-stage]") as HTMLElement;
    expect(stage.getAttribute("data-stapel-play")).toBe("pending");
    await waitFor(() => {
      expect(stage.getAttribute("data-stapel-play")).toBe("done");
    });
    expect(stage.querySelector("[data-stapel-dialog-surface]")).not.toBeNull();
  });

  it("DemoStage stamps failed, with the message, when the step cannot reach its state", async () => {
    const broken = defineDemo({
      ...demo,
      id: "test.picker.broken",
      variants: {
        bad: {
          render: () => <Picker />,
          play: async ({ find }) => {
            await find("[data-never]", { portal: true }).catch(() => {
              throw new Error("the sheet never opened");
            });
          },
        },
      },
    });
    const { container } = render(<DemoStage demo={broken} variant="bad" />);
    const stage = container.querySelector("[data-stapel-demo-stage]") as HTMLElement;
    await waitFor(
      () => {
        expect(stage.getAttribute("data-stapel-play")).toBe("failed");
      },
      { timeout: 8000 }
    );
    expect(stage.getAttribute("data-stapel-play-error")).toContain("the sheet never opened");
  }, 10_000);

  it("assertVariantsRenderDistinctly ignores a played variant's first frame", () => {
    // Both variants render the same closed picker; the second one is
    // distinguished by its step, not its first frame.
    expect(duplicateVariantGroups(demo, renderToStaticMarkup)).toEqual([]);
    expect(() => assertVariantsRenderDistinctly(demo, renderToStaticMarkup)).not.toThrow();
    const unplayed = defineDemo({
      ...demo,
      variants: {
        default: { render: () => <Picker /> },
        "on a phone": { render: () => <Picker /> },
      },
    });
    expect(() => assertVariantsRenderDistinctly(unplayed, renderToStaticMarkup)).toThrow(/`play` step/);
  });
});
