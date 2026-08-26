// @vitest-environment jsdom
/**
 * What `SkinTheme` COSTS, and the two things that keep it cheap.
 *
 * `forms-react` reported (wave B, REQUESTS-forms-react §6) that its one
 * full-skin test went from ~1.8s to over vitest's 30s default the moment the
 * pair migrated onto the substrate, and guessed the theme scope was being
 * regenerated on every render. It was not the renders — `SkinTheme` already
 * memoized per instance. It was the INSTANCES:
 *
 *  1. the memo boundary was the component, so ten skinned parts on a screen
 *     built ten deep-equal-but-distinct `ThemeConfig` objects (each one 15
 *     `getComputedStyle` reads of the host's live custom properties), and a
 *     list whose rows wrap themselves built one per row;
 *  2. every distinct config is a fresh antd `ConfigProvider` — measured here
 *     at roughly 9ms of mount each in jsdom, which is ~1.9s for 200 rows and
 *     is paid again by every re-render pass that remounts them.
 *
 * The doctrine tells pairs that "parts may wrap themselves AND be wrapped"
 * costs nothing extra, so the substrate has to make that true instead of
 * warning against the shape. Two changes do it: one config object per
 * distinct answer, process-wide (`skinThemeConfig`), and a context that lets
 * a nested skin recognise that the theme it would apply is the one already
 * applied and render no provider at all (`AppliedThemeContext`).
 *
 * The assertions below are deliberately of two kinds. The STRUCTURAL ones
 * count how many times the host's token scope is actually read — a whole
 * number that does not move with the machine, and the thing that regressed.
 * The TIMING one is a ratio against this same suite's own flat baseline, with
 * enough headroom that only a real re-regression trips it.
 */
import { describe, expect, it, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { Button, ConfigProvider, theme as antdTheme } from "antd";
import type { ReactElement } from "react";
import { SkinTheme } from "../src/skin/theme.js";
import { toAntdThemeConfig } from "../src/index.js";
import { installMatchMedia, setViewport } from "./env.js";

/** A list long enough that a per-instance cost is unmistakable next to a
 * per-screen one. */
const ROWS = 200;

/**
 * How many FULL theme builds happened.
 *
 * A build resolves every §68 colour role off the document; the cheap cache
 * probe reads only `--stapel-brand`. Counting a role no probe touches
 * (`--stapel-text`) therefore counts builds exactly, with no timing in it.
 */
function countThemeBuilds(): { reads: () => number; restore: () => void } {
  let reads = 0;
  const spy = vi
    .spyOn(window.CSSStyleDeclaration.prototype, "getPropertyValue")
    .mockImplementation(function (this: CSSStyleDeclaration, property: string) {
      if (property === "--stapel-text") reads += 1;
      return "";
    });
  return {
    reads: () => reads,
    restore: () => {
      spy.mockRestore();
    },
  };
}

function Rows(props: { n: number; tick: number }): ReactElement {
  const items: ReactElement[] = [];
  for (let i = 0; i < props.n; i += 1) {
    items.push(
      <Button key={i} size="small">
        row {i} · {props.tick}
      </Button>
    );
  }
  return <div>{items}</div>;
}

/** The shape the doctrine encourages: every row is itself a skinned part. */
function SelfWrappingRows(props: { n: number; tick: number }): ReactElement {
  const items: ReactElement[] = [];
  for (let i = 0; i < props.n; i += 1) {
    items.push(
      <SkinTheme key={i} surface="bare">
        <Button size="small">
          row {i} · {props.tick}
        </Button>
      </SkinTheme>
    );
  }
  return <div>{items}</div>;
}

/** Mount, then three more render passes — the count `forms-react`'s 409 test
 * makes (fetch, submit, refetch). Returns milliseconds. */
function mountAndRerender(node: (tick: number) => ReactElement): number {
  const started = performance.now();
  const view = render(node(0));
  for (let pass = 1; pass <= 3; pass += 1) {
    act(() => {
      view.rerender(node(pass));
    });
  }
  const elapsed = performance.now() - started;
  cleanup();
  return elapsed;
}

describe("what SkinTheme costs", () => {
  beforeAll(() => {
    installMatchMedia();
    setViewport(1280);
    // antd generates its whole style set on first use; that cost belongs to
    // antd, not to the wrapper, and would otherwise land on whichever
    // benchmark ran first.
    render(
      <ConfigProvider theme={toAntdThemeConfig("light")}>
        <Button />
      </ConfigProvider>
    );
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("a screen of self-wrapping parts costs no more than one wrapper around them", () => {
    const flat = mountAndRerender((tick) => (
      <SkinTheme>
        <Rows n={ROWS} tick={tick} />
      </SkinTheme>
    ));
    const nested = mountAndRerender((tick) => (
      <SkinTheme>
        <SelfWrappingRows n={ROWS} tick={tick} />
      </SkinTheme>
    ));
    // Recorded rather than asserted on absolutely: the ratio is the claim.
    console.log(
      `SkinTheme ${String(ROWS)} rows — flat ${flat.toFixed(0)}ms · self-wrapping ${nested.toFixed(0)}ms`
    );
    // Before the fix this ratio was ~4x (and grew with the row count, because
    // the cost was per instance). 2x is far above the noise of an equal-cost
    // tree and far below a returning per-instance provider.
    expect(nested).toBeLessThan(flat * 2);
  });

  describe("how often the host's token scope is read", () => {
    let builds: ReturnType<typeof countThemeBuilds>;

    beforeEach(() => {
      builds = countThemeBuilds();
    });

    afterEach(() => {
      builds.restore();
    });

    it("nests without rebuilding: 200 self-wrapping rows build no theme of their own", () => {
      render(
        <SkinTheme>
          <SelfWrappingRows n={ROWS} tick={0} />
        </SkinTheme>
      );
      // At most one build for the whole screen — and zero once the process
      // has already built this answer. Never one per row.
      expect(builds.reads()).toBeLessThanOrEqual(1);
    });

    // Fewer than ROWS on purpose: an unrelated skin is a real `ConfigProvider`
    // mount (antd's cost, not the wrapper's), and the claim under test is the
    // BUILD count, which does not need a long list to be proven.
    it("shares across siblings: unrelated skins build one theme between them", () => {
      const skins: ReactElement[] = [];
      for (let i = 0; i < 40; i += 1) {
        skins.push(
          <SkinTheme key={i}>
            <Button size="small">row {i}</Button>
          </SkinTheme>
        );
      }
      render(<div>{skins}</div>);
      expect(builds.reads()).toBeLessThanOrEqual(1);
    });

    it("re-renders without rebuilding", () => {
      const view = render(
        <SkinTheme>
          <Rows n={4} tick={0} />
        </SkinTheme>
      );
      const afterMount = builds.reads();
      for (let pass = 1; pass <= 5; pass += 1) {
        act(() => {
          view.rerender(
            <SkinTheme>
              <Rows n={4} tick={pass} />
            </SkinTheme>
          );
        });
      }
      expect(builds.reads()).toBe(afterMount);
    });
  });
});

describe("what the sharing must NOT cost", () => {
  beforeAll(() => {
    installMatchMedia();
    setViewport(1280);
  });

  afterEach(() => {
    cleanup();
  });

  /** Reads the antd token actually in force where it is rendered. */
  function TokenProbe(props: { testId: string }): ReactElement {
    const { token } = antdTheme.useToken();
    return (
      <span data-testid={props.testId} data-color-text={token.colorText}>
        probe
      </span>
    );
  }

  it("a nested skin pinning the other mode still gets its own theme", () => {
    const view = render(
      <SkinTheme mode="light">
        <TokenProbe testId="outer" />
        <SkinTheme mode="dark" surface="bare">
          <TokenProbe testId="inner" />
        </SkinTheme>
      </SkinTheme>
    );
    const outer = view.getByTestId("outer").getAttribute("data-color-text");
    const inner = view.getByTestId("inner").getAttribute("data-color-text");
    expect(outer).toBeTruthy();
    expect(inner).toBeTruthy();
    expect(inner).not.toBe(outer);
  });

  it("a nested skin in the SAME mode reports the same token as its parent", () => {
    const view = render(
      <SkinTheme mode="dark">
        <TokenProbe testId="outer" />
        <SkinTheme surface="bare" mode="dark">
          <TokenProbe testId="inner" />
        </SkinTheme>
      </SkinTheme>
    );
    expect(view.getByTestId("inner").getAttribute("data-color-text")).toBe(
      view.getByTestId("outer").getAttribute("data-color-text")
    );
  });

  it("a shared config is still re-read when the document changes mode", async () => {
    const view = render(
      <SkinTheme>
        <TokenProbe testId="probe" />
      </SkinTheme>
    );
    const light = view.getByTestId("probe").getAttribute("data-color-text");
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      await Promise.resolve();
    });
    const dark = view.getByTestId("probe").getAttribute("data-color-text");
    document.documentElement.removeAttribute("data-theme");
    expect(dark).not.toBe(light);
  });
});
