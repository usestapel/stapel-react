/**
 * WHERE A ROUTE LANDS.
 *
 * The defect this file is the gate for: a single-page app changes the address
 * without loading a document, so nothing moves the viewport, and a listing
 * opened from two thousand pixels down a feed came up already scrolled past
 * its own photographs.
 *
 * Four rules, and each is a separate `it` because each has its own way of
 * being wrong:
 *
 *  1. a PUSH to another page lands at the top;
 *  2. a POP restores the offset that entry was left at — the other half of
 *     the same complaint, and the half a naive "scroll to top on every
 *     navigation" breaks;
 *  3. the same page under a different query (a chip, a tab, `?step=`) does
 *     not move at all;
 *  4. a hash link still reaches its target.
 *
 * ── What jsdom can and cannot say here ────────────────────────────────────
 *
 * jsdom lays nothing out: `scrollY` is always 0 and `scrollTo` is a stub. So
 * the viewport is FAKED — one writable offset, `scrollTo` writes it and fires
 * a `scroll` event exactly as a browser does, and `scrollDown` is a reader's
 * flick. Every claim below is then about the offset this hook leaves behind,
 * which is the whole of what it decides. What jsdom cannot answer — whether
 * the document is tall enough to hold that offset — is not a claim this
 * module makes either.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Outlet, Route, Routes, useNavigate } from "react-router";
import type { ReactElement } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { PublicShell } from "../src/default/PublicShell.js";
import { useRouteScrollReset } from "../src/default/routeScroll.js";
import { registerShellI18n } from "../src/i18n/keys.js";

/** The faked viewport: the offset, and every move written to it. */
interface Viewport {
  readonly moves: readonly number[];
  offset: () => number;
  scrollDown: (to: number) => void;
}

let viewport: Viewport;

beforeEach(() => {
  let y = 0;
  const moves: number[] = [];
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => y,
  });
  window.scrollTo = ((x: number, top: number): void => {
    y = top;
    moves.push(top);
    window.dispatchEvent(new Event("scroll"));
  }) as typeof window.scrollTo;
  viewport = {
    moves,
    offset: () => y,
    scrollDown: (to: number) => {
      y = to;
      window.dispatchEvent(new Event("scroll"));
    },
  };
});

afterEach(() => {
  cleanup();
  window.history.scrollRestoration = "auto";
});

/** A chrome with an `<Outlet/>` and nothing else — the shape the rule is
 * about, without antd or a nav tree in the way. */
function Chrome(props: { readonly enabled?: boolean }): ReactElement {
  useRouteScrollReset(props.enabled ?? true);
  return <Outlet />;
}

function Feed(): ReactElement {
  const navigate = useNavigate();
  return (
    <div>
      <Link to="/l/7">card</Link>
      <Link to="/?sort=new">sort</Link>
      <Link to="/#terms">anchor</Link>
      <button onClick={() => navigate("/l/7", { replace: true })}>replace</button>
      <div id="terms">terms</div>
    </div>
  );
}

function Listing(): ReactElement {
  const navigate = useNavigate();
  return (
    <div>
      <span>listing</span>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
}

function app(chrome: ReactElement): ReactElement {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={chrome}>
          <Route path="/" element={<Feed />} />
          <Route path="/l/:id" element={<Listing />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("useRouteScrollReset", () => {
  it("lands a PUSH to another page at the top", () => {
    render(app(<Chrome />));
    viewport.scrollDown(2500);
    fireEvent.click(screen.getByText("card"));
    expect(screen.getByText("listing")).toBeDefined();
    expect(viewport.offset()).toBe(0);
  });

  it("restores the feed's offset on a POP", () => {
    render(app(<Chrome />));
    viewport.scrollDown(2500);
    fireEvent.click(screen.getByText("card"));
    expect(viewport.offset()).toBe(0);
    fireEvent.click(screen.getByText("back"));
    expect(screen.getByText("card")).toBeDefined();
    expect(viewport.offset()).toBe(2500);
  });

  it("leaves the page alone when only the query changes", () => {
    render(app(<Chrome />));
    viewport.scrollDown(1200);
    fireEvent.click(screen.getByText("sort"));
    expect(viewport.offset()).toBe(1200);
    expect(viewport.moves).toEqual([]);
  });

  it("leaves the page alone on a REPLACE", () => {
    render(app(<Chrome />));
    viewport.scrollDown(800);
    fireEvent.click(screen.getByText("replace"));
    expect(screen.getByText("listing")).toBeDefined();
    expect(viewport.offset()).toBe(800);
  });

  it("lets a hash link reach its target", () => {
    const seen: string[] = [];
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: function record(this: Element): void {
        seen.push(this.id);
      },
    });
    render(app(<Chrome />));
    viewport.scrollDown(600);
    fireEvent.click(screen.getByText("anchor"));
    expect(seen).toEqual(["terms"]);
    // The target won: nothing scrolled the page to the top over it.
    expect(viewport.moves).toEqual([]);
  });

  it("takes history.scrollRestoration only while it is enabled", () => {
    const on = render(app(<Chrome />));
    expect(window.history.scrollRestoration).toBe("manual");
    on.unmount();
    expect(window.history.scrollRestoration).toBe("auto");

    window.history.scrollRestoration = "auto";
    render(app(<Chrome enabled={false} />));
    expect(window.history.scrollRestoration).toBe("auto");
    viewport.scrollDown(2500);
    fireEvent.click(screen.getByText("card"));
    expect(viewport.offset()).toBe(2500);
  });
});

/** The shells are where the rule has to actually be mounted: a hook nobody
 * calls is the defect with an extra file in it. */
describe("the chromes place the route they render", () => {
  function shell(props: { readonly scrollRestoration?: boolean }): ReactElement {
    const i18n = createI18n({ locale: "en" });
    registerShellI18n(i18n);
    return (
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<PublicShell nav={[]} {...props} />}>
              <Route path="/" element={<Feed />} />
              <Route path="/l/:id" element={<Listing />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
  }

  it("PublicShell resets on a PUSH with no prop at all", () => {
    render(shell({}));
    viewport.scrollDown(2500);
    fireEvent.click(screen.getByText("card"));
    expect(viewport.offset()).toBe(0);
  });

  it("PublicShell hands the viewport back on scrollRestoration={false}", () => {
    render(shell({ scrollRestoration: false }));
    viewport.scrollDown(2500);
    fireEvent.click(screen.getByText("card"));
    expect(viewport.offset()).toBe(2500);
  });
});
