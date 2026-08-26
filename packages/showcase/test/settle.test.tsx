import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, useEffect, useState } from "react";
import type { ReactElement } from "react";
import {
  assertVariantsRenderDistinctly,
  assertVariantsSettleDistinctly,
  defineDemo,
  settleVariants,
} from "../src/index.js";
import type { MountedVariant, VariantMounter } from "../src/index.js";

/** The injected renderer: RTL mounts into a live jsdom, which is the point. */
const mount: VariantMounter = (element): MountedVariant => {
  const view = render(element);
  return {
    container: view.container,
    unmount: () => {
      view.unmount();
    },
  };
};

/**
 * The defect this guard exists for, reduced to its mechanism.
 *
 * The seed paints on the first frame; a mount effect then refetches it (a
 * `staleTime: 0` query, a `refetchQueries`), the demo's catch-all mock answers
 * `200 {}`, and the component falls into its error arm. Every variant lands on
 * the same card.
 */
function Panel(props: {
  readonly seed: string;
  readonly refetch?: "dies" | "empties" | "noisy";
}): ReactElement {
  const [answer, setAnswer] = useState<"seed" | "dies" | "empties">("seed");
  const { refetch } = props;
  useEffect(() => {
    if (refetch === undefined) return undefined;
    const timer = setTimeout(() => {
      if (refetch === "noisy") console.error("mock: no handler for GET /panel");
      else setAnswer(refetch);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [refetch]);
  if (answer === "dies") return <div role="alert">Could not load the panel</div>;
  if (answer === "empties") return <div data-stapel-empty="">Nothing here yet</div>;
  return <p>{props.seed}</p>;
}

/** A variant whose named state is only reached by a click — the `play` case. */
function Sheet(): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        data-testid="sheet-trigger"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      {open ? <p>sheet body</p> : null}
    </div>
  );
}

const dyingSeed = defineDemo({
  id: "test.dying-seed",
  title: "Dying seed",
  description: "Two seeded variants that are refetched over after mount.",
  component: Panel,
  variants: {
    default: { render: () => <Panel seed="one" refetch="dies" /> },
    busy: { step: "busy", render: () => <Panel seed="two" refetch="dies" /> },
  },
});

const pinnedSeed = defineDemo({
  id: "test.pinned-seed",
  title: "Pinned seed",
  description: "The same two variants, with the refetch answering their seed.",
  component: Panel,
  variants: {
    default: { render: () => <Panel seed="one" /> },
    busy: { step: "busy", render: () => <Panel seed="two" /> },
  },
});

describe("assertVariantsSettleDistinctly", () => {
  // The whole reason the mechanism is worth a shared export: the demo below is
  // green under every synchronous check the format already had.
  it("fails a demo whose seed dies after mount, which the static guard passes", async () => {
    expect(() => {
      assertVariantsRenderDistinctly(dyingSeed, renderToStaticMarkup);
    }).not.toThrow();
    await expect(
      assertVariantsSettleDistinctly(dyingSeed, { render: mount })
    ).rejects.toThrow(/fell into an arm they never declared/);
  });

  it("names both the arm and the collapse", async () => {
    const failure = await assertVariantsSettleDistinctly(dyingSeed, { render: mount }).catch(
      (reason: unknown) => (reason instanceof Error ? reason.message : String(reason))
    );
    expect(failure).toContain("default settled on: error");
    expect(failure).toContain("default == busy");
  });

  it("passes a demo whose variants keep their seeds", async () => {
    await expect(
      assertVariantsSettleDistinctly(pinnedSeed, { render: mount })
    ).resolves.toBeUndefined();
  });

  it("allows the arm a variant declares in its step", async () => {
    const demo = defineDemo({
      id: "test.declared-error",
      title: "Declared error",
      description: "A demo OF the error state — the arm is the point.",
      component: Panel,
      variants: {
        default: { render: () => <Panel seed="one" /> },
        "load-failed": { step: "error", render: () => <Panel seed="two" refetch="dies" /> },
      },
    });
    await expect(
      assertVariantsSettleDistinctly(demo, { render: mount })
    ).resolves.toBeUndefined();
  });

  it("reads the empty arm from the substrate's stamp", async () => {
    const demo = defineDemo({
      id: "test.emptied",
      title: "Emptied",
      description: "The list arrives empty because the mock answered {}.",
      component: Panel,
      variants: {
        default: { render: () => <Panel seed="one" refetch="empties" /> },
      },
    });
    const settled = await settleVariants(demo, { render: mount });
    expect(settled[0]?.arms).toEqual(["empty"]);
    await expect(assertVariantsSettleDistinctly(demo, { render: mount })).rejects.toThrow(
      /settled on: empty/
    );
  });

  it("counts a variant that renders nothing as an empty arm", async () => {
    const demo = defineDemo({
      id: "test.blank",
      title: "Blank",
      description: "BLANK_RENDER: the shot is one flat colour.",
      component: Panel,
      variants: { default: { render: () => null } },
    });
    await expect(assertVariantsSettleDistinctly(demo, { render: mount })).rejects.toThrow(
      /settled on: empty/
    );
  });

  it("fails on console.error during settle, and restores console.error", async () => {
    const before = console.error;
    const demo = defineDemo({
      id: "test.noisy",
      title: "Noisy",
      description: "Mounts fine, logs on every visit.",
      component: Panel,
      variants: { default: { render: () => <Panel seed="one" refetch="noisy" /> } },
    });
    await expect(assertVariantsSettleDistinctly(demo, { render: mount })).rejects.toThrow(
      /console\.error while settling[\s\S]*no handler for GET \/panel/
    );
    expect(console.error).toBe(before);
  });

  it("compares a played variant AFTER its step, unlike the static guard", async () => {
    const demo = defineDemo({
      id: "test.played",
      title: "Played",
      description: "The sheet variant is the default plus one click.",
      component: Sheet,
      variants: {
        default: { render: () => <Sheet /> },
        "sheet-open": {
          step: "sheet-open",
          render: () => <Sheet />,
          play: async ({ click, find }) => {
            await click("[data-testid='sheet-trigger']");
            await find("p");
          },
        },
      },
    });
    // The static guard skips the played variant entirely (its first frame is
    // legitimately its sibling's); the settled one includes it, and it passes
    // only because the step actually reaches a different screen.
    assertVariantsRenderDistinctly(demo, renderToStaticMarkup);
    const settled = await settleVariants(demo, { render: mount });
    expect(settled.map((entry) => entry.id)).toEqual(["default", "sheet-open"]);
    expect(settled[0]?.markup).not.toBe(settled[1]?.markup);
    await expect(
      assertVariantsSettleDistinctly(demo, { render: mount })
    ).resolves.toBeUndefined();
  });

  it("honours an injected settler for a slow mock", async () => {
    function Slow(): ReactElement {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        const timer = setTimeout(() => {
          setReady(true);
        }, 40);
        return () => {
          clearTimeout(timer);
        };
      }, []);
      return ready ? <p>arrived</p> : <div data-stapel-empty="">waiting</div>;
    }
    const demo = defineDemo({
      id: "test.slow",
      title: "Slow",
      description: "Its answer lands after the default two turns.",
      component: Slow,
      variants: { default: { render: () => <Slow /> } },
    });
    await expect(assertVariantsSettleDistinctly(demo, { render: mount })).rejects.toThrow(
      /settled on: empty/
    );
    await expect(
      assertVariantsSettleDistinctly(demo, {
        render: mount,
        settle: async () => {
          await act(async () => {
            await new Promise((resolve) => {
              setTimeout(resolve, 120);
            });
          });
        },
      })
    ).resolves.toBeUndefined();
  });

  it("unmounts every variant, including the one that failed the assertion", async () => {
    const mounted: MountedVariant[] = [];
    let live = 0;
    const counting: VariantMounter = (element) => {
      const view = render(element);
      live += 1;
      const handle: MountedVariant = {
        container: view.container,
        unmount: () => {
          live -= 1;
          view.unmount();
        },
      };
      mounted.push(handle);
      return handle;
    };
    await assertVariantsSettleDistinctly(dyingSeed, { render: counting }).catch(() => undefined);
    expect(mounted).toHaveLength(2);
    expect(live).toBe(0);
  });
});
